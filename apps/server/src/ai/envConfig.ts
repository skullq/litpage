import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resetClientCache } from './client.ts';
import { resetModelsCache } from './models.ts';
import { parseOpenAIModels, refreshOpenAIModels, setOpenAIModelsFetch } from './providers/openaiModels.ts';

export const ENV_LOCAL_PATH = resolve(import.meta.dirname, '../../.env.local');

export interface AiEnvConfig {
  provider: 'openai' | 'anthropic' | 'none';
  openaiBaseUrl: string;
  openaiApiKeyMasked: string;
  hasOpenaiApiKey: boolean;
  anthropicApiKeyMasked: string;
  hasAnthropicApiKey: boolean;
  model: string;
  fastModel: string;
  imageModel: string;
  allowedModels: string;
}

export interface SaveAiEnvPatch {
  provider?: 'openai' | 'anthropic' | 'none';
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
  fastModel?: string;
  imageModel?: string;
  allowedModels?: string;
}

function maskKey(key: string | undefined): { masked: string; hasKey: boolean } {
  const k = key?.trim() ?? '';
  if (!k) return { masked: '', hasKey: false };
  if (k.length <= 10) return { masked: '********', hasKey: true };
  return { masked: `${k.slice(0, 6)}...${k.slice(-4)}`, hasKey: true };
}

export function parseEnvFile(filePath = ENV_LOCAL_PATH): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const res: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const k = line.slice(0, eqIdx).trim();
    let v = line.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    res[k] = v;
  }
  return res;
}

export function updateEnvFile(filePath = ENV_LOCAL_PATH, updates: Record<string, string>): string {
  let content = '';
  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf8');
  }
  const lines = content ? content.split('\n') : [];
  const seen = new Set<string>();
  const newLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      newLines.push(line);
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      newLines.push(line);
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    if (key in updates) {
      seen.add(key);
      const val = updates[key];
      if (val !== undefined && val !== null) {
        newLines.push(`${key}=${val}`);
      }
    } else {
      newLines.push(line);
    }
  }

  for (const [key, val] of Object.entries(updates)) {
    if (!seen.has(key) && val !== undefined && val !== null) {
      newLines.push(`${key}=${val}`);
    }
  }

  const result = newLines.join('\n');
  writeFileSync(filePath, result, 'utf8');
  return result;
}

export function getEnvConfig(): AiEnvConfig {
  const fromFile = parseEnvFile();
  const getVal = (k: string, fb = ''): string => fromFile[k] ?? process.env[k]?.trim() ?? fb;

  const rawProvider = getVal('NC_AI_PROVIDER', 'openai').toLowerCase();
  const provider = rawProvider === 'anthropic' || rawProvider === 'claude'
    ? 'anthropic'
    : rawProvider === 'none' || rawProvider === 'off'
    ? 'none'
    : 'openai';

  const openaiKey = getVal('OPENAI_API_KEY');
  const anthropicKey = getVal('ANTHROPIC_API_KEY');
  const oMask = maskKey(openaiKey);
  const aMask = maskKey(anthropicKey);

  return {
    provider,
    openaiBaseUrl: getVal('OPENAI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
    openaiApiKeyMasked: oMask.masked,
    hasOpenaiApiKey: oMask.hasKey,
    anthropicApiKeyMasked: aMask.masked,
    hasAnthropicApiKey: aMask.hasKey,
    model: getVal('NC_AI_MODEL', 'gemini-flash-lite-latest'),
    fastModel: getVal('NC_AI_FAST_MODEL', 'gemini-flash-lite-latest'),
    imageModel: getVal('NC_AI_IMAGE_MODEL', 'gemini-flash-lite-latest'),
    allowedModels: getVal('NC_AI_ALLOWED_MODELS', 'gemini-flash-lite-latest'),
  };
}

export async function saveEnvConfig(patch: SaveAiEnvPatch): Promise<AiEnvConfig> {
  const current = parseEnvFile();
  const updates: Record<string, string> = {};

  if (patch.provider !== undefined) {
    updates.NC_AI_PROVIDER = patch.provider;
    process.env.NC_AI_PROVIDER = patch.provider;
  }

  if (patch.openaiBaseUrl !== undefined) {
    const url = patch.openaiBaseUrl.trim().replace(/\/+$/, '');
    updates.OPENAI_BASE_URL = url;
    process.env.OPENAI_BASE_URL = url;
  }

  if (patch.openaiApiKey !== undefined) {
    const key = patch.openaiApiKey.trim();
    // Only update if it is not a masked string
    if (key && !key.includes('...')) {
      updates.OPENAI_API_KEY = key;
      process.env.OPENAI_API_KEY = key;
    }
  }

  if (patch.anthropicApiKey !== undefined) {
    const key = patch.anthropicApiKey.trim();
    if (key && !key.includes('...')) {
      updates.ANTHROPIC_API_KEY = key;
      process.env.ANTHROPIC_API_KEY = key;
    }
  }

  if (patch.model !== undefined) {
    const m = patch.model.trim();
    updates.NC_AI_MODEL = m;
    process.env.NC_AI_MODEL = m;
  }

  if (patch.fastModel !== undefined) {
    const m = patch.fastModel.trim();
    updates.NC_AI_FAST_MODEL = m;
    process.env.NC_AI_FAST_MODEL = m;
  }

  if (patch.imageModel !== undefined) {
    const m = patch.imageModel.trim();
    updates.NC_AI_IMAGE_MODEL = m;
    process.env.NC_AI_IMAGE_MODEL = m;
  }

  if (patch.allowedModels !== undefined) {
    const m = patch.allowedModels.trim();
    updates.NC_AI_ALLOWED_MODELS = m;
    process.env.NC_AI_ALLOWED_MODELS = m;
  }

  updateEnvFile(ENV_LOCAL_PATH, updates);

  // Invalidate caches & sync live models immediately
  setOpenAIModelsFetch(null);
  resetClientCache();
  resetModelsCache();

  if (process.env.NC_AI_PROVIDER === 'openai') {
    void refreshOpenAIModels().catch(() => {});
  }

  return getEnvConfig();
}

export async function fetchProviderModels(provider: string, baseUrl?: string, apiKey?: string): Promise<{ id: string; name: string }[]> {
  if (provider === 'openai') {
    const current = parseEnvFile();
    const url = (baseUrl || current.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    let key = apiKey?.trim();
    if (!key || key.includes('...')) {
      key = current.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    }
    if (!key) throw new Error('API 키를 입력해주세요.');

    const res = await fetch(`${url}/models`, {
      headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`모델 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
    const json = await res.json();
    const models = parseOpenAIModels(json);
    return models.map((m) => ({ id: m.slug, name: m.displayName || m.slug }));
  }

  if (provider === 'anthropic') {
    return [
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' },
    ];
  }

  return [];
}
