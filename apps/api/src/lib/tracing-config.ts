/**
 * Langfuse tracing configuration, kept separate from `instrumentation.ts` so it
 * can be unit-tested without booting the OpenTelemetry SDK.
 */

/**
 * A run of base64 characters long enough that it can only be an encoded asset,
 * never prose — ordinary text contains spaces and punctuation outside the
 * base64 alphabet, so it can never reach this length unbroken.
 */
const BASE64_BLOB = /[A-Za-z0-9+/]{256,}={0,2}/g;

/**
 * Strips encoded image payloads out of span attributes before export.
 *
 * Scan and prepare-listing send user photos to the model as base64. Shipping
 * those to Langfuse would put user property images in a third-party SaaS and
 * balloon every trace; the placeholder keeps the message structure readable and
 * records the size so a truncation bug is still diagnosable.
 */
export function maskTraceData({ data }: { data: string }): string {
  if (typeof data !== 'string') return data;
  return data.replace(BASE64_BLOB, (blob) => `[image redacted: ${blob.length} base64 chars]`);
}

/**
 * Applies {@link maskTraceData} to every string attribute on a raw OTel span,
 * in place.
 *
 * `LangfuseSpanProcessor`'s `mask` option only covers Langfuse's own
 * `langfuse.*` input/output/metadata attributes. Third-party instrumentation —
 * OpenInference for Anthropic, here — writes its own attribute keys, so photos
 * reached Langfuse unmasked until this ran first. Verified against a live trace
 * carrying a 14,427-char base64 image.
 */
export function scrubSpanAttributes(attributes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value !== 'string') continue;
    const masked = maskTraceData({ data: value });
    if (masked !== value) attributes[key] = masked;
  }
}

export interface TracingCredentials {
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
}

/**
 * Tracing requires BOTH keys. Absent either one the span processor would fail
 * every export, so we skip starting it entirely — dev boxes, CI, and the test
 * suite stay silent unless someone opts in.
 */
export function tracingEnabled(creds: TracingCredentials): boolean {
  return Boolean(creds.LANGFUSE_PUBLIC_KEY && creds.LANGFUSE_SECRET_KEY);
}
