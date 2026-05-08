"use client";

interface Step {
  title: string;
  description: string;
  action: string;
}

interface DevStepsProps {
  direction: string;
  steps: Step[];
  currentStep: number;
}

export function DevSteps({ direction, steps, currentStep }: DevStepsProps) {
  return (
    <div
      className="fixed z-40 pointer-events-none hidden xl:block"
      style={{
        right: "calc(50% + 240px)",
        width: "300px",
        top: "40px",
        bottom: "40px",
      }}
    >
      <div className="pointer-events-auto h-full flex flex-col rounded-2xl border border-[#2a2a2a] bg-[#111] overflow-hidden" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div className="px-5 py-4 border-b border-[#2a2a2a] bg-[#181818]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666]">Dev Guide</span>
            <span className="px-2 py-0.5 rounded-full bg-[#F15A22]/15 text-[#F15A22] text-[9px] font-mono font-bold uppercase tracking-wider">
              {direction}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="text-[11px] font-mono text-[#555]">
              {currentStep}/{steps.length - 1} steps
            </div>
            <div className="flex-1 h-1 rounded-full bg-[#222] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#F15A22] transition-all duration-500"
                style={{ width: `${(currentStep / Math.max(steps.length - 1, 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-hide">
          {steps.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            const isFuture = i > currentStep;

            return (
              <div
                key={i}
                className={`relative rounded-xl px-3 py-2.5 transition-all duration-300 ${
                  isActive
                    ? "bg-[#F15A22]/10 border border-[#F15A22]/30"
                    : isDone
                    ? "bg-[#1a1a1a] border border-transparent"
                    : "border border-transparent"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 transition-colors ${
                    isActive
                      ? "bg-[#F15A22] text-white"
                      : isDone
                      ? "bg-[#2D5A27] text-white"
                      : "bg-[#222] text-[#555]"
                  }`}>
                    {isDone ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                    ) : (
                      i
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold leading-tight transition-colors ${
                      isActive ? "text-[#F15A22]" : isDone ? "text-[#888]" : "text-[#555]"
                    }`}>
                      {step.title}
                    </p>
                    {(isActive || isDone) && (
                      <p className={`text-[11px] leading-relaxed mt-1 ${
                        isActive ? "text-[#999]" : "text-[#555]"
                      }`}>
                        {step.description}
                      </p>
                    )}
                    {isActive && (
                      <p className="text-[10px] font-mono text-[#F15A22]/70 mt-1.5">
                        {step.action}
                      </p>
                    )}
                    {isFuture && (
                      <p className="text-[10px] text-[#444] mt-0.5 truncate">{step.description.slice(0, 60)}...</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-[#2a2a2a] bg-[#181818]">
          <p className="text-[9px] font-mono text-[#444] uppercase tracking-widest text-center">
            Portage Design Review
          </p>
        </div>
      </div>
    </div>
  );
}
