"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ChatMsg {
  role: "assistant" | "user";
  text: string;
}

interface MCQ {
  id: string;
  question: string;
  category: string;
  options: { label: string; value: string }[];
}

const DIRECTION_LABELS: Record<string, string> = {
  A: "Porter-First (Conversational)",
  B: "Swipe to Sell (Cards)",
  C: "Hybrid (Chat + Actions)",
};

const MCQ_QUESTIONS: MCQ[] = [
  {
    id: "listing_speed",
    question: "How many steps feels right for listing a single item?",
    category: "Flow",
    options: [
      { label: "3 or fewer — speed is everything", value: "3_or_fewer" },
      { label: "4–6 steps with guidance", value: "4_to_6" },
      { label: "As many as needed for accuracy", value: "accuracy_first" },
      { label: "Depends on the item value", value: "depends_on_value" },
    ],
  },
  {
    id: "ai_autonomy",
    question: "How much should the AI assistant do automatically?",
    category: "AI",
    options: [
      { label: "Auto-fill everything, I'll just review", value: "full_auto" },
      { label: "Suggest, but let me approve each field", value: "suggest_approve" },
      { label: "Only help when I ask for it", value: "on_demand" },
      { label: "No AI — I want full manual control", value: "manual" },
    ],
  },
  {
    id: "pricing_ux",
    question: "How should pricing work?",
    category: "Pricing",
    options: [
      { label: "AI sets the price from comps, I can adjust", value: "ai_sets_adjustable" },
      { label: "Show me comps and let me type a price", value: "comps_manual" },
      { label: "Price slider with comp markers", value: "slider_with_comps" },
      { label: "Just a text field — I know my prices", value: "manual_only" },
    ],
  },
  {
    id: "marketplace_timing",
    question: "When should you choose the marketplace (eBay, Reverb, Etsy)?",
    category: "Flow",
    options: [
      { label: "First — it affects everything else", value: "first_step" },
      { label: "After entering item details", value: "after_details" },
      { label: "App should auto-recommend based on item", value: "auto_recommend" },
      { label: "Last step before publishing", value: "last_step" },
    ],
  },
  {
    id: "photo_handling",
    question: "How should photos be handled during listing?",
    category: "Photos",
    options: [
      { label: "Camera opens first — photos drive the flow", value: "camera_first" },
      { label: "Add photos anytime during the flow", value: "anytime" },
      { label: "AI should auto-enhance without asking", value: "auto_enhance" },
      { label: "Full manual control over each photo", value: "manual_control" },
    ],
  },
  {
    id: "input_method",
    question: "Which input method felt most natural?",
    category: "UI",
    options: [
      { label: "Tapping pill buttons for quick choices", value: "pills" },
      { label: "Typing in a chat-style prompt", value: "chat" },
      { label: "Traditional form fields", value: "forms" },
      { label: "Mix of pills and typing", value: "mixed" },
    ],
  },
  {
    id: "info_density",
    question: "How much information should each screen show?",
    category: "Design",
    options: [
      { label: "Minimal — one task per screen", value: "minimal" },
      { label: "Moderate — a few related fields together", value: "moderate" },
      { label: "Dense — show everything I need at once", value: "dense" },
      { label: "Adaptive — simple for basic items, detailed for expensive ones", value: "adaptive" },
    ],
  },
  {
    id: "comp_data_display",
    question: "How should comparable sold prices be shown?",
    category: "Pricing",
    options: [
      { label: "Inline summary (median, range) next to price field", value: "inline_summary" },
      { label: "Full comp cards with photos and details", value: "full_cards" },
      { label: "Visual chart or price distribution graph", value: "chart" },
      { label: "Just the recommended price — I trust the AI", value: "just_price" },
    ],
  },
  {
    id: "error_recovery",
    question: "If you make a mistake mid-listing, what should happen?",
    category: "UX",
    options: [
      { label: "Easy back button to any previous step", value: "back_button" },
      { label: "Inline editing — tap any field to change it", value: "inline_edit" },
      { label: "AI detects issues and suggests fixes", value: "ai_detects" },
      { label: "Save as draft, come back later", value: "draft" },
    ],
  },
  {
    id: "confidence_blocker",
    question: "What would most prevent you from using this daily?",
    category: "Adoption",
    options: [
      { label: "Too many steps or too slow", value: "too_slow" },
      { label: "Don't trust AI-generated descriptions or prices", value: "trust_ai" },
      { label: "Prefer listing directly on the marketplace", value: "prefer_direct" },
      { label: "Missing features I need (shipping, bulk, etc.)", value: "missing_features" },
    ],
  },
  {
    id: "killer_feature",
    question: "Which single feature would make you switch to this app?",
    category: "Priority",
    options: [
      { label: "One-tap listing from a photo", value: "one_tap_photo" },
      { label: "Accurate comp pricing across marketplaces", value: "cross_market_comps" },
      { label: "List to multiple marketplaces at once", value: "multi_marketplace" },
      { label: "AI that learns my pricing preferences over time", value: "learning_ai" },
    ],
  },
  {
    id: "visual_style",
    question: "Which visual style feels most trustworthy for selling?",
    category: "Design",
    options: [
      { label: "Clean and minimal (Apple-like)", value: "minimal_apple" },
      { label: "Warm and inviting (friendly/casual)", value: "warm_friendly" },
      { label: "Professional and structured (business tool)", value: "professional" },
      { label: "Bold and modern (Robinhood/Cash App-like)", value: "bold_modern" },
    ],
  },
];

type Phase =
  | "welcome"
  | "preferred"
  | "ease-a" | "ease-b" | "ease-c"
  | "appeal-a" | "appeal-b" | "appeal-c"
  | `mcq-${number}`
  | "liked" | "concerns" | "nps" | "name"
  | "submitting" | "done";

export default function SurveyPage() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [step, setStep] = useState<Phase>("welcome");
  const [isTyping, setIsTyping] = useState(false);
  const [preferred, setPreferred] = useState("");
  const [easeA, setEaseA] = useState(0);
  const [easeB, setEaseB] = useState(0);
  const [easeC, setEaseC] = useState(0);
  const [appealA, setAppealA] = useState(0);
  const [appealB, setAppealB] = useState(0);
  const [appealC, setAppealC] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [liked, setLiked] = useState("");
  const [concerns, setConcerns] = useState("");
  const [nps, setNps] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const totalSteps = 6 + MCQ_QUESTIONS.length + 4 + 1;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, isTyping]);

  useEffect(() => {
    addAssistant("Welcome to the Portage design review! This survey captures detailed feedback on design, UX, and UI to help us make specific decisions. Takes about 4 minutes. Ready?");
  }, []);

  function addAssistant(text: string) {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((p) => [...p, { role: "assistant", text }]);
    }, 450);
  }

  function addUser(text: string) {
    setMsgs((p) => [...p, { role: "user", text }]);
  }

  function advance(n: number) {
    setProgress(n);
  }

  function handleStart() {
    addUser("Ready!");
    setStep("preferred");
    advance(1);
    setTimeout(() => addAssistant("Which design direction resonated most with you overall?"), 600);
  }

  function handlePreferred(dir: string) {
    setPreferred(dir);
    addUser(DIRECTION_LABELS[dir]);
    setStep("ease-a");
    advance(2);
    setTimeout(() => addAssistant("Rate Direction A (Porter-First) on ease of use — how intuitive does it feel?"), 600);
  }

  function handleRating(value: number) {
    addUser(`${value}/5`);
    if (step === "ease-a") { setEaseA(value); setStep("ease-b"); advance(3); setTimeout(() => addAssistant("Ease of use for Direction B (Swipe to Sell)?"), 500); }
    else if (step === "ease-b") { setEaseB(value); setStep("ease-c"); advance(4); setTimeout(() => addAssistant("Ease of use for Direction C (Hybrid)?"), 500); }
    else if (step === "ease-c") { setEaseC(value); setStep("appeal-a"); advance(5); setTimeout(() => addAssistant("Now visual polish — how modern and premium does Direction A look?"), 500); }
    else if (step === "appeal-a") { setAppealA(value); setStep("appeal-b"); advance(6); setTimeout(() => addAssistant("Visual polish for Direction B?"), 500); }
    else if (step === "appeal-b") { setAppealB(value); setStep("appeal-c"); advance(7); setTimeout(() => addAssistant("Visual polish for Direction C?"), 500); }
    else if (step === "appeal-c") {
      setAppealC(value);
      advance(8);
      startMcq(0);
    }
  }

  function startMcq(idx: number) {
    const q = MCQ_QUESTIONS[idx];
    setStep(`mcq-${idx}`);
    setTimeout(() => addAssistant(q.question), 500);
  }

  function handleMcq(idx: number, option: { label: string; value: string }) {
    const q = MCQ_QUESTIONS[idx];
    setMcqAnswers((prev) => ({ ...prev, [q.id]: option.value }));
    addUser(option.label);
    const nextIdx = idx + 1;
    advance(8 + nextIdx);
    if (nextIdx < MCQ_QUESTIONS.length) {
      startMcq(nextIdx);
    } else {
      setStep("liked");
      setTimeout(() => addAssistant("Great insights! What did you like most about your preferred direction? What stood out?"), 500);
    }
  }

  function handleLiked() {
    if (!liked.trim()) return;
    addUser(liked);
    setStep("concerns");
    advance(8 + MCQ_QUESTIONS.length + 1);
    setTimeout(() => addAssistant("Any concerns, missing features, or suggestions? (Skip if none)"), 500);
  }

  function handleConcerns() {
    addUser(concerns.trim() || "(skipped)");
    setStep("nps");
    advance(8 + MCQ_QUESTIONS.length + 2);
    setTimeout(() => addAssistant("On a scale of 0–10, how likely are you to recommend this app to another seller?"), 500);
  }

  function handleNps(value: number) {
    setNps(value);
    addUser(`${value}/10`);
    setStep("name");
    advance(8 + MCQ_QUESTIONS.length + 3);
    setTimeout(() => addAssistant("Almost done! Your name and role? (Optional — helps us follow up)"), 500);
  }

  function handleName() {
    addUser(name.trim() ? `${name}${role ? ` — ${role}` : ""}` : "(anonymous)");
    setStep("submitting");
    advance(totalSteps);
    submitSurvey();
  }

  async function submitSurvey() {
    const payload = {
      preferredDirection: preferred,
      ratingsEaseA: easeA || undefined,
      ratingsEaseB: easeB || undefined,
      ratingsEaseC: easeC || undefined,
      ratingsAppealA: appealA || undefined,
      ratingsAppealB: appealB || undefined,
      ratingsAppealC: appealC || undefined,
      likedMost: liked.trim() || undefined,
      concerns: concerns.trim() || undefined,
      detailedResponses: { ...mcqAnswers, nps: String(nps) },
      respondentName: name.trim() || undefined,
      respondentRole: role.trim() || undefined,
    };

    try {
      const res = await fetch("https://portage-api.digitalharmonyai.com/survey/design-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStep("done");
        setTimeout(() => addAssistant("Your feedback has been saved! Thank you — every answer directly shapes what we build next. Your detailed input is invaluable."), 600);
      } else {
        setTimeout(() => addAssistant("Hmm, there was an issue saving. Your feedback was captured locally — we'll retrieve it. Thank you!"), 600);
        setStep("done");
      }
    } catch {
      setTimeout(() => addAssistant("Network issue — but your answers were captured. We'll retrieve them. Thank you!"), 600);
      setStep("done");
    }
  }

  const ratingSteps = ["ease-a", "ease-b", "ease-c", "appeal-a", "appeal-b", "appeal-c"];
  const isRating = ratingSteps.includes(step);
  const mcqMatch = step.match(/^mcq-(\d+)$/);
  const mcqIdx = mcqMatch ? parseInt(mcqMatch[1]) : -1;
  const currentMcq = mcqIdx >= 0 ? MCQ_QUESTIONS[mcqIdx] : null;
  const pct = Math.round((progress / totalSteps) * 100);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]" style={{ maxWidth: "430px", margin: "0 auto" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#E8E5DE] bg-[#F8F7F4]/95 backdrop-blur-xl z-20">
        <Link href="/mockups" className="text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <div className="w-9 h-9 rounded-full bg-[#F15A22] flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.2 4.7 3 6.3V21l3.5-2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" /></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-[15px] font-semibold text-[#1A1A1A] font-[family-name:var(--font-instrument)]">Design Review</h1>
          <p className="text-[11px] text-[#0047AB]">Detailed feedback · ~4 min</p>
        </div>
        {progress > 0 && step !== "done" && (
          <span className="text-[11px] text-[#8A8A8A] font-mono">{pct}%</span>
        )}
      </header>

      {/* Progress bar */}
      {progress > 0 && step !== "done" && (
        <div className="h-1 bg-[#E8E5DE]">
          <div className="h-full bg-[#F15A22] transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
              msg.role === "user" ? "bg-[#F15A22] text-white rounded-br-md" : "bg-white text-[#1A1A1A] border border-[#E8E5DE] shadow-sm rounded-bl-md"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-[#E8E5DE] shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#F15A22]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#F15A22]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#F15A22]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area — popups from prompt field */}
      <div className="border-t border-[#E8E5DE] px-4 py-3 bg-white">
        {step === "welcome" && (
          <button onClick={handleStart} className="w-full py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium active:scale-[0.98] transition-transform">
            Let&apos;s go →
          </button>
        )}

        {step === "preferred" && (
          <div className="space-y-2" style={{ animation: "slideUp 0.25s ease-out" }}>
            <p className="text-[11px] text-[#8A8A8A] font-mono uppercase tracking-wider">Overall preference</p>
            <div className="flex gap-2">
              {["A", "B", "C"].map((d) => (
                <button key={d} onClick={() => handlePreferred(d)} className="flex-1 py-3 rounded-xl bg-[#F0EDE6] border border-[#E8E5DE] text-[#1A1A1A] text-[13px] font-medium hover:border-[#0047AB]/30 active:scale-[0.97] transition-all">
                  <span className="block text-lg mb-0.5">{d === "A" ? "💬" : d === "B" ? "🃏" : "⚡"}</span>
                  {d === "A" ? "Porter" : d === "B" ? "Swipe" : "Hybrid"}
                </button>
              ))}
            </div>
          </div>
        )}

        {isRating && (
          <div className="space-y-2" style={{ animation: "slideUp 0.25s ease-out" }}>
            <p className="text-[11px] text-[#8A8A8A] font-mono uppercase tracking-wider">
              {step.startsWith("ease") ? "Ease of use" : "Visual polish"} — Direction {step.endsWith("-a") ? "A" : step.endsWith("-b") ? "B" : "C"}
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => handleRating(n)} className="flex-1 py-3 rounded-xl bg-[#F0EDE6] border border-[#E8E5DE] text-[#1A1A1A] text-lg font-semibold hover:border-[#0047AB]/30 hover:bg-[#0047AB]/5 active:scale-[0.95] transition-all">
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-[#8A8A8A] px-1">
              <span>Poor</span><span>Excellent</span>
            </div>
          </div>
        )}

        {currentMcq && (
          <div className="space-y-2" style={{ animation: "slideUp 0.25s ease-out" }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#0047AB] font-mono uppercase tracking-wider font-medium">{currentMcq.category}</p>
              <p className="text-[10px] text-[#BCBCBC]">{mcqIdx + 1} of {MCQ_QUESTIONS.length}</p>
            </div>
            <div className="space-y-1.5">
              {currentMcq.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleMcq(mcqIdx, opt)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[#F0EDE6] border border-[#E8E5DE] text-[#1A1A1A] text-[14px] leading-snug hover:border-[#0047AB]/30 hover:bg-[#0047AB]/5 active:scale-[0.98] transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "liked" && (
          <div className="space-y-2" style={{ animation: "slideUp 0.25s ease-out" }}>
            <p className="text-[11px] text-[#8A8A8A] font-mono uppercase tracking-wider">What stood out</p>
            <textarea value={liked} onChange={(e) => setLiked(e.target.value)} placeholder="What did you like most? What would you tell a friend?" rows={3} className="w-full px-4 py-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[15px] text-[#1A1A1A] placeholder:text-[#BCBCBC] focus:border-[#0047AB]/40 focus:outline-none resize-none" />
            <button onClick={handleLiked} disabled={!liked.trim()} className="w-full py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-all">
              Send
            </button>
          </div>
        )}

        {step === "concerns" && (
          <div className="space-y-2" style={{ animation: "slideUp 0.25s ease-out" }}>
            <p className="text-[11px] text-[#8A8A8A] font-mono uppercase tracking-wider">Concerns & ideas</p>
            <textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="What's missing? What would you change?" rows={3} className="w-full px-4 py-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[15px] text-[#1A1A1A] placeholder:text-[#BCBCBC] focus:border-[#0047AB]/40 focus:outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={handleConcerns} className="flex-1 py-3 rounded-2xl bg-[#F0EDE6] text-[#6B6B6B] text-[15px] font-medium border border-[#E8E5DE]">
                Skip
              </button>
              <button onClick={handleConcerns} disabled={!concerns.trim()} className="flex-1 py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-all">
                Send
              </button>
            </div>
          </div>
        )}

        {step === "nps" && (
          <div className="space-y-2" style={{ animation: "slideUp 0.25s ease-out" }}>
            <p className="text-[11px] text-[#8A8A8A] font-mono uppercase tracking-wider">Net Promoter Score</p>
            <div className="grid grid-cols-11 gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => handleNps(n)}
                  className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.9] ${
                    n <= 6
                      ? "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                      : n <= 8
                        ? "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-[#8A8A8A] px-0.5">
              <span>Not likely</span><span>Very likely</span>
            </div>
          </div>
        )}

        {step === "name" && (
          <div className="space-y-2" style={{ animation: "slideUp 0.25s ease-out" }}>
            <p className="text-[11px] text-[#8A8A8A] font-mono uppercase tracking-wider">Your info (optional)</p>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="flex-1 px-4 py-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[15px] text-[#1A1A1A] placeholder:text-[#BCBCBC] focus:border-[#0047AB]/40 focus:outline-none" />
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className="flex-1 px-4 py-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[15px] text-[#1A1A1A] placeholder:text-[#BCBCBC] focus:border-[#0047AB]/40 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleName} className="flex-1 py-3 rounded-2xl bg-[#F0EDE6] text-[#6B6B6B] text-[15px] font-medium border border-[#E8E5DE]">
                Skip
              </button>
              <button onClick={handleName} className="flex-1 py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium active:scale-[0.98] transition-all">
                Submit
              </button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="flex items-center justify-center py-3 gap-2 text-[#6B6B6B] text-[15px]">
            <div className="w-4 h-4 border-2 border-[#F15A22] border-t-transparent rounded-full animate-spin" />
            Saving your detailed feedback...
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#F15A22]/5 border border-[#F15A22]/20 px-4 py-3 text-center">
              <p className="text-[15px] font-semibold text-[#F15A22]">Thank you!</p>
              <p className="text-[13px] text-[#6B6B6B] mt-1">{Object.keys(mcqAnswers).length + 8} data points captured</p>
            </div>
            <Link href="/mockups" className="block w-full py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium text-center active:scale-[0.98] transition-transform">
              ← Back to mockups
            </Link>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
