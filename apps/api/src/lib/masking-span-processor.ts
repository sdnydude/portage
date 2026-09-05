import type { SpanProcessor, ReadableSpan, Span } from '@opentelemetry/sdk-trace-base';
import type { Context } from '@opentelemetry/api';
import { scrubSpanAttributes } from './tracing-config.js';

/**
 * Wraps a span processor so raw OTel attributes are masked before export.
 *
 * `LangfuseSpanProcessor`'s own `mask` option only covers Langfuse's
 * `langfuse.*` attributes. Third-party instrumentation — OpenInference for
 * Anthropic — writes its own keys, so base64 photos reached Langfuse unmasked
 * until this wrapper existed (caught by auditing a live trace).
 *
 * Delegation rather than two sibling processors: sibling ordering is not
 * guaranteed, and losing that race ships user photos to a third party.
 */
export class MaskingSpanProcessor implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    this.inner.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    scrubSpanAttributes(span.attributes as Record<string, unknown>);
    this.inner.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
}
