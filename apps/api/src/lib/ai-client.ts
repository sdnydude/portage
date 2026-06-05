import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
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

function getOpenAIClient(config: ProviderConfig): OpenAI {
  let client = openaiClients.get(config.name);
  if (!client) {
    client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    openaiClients.set(config.name, client);
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
        visionModel: 'claude-sonnet-4-20250514',
        chatModel: 'claude-sonnet-4-20250514',
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
      // "provider:model" overrides the vision model for this chain entry
      // (lets the chain hold multiple Gemini models, e.g. 3.5-flash → 2.5-flash).
      if (sep >= 0) provider.visionModel = entry.slice(sep + 1).trim();
      chain.push(provider);
    }
  }

  if (chain.length === 0) {
    throw new Error(`No AI providers configured — check provider list and API keys in .env`);
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
  const client = getOpenAIClient(config);

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
  const client = getOpenAIClient(config);

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

export async function chatStream(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  tools: ToolDef[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<StreamToolResult>,
  onEvent: (event: PorterStreamEvent) => void,
  options?: AIOptions,
): Promise<void> {
  const c = env();
  if (!c.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'AI_UNAVAILABLE', 'Streaming requires Anthropic API key');
  }

  const client = getAnthropicClient({
    name: 'anthropic',
    type: 'anthropic',
    apiKey: c.ANTHROPIC_API_KEY,
    visionModel: 'claude-sonnet-4-20250514',
    chatModel: 'claude-sonnet-4-20250514',
  });

  const anthropicTools: Anthropic.Tool[] = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const currentMessages: Anthropic.MessageParam[] = [...messages];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
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
  const chain = chatChain();
  const startTime = Date.now();

  for (let i = 0; i < chain.length; i++) {
    const config = chain[i];
    try {
      const result = config.type === 'openai'
        ? await chatOpenAI(config, history, systemPrompt, tools, executeTool, options)
        : await chatAnthropic(config, history, systemPrompt, tools, executeTool, options);

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
  const client = getOpenAIClient(config);

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
      tools: openaiTools,
      messages,
    });
  }

  return {
    text: response.choices[0]?.message?.content || '',
    model: response.model || config.chatModel,
  };
}
