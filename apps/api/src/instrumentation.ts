/**
 * OpenTelemetry bootstrap for Langfuse LLM tracing.
 *
 * MUST be the first import in `index.ts`: the OpenInference Anthropic
 * instrumentation patches the SDK prototype, and any Anthropic client
 * constructed before `sdk.start()` would be left unpatched.
 *
 * Loads env itself rather than relying on `index.ts` — module evaluation runs
 * before any statement in the importing module, so `loadEnv()` there would be
 * too late for the span processor's credentials. `loadEnv()` memoizes, so the
 * later call in `index.ts` is a no-op.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { LangfuseSpanProcessor, isDefaultExportSpan, type ShouldExportSpan } from '@langfuse/otel';
import { AnthropicInstrumentation } from '@arizeai/openinference-instrumentation-anthropic';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from './lib/env.js';
import { tracingEnabled, maskTraceData } from './lib/tracing-config.js';
import { MaskingSpanProcessor } from './lib/masking-span-processor.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger('instrumentation');
const config = loadEnv();

let sdk: NodeSDK | null = null;

/**
 * Langfuse's default filter allowlists the scope prefix `openinference.*`, but
 * the OpenInference Anthropic package reports its scope as
 * `@arizeai/openinference-instrumentation-anthropic` — so every Claude
 * generation was created, then silently dropped at export. Verified by logging
 * `otelSpan.instrumentationScope.name` against a live call.
 */
const shouldExportSpan: ShouldExportSpan = ({ otelSpan }) =>
  isDefaultExportSpan(otelSpan) || otelSpan.instrumentationScope.name.includes('openinference');

if (tracingEnabled(config)) {
  // The span processor reads credentials from the environment; loadEnv() has
  // already populated process.env from the .env files by this point.
  const anthropicInstrumentation = new AnthropicInstrumentation();

  sdk = new NodeSDK({
    sampler: new TraceIdRatioBasedSampler(config.LANGFUSE_SAMPLE_RATE),
    spanProcessors: [
      new MaskingSpanProcessor(new LangfuseSpanProcessor({
        publicKey: config.LANGFUSE_PUBLIC_KEY,
        secretKey: config.LANGFUSE_SECRET_KEY,
        baseUrl: config.LANGFUSE_BASE_URL,
        environment: config.NODE_ENV,
        mask: maskTraceData,
        shouldExportSpan,
      })),
    ],
    instrumentations: [anthropicInstrumentation],
  });

  sdk.start();

  // Patch AFTER start(): manuallyInstrument binds the tracer at call time, so
  // patching first captures the pre-start no-op tracer and every Anthropic
  // generation silently vanishes from the trace (verified against live traces).
  anthropicInstrumentation.manuallyInstrument(Anthropic as never);

  logger.info(
    { baseUrl: config.LANGFUSE_BASE_URL, environment: config.NODE_ENV, sampleRate: config.LANGFUSE_SAMPLE_RATE },
    'Langfuse tracing enabled',
  );
} else {
  logger.info('Langfuse tracing disabled (LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY not set)');
}

/**
 * Flushes pending spans. Express holds the process open, so without this a
 * container restart drops every span still sitting in the batch queue.
 */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch (err) {
    logger.warn({ err }, 'Langfuse tracing shutdown failed');
  }
}
