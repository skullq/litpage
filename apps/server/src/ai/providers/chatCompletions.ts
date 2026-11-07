// Adapter for OpenAI-compatible Chat Completions API (POST {baseUrl}/chat/completions).
// Used for providers that don't support the newer OpenAI Responses API (e.g. Google Gemini, Ollama, vLLM, Groq).
// Translates Anthropic Messages streaming interface (ClaudeLike) to Chat Completions SSE.
import { readSse } from './sse.ts';
import { abortError, AiError, ProviderError } from './errors.ts';
import { scrub, type OpenAIConfig } from './config.ts';

type Json = Record<string, any>;

// Cache thought_signature / extra_content by tool_call id for Gemini 3+ tool round-trips
const extraContentCache = new Map<string, Json>();

export function translateToChatCompletions(params: Json): Json {
  const messages: Json[] = [];

  // 1. System prompt
  if (params.system) {
    let sysText = '';
    if (typeof params.system === 'string') {
      sysText = params.system;
    } else if (Array.isArray(params.system)) {
      sysText = params.system.map((b: any) => (typeof b === 'string' ? b : b?.text ?? '')).filter(Boolean).join('\n\n');
    }
    if (sysText) {
      messages.push({ role: 'system', content: sysText });
    }
  }

  // 2. Conversation messages
  if (Array.isArray(params.messages)) {
    for (const msg of params.messages) {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      if (typeof msg.content === 'string') {
        messages.push({ role, content: msg.content });
        continue;
      }
      if (Array.isArray(msg.content)) {
        const contentParts: Json[] = [];
        const toolCalls: Json[] = [];
        let hasImage = false;

        for (const block of msg.content) {
          if (!block || typeof block !== 'object') continue;
          if (block.type === 'text' && typeof block.text === 'string') {
            contentParts.push({ type: 'text', text: block.text });
          } else if (block.type === 'image' && block.source) {
            hasImage = true;
            const src = block.source;
            const url =
              src.type === 'base64'
                ? `data:${src.media_type || 'image/png'};base64,${src.data}`
                : src.url;
            if (url) {
              contentParts.push({ type: 'image_url', image_url: { url } });
            }
          } else if (block.type === 'tool_use') {
            const tc: Json = {
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input ?? {}),
              },
            };
            const cachedExtra = extraContentCache.get(block.id);
            if (cachedExtra) {
              tc.extra_content = cachedExtra;
            }
            toolCalls.push(tc);
          } else if (block.type === 'tool_result') {
            if (contentParts.length) {
              messages.push({
                role: 'user',
                content: hasImage ? [...contentParts] : contentParts.map((p) => p.text).join('\n\n'),
              });
              contentParts.length = 0;
              hasImage = false;
            }
            const resContent = Array.isArray(block.content)
              ? block.content.map((c: any) => (typeof c === 'string' ? c : c?.text ?? JSON.stringify(c))).join('\n')
              : typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content ?? '');
            messages.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: resContent || 'ok',
            });
          }
        }

        if (contentParts.length || toolCalls.length) {
          const entry: Json = { role };
          if (contentParts.length) {
            entry.content = hasImage ? contentParts : contentParts.map((p) => p.text).join('\n\n');
          } else if (role === 'assistant' && toolCalls.length) {
            entry.content = null;
          }
          if (toolCalls.length) {
            entry.tool_calls = toolCalls;
            const firstExtra = extraContentCache.get(toolCalls[0].id);
            if (firstExtra) entry.extra_content = firstExtra;
          }
          messages.push(entry);
        }
      }
    }
  }

  // Client tools (exclude server tools without input_schema)
  const clientTools = Array.isArray(params.tools)
    ? params.tools.filter((t: any) => t && typeof t === 'object' && t.name && t.input_schema)
    : [];

  const body: Json = {
    model: params.model,
    messages,
    stream: true,
  };

  if (clientTools.length) {
    body.tools = clientTools.map((t: any) => {
      const schema = { ...t.input_schema };
      delete schema.additionalProperties;
      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description || undefined,
          parameters: schema,
        },
      };
    });
  }

  if (typeof params.temperature === 'number') body.temperature = params.temperature;

  return body;
}

export class ChatCompletionsMessageStream {
  private cfg: OpenAIConfig;
  private params: Json;
  private signal?: AbortSignal;
  private customFetch?: typeof fetch;
  private gen: AsyncGenerator<Json> | null = null;
  private final: Json | null = null;
  private failure: unknown = null;

  constructor(cfg: OpenAIConfig, params: Json, signal: AbortSignal | undefined, customFetch?: typeof fetch) {
    this.cfg = cfg;
    this.params = params;
    this.signal = signal;
    this.customFetch = customFetch;
  }

  [Symbol.asyncIterator](): AsyncGenerator<Json> {
    if (!this.gen) this.gen = this.run();
    return this.gen;
  }

  async finalMessage(): Promise<Json> {
    if (!this.final && !this.failure) {
      const it = this[Symbol.asyncIterator]();
      try {
        while (!(await it.next()).done) { /* drain */ }
      } catch (e) {
        this.failure ??= e;
      }
    }
    if (this.failure) throw this.failure;
    return this.final!;
  }

  private async *run(): AsyncGenerator<Json> {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    this.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const reqBody = translateToChatCompletions(this.params);
      let res: Response;
      try {
        res = await (this.customFetch ?? fetch)(`${this.cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.cfg.apiKey}`,
            'content-type': 'application/json',
            accept: 'text/event-stream',
          },
          body: JSON.stringify(reqBody),
          signal: ac.signal,
        });
      } catch (e) {
        if (this.signal?.aborted) throw abortError();
        throw new ProviderError('network', 'Couldn’t reach the AI provider. Check network connection.', 502, { detail: scrub(String(e)) });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let payload: any = text;
        try { payload = JSON.parse(text); } catch {}
        const errObj = Array.isArray(payload) ? payload[0]?.error : payload?.error;
        const msg = errObj?.message || (typeof payload === 'string' ? payload : 'Unknown AI error');
        throw new ProviderError('bad_request', `AI provider error (${res.status}): ${scrub(msg)}`, res.status >= 400 && res.status < 600 ? res.status : 500, { detail: scrub(msg) });
      }

      if (!res.body) {
        throw new ProviderError('unknown', 'Empty response body from AI provider.', 502);
      }

      let textIndex = -1;
      let textActive = false;
      let fullText = '';
      const toolMap = new Map<number, { id: string; name: string; args: string; blockIndex: number; extra?: Json }>();
      let lastExtraContent: Json | undefined;
      let nextBlockIndex = 0;
      let stopReason = 'end_turn';
      let inputTokens = 0;
      let outputTokens = 0;
      let model = this.params.model || 'unknown';

      for await (const ev of readSse(res.body as unknown as AsyncIterable<Uint8Array>)) {
        if (!ev.data || ev.data === '[DONE]') continue;
        let data: Json;
        try {
          data = JSON.parse(ev.data);
        } catch {
          continue;
        }

        if (data.model) model = data.model;
        if (data.usage) {
          if (typeof data.usage.prompt_tokens === 'number') inputTokens = data.usage.prompt_tokens;
          if (typeof data.usage.completion_tokens === 'number') outputTokens = data.usage.completion_tokens;
        }

        const choice = data.choices?.[0];
        if (!choice) continue;

        if (choice.finish_reason) {
          if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use';
          else if (choice.finish_reason === 'length') stopReason = 'max_tokens';
          else stopReason = 'end_turn';
        }

        const delta = choice.delta;
        if (!delta) continue;

        if (delta.extra_content) {
          lastExtraContent = delta.extra_content;
        }

        // Text delta
        if (typeof delta.content === 'string' && delta.content) {
          if (!textActive) {
            textActive = true;
            textIndex = nextBlockIndex++;
            yield {
              type: 'content_block_start',
              index: textIndex,
              content_block: { type: 'text', text: '' },
            };
          }
          fullText += delta.content;
          yield {
            type: 'content_block_delta',
            index: textIndex,
            delta: { type: 'text_delta', text: delta.content },
          };
        }

        // Tool calls delta
        if (Array.isArray(delta.tool_calls)) {
          if (textActive) {
            textActive = false;
            yield { type: 'content_block_stop', index: textIndex };
          }

          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let current = toolMap.get(idx);
            if (!current) {
              const bIdx = nextBlockIndex++;
              current = {
                id: tc.id || `call_${Date.now()}_${bIdx}`,
                name: tc.function?.name || '',
                args: '',
                blockIndex: bIdx,
                extra: tc.extra_content || delta.extra_content || lastExtraContent,
              };
              toolMap.set(idx, current);
              yield {
                type: 'content_block_start',
                index: bIdx,
                content_block: { type: 'tool_use', id: current.id, name: current.name, input: {} },
              };
            }
            if (tc.extra_content) current.extra = tc.extra_content;
            if (tc.function?.name && !current.name) current.name = tc.function.name;
            if (tc.function?.arguments) {
              current.args += tc.function.arguments;
              yield {
                type: 'content_block_delta',
                index: current.blockIndex,
                delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
              };
            }
          }
        }
      }

      if (textActive) {
        textActive = false;
        yield { type: 'content_block_stop', index: textIndex };
      }
      for (const t of toolMap.values()) {
        if (!t.extra && lastExtraContent) t.extra = lastExtraContent;
        if (t.extra) extraContentCache.set(t.id, t.extra);
        yield { type: 'content_block_stop', index: t.blockIndex };
      }

      if (toolMap.size > 0) {
        stopReason = 'tool_use';
      }

      if (!outputTokens) {
        outputTokens = Math.max(1, Math.round(fullText.length / 3));
      }

      yield {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: outputTokens },
      };
      yield { type: 'message_stop' };

      const finalContent: Json[] = [];
      if (fullText) {
        finalContent.push({ type: 'text', text: fullText });
      }
      for (const t of toolMap.values()) {
        let parsedInput: Json = {};
        try { parsedInput = JSON.parse(t.args); } catch {}
        finalContent.push({ type: 'tool_use', id: t.id, name: t.name, input: parsedInput });
      }

      this.final = {
        id: `chatcmpl_${Date.now()}`,
        role: 'assistant',
        content: finalContent,
        model,
        stop_reason: stopReason,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      };
    } catch (e) {
      this.failure = this.signal?.aborted && !(e instanceof AiError && e.code === 'aborted') ? abortError() : e;
      throw this.failure;
    } finally {
      this.signal?.removeEventListener('abort', onAbort);
    }
  }
}
