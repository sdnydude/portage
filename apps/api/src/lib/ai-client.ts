import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { observeOpenAI } from '@langfuse/openai';
import { env } from './env.js';
import { createLogger } from './logger.js';
import { AppError } from '../middleware/error.js';

const logger = createLogger('ai-client');

const MAX_TOOL_ITERATIONS = 10;

// ─── Client singletons ────────────────────────────────────

const anthropicClients = new Map<string, Anthropic>();
const openaiClients = new Map<string, OpenAI>();

function getAnthropicClient(config: ProviderConfig): Anthropic {
  let client = anthropicClients.get(config.name);
  if (!client) {
    client = new Anthropic({ apiKey: config.apiKey });
    anthropicClients.set(config.name, client);
  }
  return client;
}

function getOpenAIClient(config: ProviderConfig, purpose?: string): OpenAI {
  // One wrapped client per provider+purpose: observeOpenAI fixes the Langfuse
  // generation name at wrap time, so per-purpose names need distinct wrappers.
  const key = purpose ? `${config.name}:${purpose}` : config.name;
  let client = openaiClients.get(key);
  if (!client) {
    // observeOpenAI emits a Langfuse `generation` per call with model, tokens,
    // and cost. Gemini and the local models run through the OpenAI-compat API,
    // so this covers them too. No-op when tracing is off. Anthropic gets the
    // same treatment via the OpenInference patch in instrumentation.ts.
    client = observeOpenAI(
      new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl }),
      purpose ? { generationName: purpose } : undefined,
    );
    openaiClients.set(key, client);
  }
  return client;
}

// ─── Provider chain ────────────────────────────────────────

interface ProviderConfig {
  name: string;
  type: 'openai' | 'anthropic';
  apiKey: string;
  baseUrl?: string;
  visionModel: string;
  chatModel: string;
  /** OpenAI-compat reasoning_effort; 'none' on Gemini disables thinking (its tokens otherwise truncate JSON vision output). */
  reasoningEffort?: string;
}

function resolveProvider(name: string): ProviderConfig | null {
  const c = env();
  switch (name) {
    case 'local':
      if (!c.LOCAL_LLM_BASE_URL) return null;
      return {
        name: 'local',
        type: 'openai',
        apiKey: c.LOCAL_LLM_API_KEY,
        baseUrl: c.LOCAL_LLM_BASE_URL,
        visionModel: c.LOCAL_LLM_VISION_MODEL,
        chatModel: c.LOCAL_LLM_CHAT_MODEL,
      };
    case 'gemini':
      if (!c.GEMINI_API_KEY) return null;
      return {
        name: 'gemini',
        type: 'openai',
        apiKey: c.GEMINI_API_KEY,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        visionModel: c.GEMINI_VISION_MODEL,
        chatModel: c.GEMINI_CHAT_MODEL,
        reasoningEffort: 'none',
      };
    case 'openai':
      if (!c.OPENAI_API_KEY) return null;
      return {
        name: 'openai',
        type: 'openai',
        apiKey: c.OPENAI_API_KEY,
        visionModel: c.OPENAI_VISION_MODEL,
        chatModel: c.OPENAI_CHAT_MODEL,
      };
    case 'huggingface':
      if (!c.HUGGINGFACE_API_KEY) return null;
      return {
        name: 'huggingface',
        type: 'openai',
        apiKey: c.HUGGINGFACE_API_KEY,
        baseUrl: c.HUGGINGFACE_BASE_URL,
        visionModel: c.HUGGINGFACE_VISION_MODEL,
        chatModel: c.HUGGINGFACE_CHAT_MODEL,
      };
    case 'anthropic':
      if (!c.ANTHROPIC_API_KEY) return null;
      return {
        name: 'anthropic',
        type: 'anthropic',
        apiKey: c.ANTHROPIC_API_KEY,
        visionModel: 'claude-sonnet-4-6',
        chatModel: 'claude-sonnet-4-6',
      };
    default:
      logger.warn({ provider: name }, 'Unknown provider, skipping');
      return null;
  }
}

function buildChain(envVar: string): ProviderConfig[] {
  const entries = envVar.split(',').map(s => s.trim()).filter(Boolean);
  const chain: ProviderConfig[] = [];

  for (const entry of entries) {
    const sep = entry.indexOf(':');
    const name = (sep >= 0 ? entry.slice(0, sep) : entry).toLowerCase();
    const provider = resolveProvider(name);
    if (provider) {
      // "provider:model" overrides the model for this chain entry (lets a chain
      // hold multiple models of one provider, e.g. 3.5-flash → 2.5-flash). Both
      // fields are set; the vision chain reads visionModel, chat reads chatModel.
      if (sep >= 0) {
        const model = entry.slice(sep + 1).trim();
        provider.visionModel = model;
        provider.chatModel = model;
      }
      chain.push(provider);
    }
  }

  if (chain.length === 0) {
    throw new AppError(503, 'AI_UNAVAILABLE', 'No AI providers configured — check provider list and API keys in .env');
  }

  return chain;
}

function visionChain(): ProviderConfig[] {
  return buildChain(env().VISION_PROVIDERS);
}

function chatChain(): ProviderConfig[] {
  return buildChain(env().CHAT_PROVIDERS);
}

// ─── Shared options ────────────────────────────────────────

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  /** Runs on each provider's final text before it is accepted; throw to treat
   *  the response as a provider failure. Vision chains (analyzeImage /
   *  analyzeImages) fail over immediately (schema-drift blind spot,
   *  gemini-3.5-flash weight-as-number, live outage 2026-08-05). The
   *  non-streaming chat path retries the same provider once before failing
   *  over (Porter grounding, 2026-08-10). chatStream ignores it — streaming
   *  cannot fail over post-stream; porter.ts orchestrates retries instead. */
  validate?: (text: string) => void;
  /** Restrict the chat chain to this provider name (porter grounding retries
   *  force 'gemini'). Falls back to the full chain if the name doesn't match
   *  any configured provider. */
  forceProvider?: string;
  /** Langfuse generation name for this call site (porter-chat / scan-vision /
   *  prepare-listing). OpenAI-compat providers only — Anthropic is traced via
   *  the OpenInference patch in instrumentation.ts. */
  purpose?: string;
}

// ─── Vision: image → structured text ───────────────────────

export async function analyzeImage(
  imageBase64: string,
  mediaType: string,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<{ text: string; provider: string; model: string; inputTokens: number; outputTokens: number }> {
  const chain = visionChain();
  const startTime = Date.now();

  for (let i = 0; i < chain.length; i++) {
    const config = chain[i];
    try {
      const result = config.type === 'openai'
        ? await visionOpenAI(config, imageBase64, mediaType, systemPrompt, userPrompt, options)
        : await visionAnthropic(config, imageBase64, mediaType, systemPrompt, userPrompt, options);

      // Schema-invalid 200s fail over like call failures (drift blind spot).
      options?.validate?.(result.text);

      logger.info({
        provider: config.name,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        elapsed: Date.now() - startTime,
        fallbacks: i,
      }, 'Vision analysis complete');

      return { ...result, provider: config.name };
    } catch (err) {
      logger.warn({ provider: config.name, error: (err as Error).message }, 'Vision provider failed');
      if (i === chain.length - 1) throw err;
    }
  }

  throw new Error('All vision providers failed');
}

async function visionAnthropic(
  config: ProviderConfig,
  imageBase64: string,
  mediaType: string,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
) {
  const client = getAnthropicClient(config);

  const response = await client.messages.create({
    model: config.visionModel,
    max_tokens: options?.maxTokens ?? 1024,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: imageBase64,
          },
        },
        { type: 'text', text: userPrompt },
      ],
    }],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error(`Unexpected Anthropic response: content[0] type was '${firstBlock?.type ?? 'undefined'}', stop_reason was '${response.stop_reason}'`);
  }
  return {
    text: firstBlock.text,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function visionOpenAI(
  config: ProviderConfig,
  imageBase64: string,
  mediaType: string,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
) {
  const client = getOpenAIClient(config, options?.purpose);

  const response = await client.chat.completions.create({
    model: config.visionModel,
    max_tokens: options?.maxTokens ?? 1024,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    // Gemini-only: 'none' disables thinking so its tokens don't truncate the JSON output.
    ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort as 'low' } : {}),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  });

  return {
    text: response.choices[0]?.message?.content || '',
    model: response.model || config.visionModel,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}

// ─── Multi-image vision ────────────────────────────────────

export interface ImageInput {
  base64: string;
  mediaType: string;
}

export async function analyzeImages(
  images: ImageInput[],
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<{ text: string; provider: string; model: string; inputTokens: number; outputTokens: number }> {
  const chain = visionChain();
  const startTime = Date.now();

  for (let i = 0; i < chain.length; i++) {
    const config = chain[i];
    try {
      const result = config.type === 'openai'
        ? await visionMultiOpenAI(config, images, systemPrompt, userPrompt, options)
        : await visionMultiAnthropic(config, images, systemPrompt, userPrompt, options);

      // Schema-invalid 200s fail over like call failures (drift blind spot).
      options?.validate?.(result.text);

      logger.info({
        provider: config.name,
        model: result.model,
        imageCount: images.length,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        elapsed: Date.now() - startTime,
        fallbacks: i,
      }, 'Multi-image vision analysis complete');

      return { ...result, provider: config.name };
    } catch (err) {
      logger.warn({ provider: config.name, error: (err as Error).message }, 'Vision provider failed');
      if (i === chain.length - 1) throw err;
    }
  }

  throw new Error('All vision providers failed');
}

async function visionMultiAnthropic(
  config: ProviderConfig,
  images: ImageInput[],
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
) {
  const client = getAnthropicClient(config);

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: img.base64,
    },
  }));

  const response = await client.messages.create({
    model: config.visionModel,
    max_tokens: options?.maxTokens ?? 4096,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: userPrompt },
      ],
    }],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error(`Unexpected Anthropic response: content[0] type was '${firstBlock?.type ?? 'undefined'}', stop_reason was '${response.stop_reason}'`);
  }
  return {
    text: firstBlock.text,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function visionMultiOpenAI(
  config: ProviderConfig,
  images: ImageInput[],
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
) {
  const client = getOpenAIClient(config, options?.purpose);

  const imageBlocks = images.map(img => ({
    type: 'image_url' as const,
    image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
  }));

  const response = await client.chat.completions.create({
    model: config.visionModel,
    max_tokens: options?.maxTokens ?? 4096,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    // Gemini-only: 'none' disables thinking so its tokens don't truncate the JSON output.
    // Cast: 'none' is valid for Gemini's OpenAI-compat endpoint but absent from the SDK's literal union.
    ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort as 'low' } : {}),
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text' as const, text: userPrompt },
        ],
      },
    ],
  });

  return {
    text: response.choices[0]?.message?.content || '',
    model: response.model || config.visionModel,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}

// ─── Streaming chat ───────────────────────────────────────

export interface StreamToolResult {
  text: string;
  structured?: unknown;
}

export type PorterStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; toolId: string; toolName: string }
  | { type: 'tool_result'; toolId: string; toolName: string; structured?: unknown }
  | { type: 'done'; model: string; inputTokens: number; outputTokens: number };

/** Flatten Anthropic message content to plain text (Porter sends text-only history). */
function messageContentToText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('');
}

export async function chatStream(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  tools: ToolDef[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<StreamToolResult>,
  onEvent: (event: PorterStreamEvent) => void,
  options?: AIOptions,
): Promise<void> {
  // Empty-chain case: chatChain() → buildChain() throws AppError 503 AI_UNAVAILABLE.
  const fullChain = chatChain();
  const forced = options?.forceProvider
    ? fullChain.filter(c => c.name === options.forceProvider)
    : fullChain;
  if (options?.forceProvider && forced.length === 0) {
    logger.warn({ forceProvider: options.forceProvider }, 'forceProvider not in CHAT_PROVIDERS — falling back to full chain');
  }
  const chain = forced.length > 0 ? forced : fullChain;

  // Once any token reaches the client, a mid-stream failure must NOT fall back —
  // re-streaming a second provider would double-emit. Fall back only before the
  // first event (auth/connection failures).
  let started = false;
  const guardedEvent = (event: PorterStreamEvent) => {
    started = true;
    onEvent(event);
  };

  const startTime = Date.now();
  for (let i = 0; i < chain.length; i++) {
    const config = chain[i];
    try {
      if (config.type === 'openai') {
        await chatStreamOpenAI(config, messages, systemPrompt, tools, executeTool, guardedEvent, options);
      } else {
        await chatStreamAnthropic(config, messages, systemPrompt, tools, executeTool, guardedEvent, options);
      }
      logger.info({ provider: config.name, elapsed: Date.now() - startTime, fallbacks: i }, 'Chat stream complete');
      return;
    } catch (err) {
      if (started) throw err; // mid-stream — surface to the client, no fallback
      logger.warn({ provider: config.name, error: (err as Error).message }, 'Chat stream provider failed, trying next');
      if (i === chain.length - 1) throw err;
    }
  }
}

async function chatStreamAnthropic(
  config: ProviderConfig,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  tools: ToolDef[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<StreamToolResult>,
  onEvent: (event: PorterStreamEvent) => void,
  options?: AIOptions,
): Promise<void> {
  const client = getAnthropicClient(config);

  const anthropicTools: Anthropic.Tool[] = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const currentMessages: Anthropic.MessageParam[] = [...messages];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    const stream = client.messages.stream({
      model: config.chatModel,
      max_tokens: options?.maxTokens ?? 4096,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      system: systemPrompt,
      tools: anthropicTools,
      messages: currentMessages,
    });

    stream.on('text', (textDelta: string) => {
      onEvent({ type: 'text_delta', text: textDelta });
    });

    stream.on('contentBlock', (block: Anthropic.ContentBlock) => {
      if (block.type === 'tool_use') {
        onEvent({ type: 'tool_start', toolId: block.id, toolName: block.name });
        toolUseBlocks.push(block);
      }
    });

    const message = await stream.finalMessage();

    if (message.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      onEvent({
        type: 'done',
        model: message.model,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      });
      return;
    }

    if (iteration + 1 >= MAX_TOOL_ITERATIONS) {
      logger.error({ iterations: iteration + 1 }, 'chatStream tool-use loop hit iteration cap');
      throw new AppError(500, 'AI_LOOP_CAP', 'The AI assistant got stuck in a loop. Please try rephrasing your question.');
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
      onEvent({ type: 'tool_result', toolId: toolUse.id, toolName: toolUse.name, structured: result.structured });
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result.text });
    }

    currentMessages.push({ role: 'assistant', content: message.content });
    currentMessages.push({ role: 'user', content: toolResults });
  }
}

async function chatStreamOpenAI(
  config: ProviderConfig,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  tools: ToolDef[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<StreamToolResult>,
  onEvent: (event: PorterStreamEvent) => void,
  options?: AIOptions,
): Promise<void> {
  const client = getOpenAIClient(config, options?.purpose);

  const openaiTools: OpenAI.ChatCompletionTool[] = tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const convMsgs: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m): OpenAI.ChatCompletionMessageParam => ({
      role: m.role,
      content: messageContentToText(m.content),
    })),
  ];

  const maxTokens = options?.maxTokens ?? 4096;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = await client.chat.completions.create({
      model: config.chatModel,
      max_tokens: maxTokens,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort as 'low' } : {}),
      tools: openaiTools,
      messages: convMsgs,
      stream: true,
      stream_options: { include_usage: true },
    });

    // Tool calls arrive as indexed deltas (id / name / argument fragments) that
    // must be concatenated by index across chunks.
    const toolAcc: Record<number, { id: string; name: string; args: string }> = {};
    let assistantText = '';
    let finishReason: string | null = null;
    let model = config.chatModel;
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      if (chunk.model) model = chunk.model;
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta;
      if (delta?.content) {
        assistantText += delta.content;
        onEvent({ type: 'text_delta', text: delta.content });
      }
      for (const tc of delta?.tool_calls ?? []) {
        const idx = tc.index;
        if (!toolAcc[idx]) toolAcc[idx] = { id: tc.id ?? '', name: '', args: '' };
        if (tc.id) toolAcc[idx].id = tc.id;
        if (tc.function?.name) toolAcc[idx].name += tc.function.name;
        if (tc.function?.arguments) toolAcc[idx].args += tc.function.arguments;
      }
    }

    const toolCalls = Object.values(toolAcc);
    if (finishReason !== 'tool_calls' || toolCalls.length === 0) {
      if (!assistantText) {
        // Blank streamed reply (same class as chatOpenAI's guard): fail the
        // call so the provider chain / porter retry loop can recover.
        throw new Error(`Empty chat response from ${config.chatModel}`);
      }
      onEvent({ type: 'done', model, inputTokens, outputTokens });
      return;
    }

    if (iteration + 1 >= MAX_TOOL_ITERATIONS) {
      logger.error({ iterations: iteration + 1, model }, 'chatStream (openai) tool-use loop hit iteration cap');
      throw new AppError(500, 'AI_LOOP_CAP', 'The AI assistant got stuck in a loop. Please try rephrasing your question.');
    }

    convMsgs.push({
      role: 'assistant',
      content: assistantText || null,
      tool_calls: toolCalls.map(t => ({
        id: t.id,
        type: 'function' as const,
        function: { name: t.name, arguments: t.args },
      })),
    });

    for (const t of toolCalls) {
      onEvent({ type: 'tool_start', toolId: t.id, toolName: t.name });
      const input = t.args ? (JSON.parse(t.args) as Record<string, unknown>) : {};
      const result = await executeTool(t.name, input);
      onEvent({ type: 'tool_result', toolId: t.id, toolName: t.name, structured: result.structured });
      convMsgs.push({ role: 'tool', tool_call_id: t.id, content: result.text });
    }
  }
}

// ─── Text-only: systemPrompt + userPrompt → text ─────────

export async function chatText(
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<{ text: string; provider: string; model: string }> {
  return chat(
    [{ role: 'user', content: userPrompt }],
    systemPrompt,
    [],
    async () => '',
    options,
  );
}

// ─── Chat: text + tools → text (with tool loop) ───────────

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export async function chat(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  tools: ToolDef[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>,
  options?: AIOptions,
): Promise<{ text: string; provider: string; model: string }> {
  const fullChain = chatChain();
  const forced = options?.forceProvider
    ? fullChain.filter(c => c.name === options.forceProvider)
    : fullChain;
  if (options?.forceProvider && forced.length === 0) {
    logger.warn({ forceProvider: options.forceProvider }, 'forceProvider not in CHAT_PROVIDERS — falling back to full chain');
  }
  const chain = forced.length > 0 ? forced : fullChain;
  const startTime = Date.now();

  for (let i = 0; i < chain.length; i++) {
    const config = chain[i];
    try {
      const call = () => config.type === 'openai'
        ? chatOpenAI(config, history, systemPrompt, tools, executeTool, options)
        : chatAnthropic(config, history, systemPrompt, tools, executeTool, options);

      let result = await call();
      if (options?.validate) {
        try {
          options.validate(result.text);
        } catch (vErr) {
          // Grounding mismatch: one same-provider retry before failing over.
          logger.warn({ provider: config.name, error: (vErr as Error).message }, 'Chat validation failed, retrying provider once');
          result = await call();
          options.validate(result.text);
        }
      }

      logger.info({
        provider: config.name,
        model: result.model,
        elapsed: Date.now() - startTime,
        fallbacks: i,
      }, 'Chat complete');

      return { ...result, provider: config.name };
    } catch (err) {
      logger.warn({ provider: config.name, error: (err as Error).message }, 'Chat provider failed');
      if (i === chain.length - 1) throw err;
    }
  }

  // Unreachable: the loop always returns or rethrows on the last provider.
  throw new Error('All chat providers failed');
}

async function chatAnthropic(
  config: ProviderConfig,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  tools: ToolDef[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>,
  options?: AIOptions,
): Promise<{ text: string; model: string }> {
  const client = getAnthropicClient(config);

  const anthropicTools: Anthropic.Tool[] = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const maxTokens = options?.maxTokens ?? 1024;

  let response = await client.messages.create({
    model: config.chatModel,
    max_tokens: maxTokens,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    system: systemPrompt,
    tools: anthropicTools,
    messages,
  });

  let iterations = 0;
  while (response.stop_reason === 'tool_use') {
    if (++iterations > MAX_TOOL_ITERATIONS) {
      logger.error({ iterations, model: config.chatModel }, 'Tool-use loop hit iteration cap — aborting');
      throw new AppError(500, 'AI_LOOP_CAP', 'The AI assistant got stuck in a loop. Please try rephrasing your question.');
    }

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
    }

    messages.push({ role: 'assistant', content: response.content as unknown as string });
    messages.push({ role: 'user', content: toolResults as unknown as string });

    response = await client.messages.create({
      model: config.chatModel,
      max_tokens: maxTokens,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      system: systemPrompt,
      tools: anthropicTools,
      messages,
    });
  }

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );

  return {
    text: textBlocks.map(b => b.text).join('\n'),
    model: response.model,
  };
}

async function chatOpenAI(
  config: ProviderConfig,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  tools: ToolDef[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>,
  options?: AIOptions,
): Promise<{ text: string; model: string }> {
  const client = getOpenAIClient(config, options?.purpose);

  const openaiTools: OpenAI.ChatCompletionTool[] = tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m): OpenAI.ChatCompletionMessageParam => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const maxTokens = options?.maxTokens ?? 1024;

  let response = await client.chat.completions.create({
    model: config.chatModel,
    max_tokens: maxTokens,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort as 'low' } : {}),
    // No-tools (chatText) calls are structured text generation — force JSON
    // mode. Never combined with tools (P7 3b00baeb, Lever A hardening).
    ...(openaiTools.length === 0 ? { response_format: { type: 'json_object' as const } } : {}),
    tools: openaiTools,
    messages,
  });

  let iterations = 0;
  while (response.choices[0]?.finish_reason === 'tool_calls') {
    if (++iterations > MAX_TOOL_ITERATIONS) {
      logger.error({ iterations, model: config.chatModel }, 'Tool-use loop hit iteration cap — aborting');
      throw new AppError(500, 'AI_LOOP_CAP', 'The AI assistant got stuck in a loop. Please try rephrasing your question.');
    }

    const assistantMsg = response.choices[0].message;
    messages.push(assistantMsg);

    for (const toolCall of assistantMsg.tool_calls || []) {
      if (toolCall.type !== 'function') continue;
      const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      const result = await executeTool(toolCall.function.name, input);
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
    }

    response = await client.chat.completions.create({
      model: config.chatModel,
      max_tokens: maxTokens,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort as 'low' } : {}),
      tools: openaiTools,
      messages,
    });
  }

  const text = response.choices[0]?.message?.content;
  if (!text) {
    // Blank reply (seen on reasoning models when reasoning_effort is unset):
    // treat as a failed call so chat() advances down the provider chain.
    throw new Error(`Empty chat response from ${config.chatModel}`);
  }

  return {
    text,
    model: response.model || config.chatModel,
  };
}
