import {
  startActiveObservation,
  propagateAttributes,
  setActiveTraceIO,
  LangfuseOtelSpanAttributes,
} from '@langfuse/tracing';
import { trace as otelTrace } from '@opentelemetry/api';

/**
 * Groups a multi-call pipeline step under one span.
 *
 * Only worth adding where a step fans out into several LLM calls — otherwise it
 * wraps a lone generation in a span that says nothing the generation doesn't.
 */
export async function traceStep<T>(name: string, run: () => Promise<T>): Promise<T> {
  return startActiveObservation(name, async () => run());
}

/**
 * Records one tool execution as a `tool` observation.
 *
 * Typed rather than left as a generic span so Langfuse can filter on tool calls
 * — LLM-as-a-judge evaluators target them, and the Agent Graph draws them as
 * their own nodes. Nests automatically under whichever generation requested it.
 */
export async function traceTool<T>(name: string, input: unknown, execute: () => Promise<T>): Promise<T> {
  return startActiveObservation(
    name,
    async (span) => {
      span.update({ input });
      const output = await execute();
      span.update({ output });
      return output;
    },
    { asType: 'tool' },
  );
}

export interface TraceAttributes {
  /** Portage user id — powers per-user cost attribution and filtering in Langfuse. */
  userId: string;
  /** Groups multi-turn work into one session. Porter passes the conversation id. */
  sessionId?: string;
  /** Business-level dimensions, e.g. the feature name and the user's plan tier. */
  tags?: string[];
  /**
   * Request context that doesn't belong in input/output — item ids, route,
   * provider chain. Propagated attributes are string-valued; stringify numbers
   * and ids at the call site.
   */
  metadata?: Record<string, string>;
  /** What a reviewer needs at a glance: the user's message, not the raw request body. */
  input?: unknown;
}

/**
 * Wraps one request in a Langfuse trace.
 *
 * The root observation carries the trace-level input/output shown in the
 * tracing table, and `propagateAttributes` pushes userId/sessionId/tags down to
 * every child observation — including the generations the Anthropic and OpenAI
 * instrumentations create deep inside `ai-client.ts`, which is why none of the
 * lib function signatures had to change to carry request context.
 *
 * `name` must stay stable and free of dynamic values: Langfuse evaluators,
 * dashboards, and saved views target observations by name.
 */
export async function traceRequest<T>(
  name: string,
  attributes: TraceAttributes,
  handler: () => Promise<T>,
): Promise<T> {
  const { userId, sessionId, tags, metadata, input } = attributes;

  return startActiveObservation(name, async (span) => {
    if (input !== undefined) span.update({ input });

    // Trace name and trace-level IO are separate attributes — Langfuse does not
    // derive them from the root observation, so without these the tracing table
    // shows a nameless row with empty input/output.
    otelTrace.getActiveSpan()?.setAttribute(LangfuseOtelSpanAttributes.TRACE_NAME, name);

    const output = await propagateAttributes(
      { userId, ...(sessionId ? { sessionId } : {}), ...(tags ? { tags } : {}), ...(metadata ? { metadata } : {}) },
      handler,
    );

    // The handler's return value becomes the trace-level output shown in the
    // tracing table and read by evaluators — so return the assistant reply or
    // the identified item, not a raw response envelope.
    span.update({ output });
    setActiveTraceIO({ input, output });

    return output;
  });
}
