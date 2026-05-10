"use client";

export default function ObservabilityPage() {
  const grafanaUrl = "http://10.0.0.251:3001/d/portage?orgId=1&kiosk";
  const grafanaDirectUrl = "http://10.0.0.251:3001/d/portage?orgId=1";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary font-[family-name:var(--font-instrument)]">
            Observability
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Live API metrics via Prometheus and Grafana
          </p>
        </div>
        <a
          href={grafanaDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-muted hover:text-text-primary transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in Grafana
        </a>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-surface" style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}>
        <iframe
          src={grafanaUrl}
          className="w-full h-full"
          style={{ border: 0 }}
          title="Portage Grafana Dashboard"
          allow="fullscreen"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Metrics endpoint</div>
          <code className="text-xs font-[family-name:var(--font-jetbrains)] text-text-primary break-all">
            http://10.0.0.251:8016/metrics
          </code>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Prometheus</div>
          <code className="text-xs font-[family-name:var(--font-jetbrains)] text-text-primary break-all">
            http://10.0.0.251:9090
          </code>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Grafana</div>
          <code className="text-xs font-[family-name:var(--font-jetbrains)] text-text-primary break-all">
            http://10.0.0.251:3001
          </code>
        </div>
      </div>
    </div>
  );
}
