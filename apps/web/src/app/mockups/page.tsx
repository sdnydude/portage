"use client";

import { useState } from "react";
import Link from "next/link";

const directions = [
  {
    id: "conversational",
    letter: "A",
    title: "Porter-First",
    subtitle: "Conversational Commerce",
    description:
      "The entire listing flow is a conversation. Porter guides you with pills, popup choices, and inline comps. No forms anywhere.",
    philosophy: "Like texting a friend who happens to know eBay inside out.",
    colorLight: "from-emerald-50 to-green-100",
    colorDark: "from-emerald-600 to-green-800",
    borderLight: "border-emerald-200",
    textLight: "text-emerald-900",
    subtextLight: "text-emerald-700",
  },
  {
    id: "swipe-to-sell",
    letter: "B",
    title: "Swipe to Sell",
    subtitle: "Card-Based Gestures",
    description:
      "Full-screen item cards. Tap pills to configure. Drag the price slider with live comp markers. Tap to publish.",
    philosophy: "List in 3 taps. Speed is the feature.",
    colorLight: "from-amber-50 to-orange-100",
    colorDark: "from-amber-500 to-orange-700",
    borderLight: "border-amber-200",
    textLight: "text-amber-900",
    subtextLight: "text-amber-700",
  },
  {
    id: "hybrid",
    letter: "C",
    title: "Hybrid",
    subtitle: "Chat + Quick Actions",
    description:
      "Porter chat as command center with context-aware action pills. Inline editable listing cards appear in the conversation.",
    philosophy: "Conversation when you want it, shortcuts when you don't.",
    colorLight: "from-violet-50 to-indigo-100",
    colorDark: "from-violet-600 to-indigo-800",
    borderLight: "border-violet-200",
    textLight: "text-violet-900",
    subtextLight: "text-violet-700",
  },
];

export default function MockupsIndex() {
  const [dark, setDark] = useState(false);

  const bg = dark ? "bg-[#0A0A0A] text-white" : "bg-[#F8F7F4] text-[#1A1A1A]";
  const cardBg = (d: typeof directions[0]) => dark ? `bg-gradient-to-br ${d.colorDark} text-white` : `bg-gradient-to-br ${d.colorLight} ${d.borderLight} border ${d.textLight}`;
  const mutedText = dark ? "text-white/40" : "text-[#6B6B6B]";
  const subtleText = dark ? "text-white/20" : "text-[#A3A3A3]";

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-300`}>
      <div className="max-w-lg mx-auto px-5 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#F15A22] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className={`text-sm font-mono tracking-[0.15em] uppercase ${mutedText}`}>Portage</span>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              dark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-[#1A1A1A] text-white hover:bg-[#333]"
            }`}
          >
            {dark ? "☀ Light" : "● Dark"}
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight leading-[1.15] font-[family-name:var(--font-instrument)]">
            Listing Flow
            <br />
            Design Review
          </h1>
          <p className={`text-base ${mutedText} mt-4 leading-relaxed max-w-sm`}>
            Three design directions for how sellers list items on eBay, Reverb, and Etsy.
            Each is an interactive walkthrough — tap through to experience the full flow.
          </p>
        </div>

        {/* How to review */}
        <div className={`rounded-xl border px-5 py-4 mb-8 ${dark ? "border-white/10 bg-white/5" : "border-[#E8E5DE] bg-white"}`}>
          <p className={`text-xs font-mono uppercase tracking-widest mb-3 ${mutedText}`}>How to review</p>
          <ol className={`text-sm ${dark ? "text-white/60" : "text-[#6B6B6B]"} space-y-2 list-decimal list-inside leading-relaxed`}>
            <li>Tap a direction below to open the interactive mockup</li>
            <li>Follow the <span className={dark ? "text-[#5B9BD5]" : "text-[#0047AB] font-medium"}>guided annotations</span> — they explain each step</li>
            <li>Tap the highlighted action to advance through the flow</li>
            <li>After experiencing all three, share your preference</li>
          </ol>
        </div>

        {/* Direction cards */}
        <div className="space-y-4">
          {directions.map((d) => (
            <Link key={d.id} href={`/mockups/${d.id}`} className="block group">
              <div className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 group-hover:scale-[1.02] group-active:scale-[0.98] ${cardBg(d)}`}>
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${
                      dark ? "bg-white/20 text-white" : "bg-black/10 text-black/70"
                    }`}>
                      {d.letter}
                    </span>
                    <span className={`text-sm ${dark ? "text-white/60" : d.subtextLight} font-medium`}>Guided walkthrough</span>
                  </div>
                  <h2 className="text-2xl font-bold font-[family-name:var(--font-instrument)] mb-1">
                    {d.title}
                  </h2>
                  <p className={`text-sm mb-3 font-medium ${dark ? "text-white/60" : d.subtextLight}`}>{d.subtitle}</p>
                  <p className={`text-sm leading-relaxed ${dark ? "text-white/40" : "text-black/50"}`}>{d.description}</p>
                  <p className={`text-sm italic mt-3 ${dark ? "text-white/50" : "text-black/60"}`}>&ldquo;{d.philosophy}&rdquo;</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Camera mockup */}
        <Link href="/mockups/camera" className="block mt-4 group">
          <div className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 group-hover:scale-[1.02] group-active:scale-[0.98] ${
            dark ? "bg-gradient-to-br from-sky-600 to-cyan-800 text-white" : "bg-gradient-to-br from-sky-50 to-cyan-100 border border-sky-200 text-sky-900"
          }`}>
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${
                  dark ? "bg-white/20 text-white" : "bg-black/10 text-black/70"
                }`}>
                  📷
                </span>
                <span className={`text-sm ${dark ? "text-white/60" : "text-sky-700"} font-medium`}>Guided walkthrough</span>
              </div>
              <h2 className="text-2xl font-bold font-[family-name:var(--font-instrument)] mb-1">
                Camera &amp; Photos
              </h2>
              <p className={`text-sm mb-3 font-medium ${dark ? "text-white/60" : "text-sky-700"}`}>Capture, Crop &amp; AI Enhance</p>
              <p className={`text-sm leading-relaxed ${dark ? "text-white/40" : "text-black/50"}`}>Full camera experience with crop tools, AI image enhancement, and a 12-photo gallery grid.</p>
              <p className={`text-sm italic mt-3 ${dark ? "text-white/50" : "text-black/60"}`}>&ldquo;Great photos sell items faster.&rdquo;</p>
            </div>
          </div>
        </Link>

        {/* Survey CTA */}
        <Link href="/mockups/survey" className="block mt-8">
          <div className={`rounded-2xl p-5 text-center transition-all hover:scale-[1.02] active:scale-[0.98] ${dark ? "bg-white/5 border border-white/10" : "bg-white border border-[#E8E5DE] shadow-sm"}`}>
            <p className={`text-lg font-semibold font-[family-name:var(--font-instrument)] ${dark ? "text-white" : "text-[#1A1A1A]"}`}>Share your feedback</p>
            <p className={`text-sm mt-1 ${mutedText}`}>Quick 2-minute survey — your input shapes what we build</p>
            <span className={`inline-block mt-3 px-5 py-2 rounded-full text-sm font-medium ${dark ? "bg-white/10 text-white" : "bg-[#F15A22] text-white"}`}>Take survey →</span>
          </div>
        </Link>

        <div className="mt-8 text-center space-y-1">
          <p className={`text-xs ${subtleText}`}>Interactive prototypes — not connected to real data</p>
          <p className={`text-xs ${subtleText}`}>Portage by Digital Harmony Group</p>
        </div>
      </div>
    </div>
  );
}
