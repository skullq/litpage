// Server AI Environment & Model Configuration component
// Reads from and saves to apps/server/.env.local via backend RPC.
import { useEffect, useState } from 'react';
import type { SpaceRecord } from '@nc/shared/records.ts';
import { api } from '../../lib/api.ts';
import { useUI } from '../../lib/store/ui.ts';
import { Icon } from '../../components/Icon.tsx';
import { Badge, Button, Dropdown, Group, Row } from '../settings/ui.tsx';
import { useAiStatus } from './aiApi.ts';

export interface AiEnvConfigData {
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

interface ProviderModel {
  id: string;
  name: string;
}

const PRESET_URLS = [
  { label: 'Google Gemini (OpenAI compat)', url: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { label: 'OpenAI Official', url: 'https://api.openai.com/v1' },
  { label: 'Groq Cloud', url: 'https://api.groq.com/openai/v1' },
  { label: 'Ollama (Local)', url: 'http://localhost:11434/v1' },
];

export function AiEnvSettings({ space, admin }: { space: SpaceRecord; admin: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'none'>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [keyMasked, setKeyMasked] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [model, setModel] = useState('');
  const [fastModel, setFastModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [allowedModels, setAllowedModels] = useState('');

  const [availableModels, setAvailableModels] = useState<ProviderModel[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api<AiEnvConfigData>('aiGetEnvConfig', { spaceId: space.id });
      setProvider(res.provider);
      setBaseUrl(res.openaiBaseUrl);
      setModel(res.model);
      setFastModel(res.fastModel);
      setImageModel(res.imageModel);
      setAllowedModels(res.allowedModels);

      if (res.provider === 'openai') {
        setHasExistingKey(res.hasOpenaiApiKey);
        setKeyMasked(res.openaiApiKeyMasked);
      } else if (res.provider === 'anthropic') {
        setHasExistingKey(res.hasAnthropicApiKey);
        setKeyMasked(res.anthropicApiKeyMasked);
      }
    } catch {
      // not admin or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) void load();
  }, [space.id, admin]);

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFetchError(null);
    try {
      const res = await api<{ ok: boolean; models: ProviderModel[] }>('aiFetchProviderModels', {
        spaceId: space.id,
        provider,
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      setAvailableModels(res.models);
      useUI.getState().toast(`${res.models.length}개 모델을 성공적으로 불러왔습니다.`);
    } catch (e: any) {
      setFetchError(e?.message || '모델 목록을 불러오지 못했습니다.');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Record<string, string | undefined> = {
        spaceId: space.id,
        provider,
        model: model.trim(),
        fastModel: fastModel.trim(),
        imageModel: imageModel.trim(),
        allowedModels: allowedModels.trim() || model.trim(),
      };

      if (provider === 'openai') {
        patch.openaiBaseUrl = baseUrl.trim();
        if (apiKey.trim()) patch.openaiApiKey = apiKey.trim();
      } else if (provider === 'anthropic') {
        if (apiKey.trim()) patch.anthropicApiKey = apiKey.trim();
      }

      await api('aiSaveEnvConfig', patch);
      useUI.getState().toast('AI 설정이 .env.local에 저장되고 즉시 적용되었습니다.');
      setShowKeyInput(false);
      setApiKey('');
      await load();
      await useAiStatus.getState().refresh();
    } catch (e: any) {
      useUI.getState().toast(`저장 실패: ${e?.message || '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!admin) return null;
  if (loading) {
    return (
      <Group plain title="AI 공급자 및 API 토큰 설정 (.env.local)">
        <div className="nc-set-row-desc">설정을 불러오는 중입니다...</div>
      </Group>
    );
  }

  const providerOptions = [
    { value: 'openai', label: 'OpenAI / Gemini / 호환 엔드포인트', description: 'Google Gemini, OpenAI, Groq, Ollama 등 호환 API 사용' },
    { value: 'anthropic', label: 'Anthropic Claude', description: 'Anthropic Claude API 직접 연동' },
    { value: 'none', label: '사용 안 함 (Disabled)', description: 'Litpage AI 비활성화' },
  ];

  return (
    <Group
      plain
      title="AI 공급자 및 API 토큰 설정 (.env.local)"
      description="API 키와 엔드포인트, 모델을 UI에서 설정하면 서버의 .env.local에 영구 저장되고 즉시 반영됩니다."
    >
      <Row
        id="ai-provider"
        label="AI 공급자 (Provider)"
        description="사용할 LLM 공급자 엔진을 선택합니다."
        control={(
          <Dropdown
            width={280}
            value={provider}
            options={providerOptions}
            onChange={(v) => {
              setProvider(v as any);
              setAvailableModels([]);
            }}
          />
        )}
      />

      {provider === 'openai' && (
        <Row
          id="ai-base-url"
          label="API Base URL"
          description="OpenAI 호환 엔드포인트 주소입니다. (기본: Google Gemini OpenAI Adapter)"
          control={(
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 340 }}>
              <input
                style={{ padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid var(--lp-border-subtle)', width: '100%' }}
                value={baseUrl}
                placeholder="https://..."
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {PRESET_URLS.map((p) => (
                  <button
                    key={p.url}
                    type="button"
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      border: '1px solid var(--lp-border-subtle)',
                      background: baseUrl === p.url ? 'var(--lp-tint-blue, #e1f0ff)' : 'var(--lp-bg-subtle, #f5f5f5)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setBaseUrl(p.url)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
      )}

      {provider !== 'none' && (
        <Row
          id="ai-api-key"
          label={provider === 'openai' ? 'API Key (OPENAI_API_KEY)' : 'Anthropic API Key'}
          description="LLM 공급자의 인증 토큰입니다. 보안을 위해 마스킹되며 서버 .env.local에 안전하게 저장됩니다."
          control={(
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, width: 340 }}>
              {!showKeyInput && hasExistingKey ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontSize: 12, padding: '3px 8px', background: 'var(--lp-bg-subtle, #f0f0f0)', borderRadius: 4 }}>
                    {keyMasked}
                  </code>
                  <Badge tone="blue">연결됨</Badge>
                  <Button small onClick={() => setShowKeyInput(true)}>변경</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <input
                    type="password"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid var(--lp-border-subtle)' }}
                    placeholder={hasExistingKey ? '새 API 키 입력 시 변경됨' : 'API 키 / 토큰 입력'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  {hasExistingKey && (
                    <Button small onClick={() => { setShowKeyInput(false); setApiKey(''); }}>취소</Button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <Button
                  small
                  icon={fetchingModels ? undefined : 'refresh'}
                  disabled={fetchingModels || (!hasExistingKey && !apiKey)}
                  onClick={handleFetchModels}
                >
                  {fetchingModels ? '모델 조회 중...' : '공급자 모델 목록 불러오기'}
                </Button>
              </div>
              {fetchError && (
                <div style={{ color: 'var(--lp-red, #da3633)', fontSize: 12, marginTop: 4 }}>
                  {fetchError}
                </div>
              )}
            </div>
          )}
        />
      )}

      {provider !== 'none' && (
        <>
          <Row
            id="ai-model"
            label="기본 텍스트 LLM (NC_AI_MODEL)"
            description="챗, 문서 작성, 인라인 편집에 사용할 기본 모델입니다."
            control={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 280 }}>
                {availableModels.length > 0 ? (
                  <Dropdown
                    width={280}
                    value={model}
                    options={availableModels.map((m) => ({ value: m.id, label: m.name }))}
                    onChange={(v) => {
                      setModel(v);
                      if (!allowedModels) setAllowedModels(v);
                    }}
                  />
                ) : (
                  <input
                    style={{ padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid var(--lp-border-subtle)' }}
                    placeholder="예: gemini-flash-lite-latest, gpt-4o"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                )}
              </div>
            )}
          />

          <Row
            id="ai-fast-model"
            label="빠른 작업용 LLM (NC_AI_FAST_MODEL)"
            description="제목 생성, 수식 보조 등 가벼운 작업을 위한 고속 모델입니다."
            control={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 280 }}>
                {availableModels.length > 0 ? (
                  <Dropdown
                    width={280}
                    value={fastModel}
                    options={availableModels.map((m) => ({ value: m.id, label: m.name }))}
                    onChange={(v) => setFastModel(v)}
                  />
                ) : (
                  <input
                    style={{ padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid var(--lp-border-subtle)' }}
                    placeholder="예: gemini-flash-lite-latest, gpt-4o-mini"
                    value={fastModel}
                    onChange={(e) => setFastModel(e.target.value)}
                  />
                )}
              </div>
            )}
          />

          <Row
            id="ai-image-model"
            label="이미지 생성 전용 LLM (NC_AI_IMAGE_MODEL)"
            description="SVG 및 다이어그램 생성 전용 모델입니다. 일반 텍스트 모델과 분리하여 지정할 수 있습니다."
            control={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 280 }}>
                {availableModels.length > 0 ? (
                  <Dropdown
                    width={280}
                    value={imageModel}
                    options={availableModels.map((m) => ({ value: m.id, label: m.name }))}
                    onChange={(v) => setImageModel(v)}
                  />
                ) : (
                  <input
                    style={{ padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid var(--lp-border-subtle)' }}
                    placeholder="예: gemini-flash-lite-latest, gemini-2.5-flash"
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                  />
                )}
              </div>
            )}
          />

          <Row
            id="ai-allowed-models"
            label="허용 모델 목록 (NC_AI_ALLOWED_MODELS)"
            description="워크스페이스 사용자에게 노출할 모델 목록입니다. 콤마(,)로 구분합니다."
            control={(
              <div style={{ width: 280 }}>
                <input
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid var(--lp-border-subtle)' }}
                  placeholder="예: gemini-flash-lite-latest"
                  value={allowedModels}
                  onChange={(e) => setAllowedModels(e.target.value)}
                />
              </div>
            )}
          />
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--lp-border-subtle)' }}>
        <Button
          variant="primary"
          icon="check"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? '저장 및 적용 중...' : '.env.local에 저장 및 즉시 적용'}
        </Button>
      </div>
    </Group>
  );
}
