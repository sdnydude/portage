"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ReviewComments } from "@/components/review-comments";
import { DevSteps } from "@/components/dev-steps";

type MsgType =
  | "text"
  | "pills"
  | "item-card"
  | "scanning"
  | "recognition"
  | "category"
  | "comps"
  | "price-pick"
  | "listing-preview"
  | "shipping"
  | "confirm"
  | "success"
  | "listing-detail";

interface CompItem {
  title: string;
  price: number;
  sold: boolean;
  date?: string;
  condition?: string;
}

interface Message {
  role: "assistant" | "user";
  type: MsgType;
  content: string;
  pills?: { label: string; icon?: string; disabled?: boolean }[];
  item?: { title: string; photo: string; condition: string; value: string };
  comps?: CompItem[];
  price?: number;
}

const MOCK_PHOTO = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect fill="#1a2e1a" width="400" height="400"/>
    <text x="200" y="180" text-anchor="middle" fill="#4CAF50" font-size="60" font-family="serif">&#127928;</text>
    <text x="200" y="240" text-anchor="middle" fill="#aaa" font-size="18" font-family="sans-serif">Gibson Les Paul</text>
    <text x="200" y="265" text-anchor="middle" fill="#666" font-size="13" font-family="sans-serif">Standard '59 Reissue</text>
  </svg>`
);

const COMPS_TOP: CompItem[] = [
  { title: "LP Std '59 Reissue Sunburst", price: 1380, sold: true, date: "Apr 28", condition: "Like New" },
  { title: "Gibson Les Paul Standard VOS", price: 1520, sold: true, date: "Apr 25", condition: "Excellent" },
  { title: "Les Paul '59 RI Cherry", price: 1450, sold: true, date: "Apr 22", condition: "Like New" },
  { title: "Gibson LP Standard R9", price: 1650, sold: true, date: "Apr 18", condition: "Very Good" },
];

const COMPS_FULL: CompItem[] = [
  { title: "LP Std '59 Reissue Sunburst", price: 1380, sold: true, date: "Apr 28", condition: "Like New" },
  { title: "Gibson Les Paul Standard VOS", price: 1520, sold: true, date: "Apr 25", condition: "Excellent" },
  { title: "Les Paul '59 RI Cherry", price: 1450, sold: true, date: "Apr 22", condition: "Like New" },
  { title: "Gibson LP Standard R9", price: 1650, sold: true, date: "Apr 18", condition: "Very Good" },
  { title: "Les Paul '59 Reissue Tobacco", price: 1280, sold: true, date: "Apr 15", condition: "Good" },
  { title: "Gibson LP Std '59 Aged", price: 1890, sold: true, date: "Apr 10", condition: "Like New" },
  { title: "LP Custom '57 Reissue", price: 1180, sold: false, date: "Active", condition: "Good" },
  { title: "Gibson Les Paul R9 VOS", price: 1550, sold: false, date: "Active", condition: "Excellent" },
];

const AI_DESCRIPTION = "Gibson Les Paul Standard '59 Reissue in excellent condition. Cherry sunburst finish with AAA flame maple top. PAF-style humbuckers, ABR-1 bridge, lightweight aluminum tailpiece. Brazilian rosewood fingerboard with trapezoid inlays. Long neck tenon for superior sustain. Includes original hardshell case and certificate of authenticity.";

interface WalkthroughStep { title: string; description: string; action: string; position: "top" | "center" | "bottom"; }

const WALKTHROUGH: WalkthroughStep[] = [
  { title: "Welcome to Direction A", description: "This is 'Porter-First' — the entire listing flow is a conversation. No forms, no modals. Just chat with your AI assistant.", action: "Tap anywhere to begin", position: "center" },
  { title: "Step 1: Quick-action pills", description: "Porter greets you with action pills instead of a blank input. Users pick what they want to do — no typing needed.", action: "Tap 'List an item' pill below", position: "bottom" },
  { title: "Step 2: AI Scanning", description: "Porter analyzes your photos with AI. The animated scanner creates a feeling of intelligence at work — not a loading spinner.", action: "Watch the scan complete", position: "center" },
  { title: "Step 3: Recognition Result", description: "AI identifies the item with high confidence. Rich card shows brand, model, condition, and estimated value. Users can correct if wrong.", action: "Tap 'Yes, list this' pill", position: "bottom" },
  { title: "Step 4: Marketplace selection", description: "Marketplace choice as pills — not a dropdown. Disabled pills hint at future integrations without cluttering the experience.", action: "Tap 'eBay' pill", position: "bottom" },
  { title: "Step 5: Category suggestion", description: "AI suggests the right eBay category automatically. Breadcrumb path makes it easy to verify. One tap to accept or change.", action: "Tap 'Looks right' pill", position: "bottom" },
  { title: "Step 6: Comps with detail", description: "Comparable listings appear as scrollable cards with an expandable section showing all 12 comps. Stats line gives instant context.", action: "Accept the recommended price", position: "bottom" },
  { title: "Step 7: Listing preview", description: "AI-generated listing with editable title and description. Tap to edit inline — no separate form. Regenerate button for quick iterations.", action: "Tap 'Looks good' pill", position: "bottom" },
  { title: "Step 8: Shipping", description: "Shipping options as pills. AI estimates package size and weight from item type. One tap — not a shipping calculator form.", action: "Tap a shipping option", position: "bottom" },
  { title: "Step 9: Publish confirmation", description: "Full summary card with every detail: photo, price, marketplace, category, shipping, and estimated fees. Last chance to review before going live.", action: "Tap 'Publish now'", position: "bottom" },
  { title: "Step 10: Listed!", description: "Success confirmation with listing details. Live status, listing number, and action pills for next steps — including cross-listing.", action: "Walkthrough complete", position: "center" },
];

const FLOW: Message[] = [
  // 0: Greeting
  { role: "assistant", type: "text", content: "Hey! I'm Porter. What would you like to do?", pills: [{ label: "List an item", icon: "📋" }, { label: "Check comps", icon: "💰" }, { label: "Scan something", icon: "📸" }] },
  // 1: User picks "List an item"
  { role: "user", type: "text", content: "List an item" },
  // 2: AI Scanning
  { role: "assistant", type: "scanning", content: "Analyzing your photos..." },
  // 3: Recognition result
  { role: "assistant", type: "recognition", content: "I identified this as a **Gibson Les Paul Standard '59 Reissue**", item: { title: "Gibson Les Paul Standard '59 Reissue", photo: MOCK_PHOTO, condition: "Like New", value: "$1,200 – $1,800" }, pills: [{ label: "Yes, list this", icon: "✓" }, { label: "Wrong item", icon: "✕" }] },
  // 4: User confirms
  { role: "user", type: "text", content: "Yes, list this" },
  // 5: Marketplace selection
  { role: "assistant", type: "pills", content: "Where should I list it?", pills: [{ label: "eBay", icon: "🏷️" }, { label: "Etsy", icon: "🧵", disabled: true }, { label: "Reverb", icon: "🎸" }, { label: "Both", icon: "✨" }] },
  // 6: User picks eBay
  { role: "user", type: "text", content: "eBay" },
  // 7: Category suggestion
  { role: "assistant", type: "category", content: "I'd categorize this as:", pills: [{ label: "Looks right", icon: "✓" }, { label: "Change category", icon: "✏️" }] },
  // 8: User accepts category
  { role: "user", type: "text", content: "Looks right" },
  // 9: Comps
  { role: "assistant", type: "comps", content: "I found 12 comparable listings on eBay:", comps: COMPS_TOP },
  // 10: Price pick
  { role: "assistant", type: "price-pick", content: "Based on the comps, I'd recommend listing at $1,450.", price: 1450, pills: [{ label: "$1,450", icon: "✓" }, { label: "Set my own" }, { label: "See all comps" }] },
  // 11: User accepts price
  { role: "user", type: "text", content: "$1,450" },
  // 12: Listing preview
  { role: "assistant", type: "listing-preview", content: "Here's your listing draft:" },
  // 13: User approves listing
  { role: "user", type: "text", content: "Looks good" },
  // 14: Shipping
  { role: "assistant", type: "shipping", content: "How should we handle shipping?", pills: [{ label: "Free shipping", icon: "📦" }, { label: "Calculated", icon: "📐" }, { label: "Flat rate $15", icon: "🏷️" }] },
  // 15: User picks shipping
  { role: "user", type: "text", content: "Free shipping" },
  // 16: Publish confirmation
  { role: "assistant", type: "confirm", content: "Ready to publish? Here's the full summary:", item: { title: "Gibson Les Paul Standard '59 Reissue", photo: MOCK_PHOTO, condition: "Like New", value: "$1,450" }, pills: [{ label: "Publish now", icon: "🚀" }, { label: "Save as draft", icon: "📝" }] },
  // 17: User publishes
  { role: "user", type: "text", content: "Publish now" },
  // 18: Success
  { role: "assistant", type: "success", content: "Listed on eBay for $1,450! Your listing is live." },
  // 19: Listing detail
  { role: "assistant", type: "listing-detail", content: "Your listing is live! Here are the details:", pills: [{ label: "View on eBay", icon: "🔗" }, { label: "Edit listing", icon: "✏️" }, { label: "End listing", icon: "🛑" }, { label: "List on Reverb too", icon: "🎸" }] },
];

export default function ConversationalMockup() {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [wtStep, setWtStep] = useState(0);
  const [dark, setDark] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [compsExpanded, setCompsExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState("Gibson Les Paul Standard '59 Reissue - Cherry Sunburst - Like New w/ Case");
  const [editDesc, setEditDesc] = useState(AI_DESCRIPTION);
  const [scanComplete, setScanComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, isTyping]);

  function advanceWalkthrough() {
    if (wtStep === 0) {
      setWtStep(1);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages([FLOW[0]]);
        setStep(1);
      }, 600);
    }
  }

  function handlePillClick() {
    if (step >= FLOW.length) return;
    const userMsg = FLOW[step];
    if (!userMsg || userMsg.role !== "user") return;

    setMessages((prev) => [...prev, userMsg]);
    const nextStep = step + 1;
    setStep(nextStep);
    setWtStep((w) => w + 1);

    setTimeout(() => {
      const n1 = FLOW[nextStep];
      if (n1?.role === "assistant") {
        setIsTyping(true);

        // Special handling for scanning step: show scanning animation, then auto-advance to recognition
        if (n1.type === "scanning") {
          setScanComplete(false);
          setTimeout(() => {
            setIsTyping(false);
            setMessages((p) => [...p, n1]);
            setStep(nextStep + 1);

            // After 2s of scanning animation, auto-advance to recognition result
            setTimeout(() => {
              setScanComplete(true);
              setTimeout(() => {
                const n2 = FLOW[nextStep + 1];
                if (n2?.role === "assistant") {
                  setIsTyping(true);
                  setTimeout(() => {
                    setIsTyping(false);
                    setMessages((p) => [...p, n2]);
                    setStep(nextStep + 2);
                    setWtStep((w) => w + 1);
                  }, 500);
                }
              }, 400);
            }, 2000);
          }, 600);
          return;
        }

        setTimeout(() => {
          setIsTyping(false);
          setMessages((p) => [...p, n1]);
          setStep(nextStep + 1);
          // Check if there's a second consecutive assistant message
          setTimeout(() => {
            const n2 = FLOW[nextStep + 1];
            if (n2?.role === "assistant") {
              setIsTyping(true);
              setTimeout(() => {
                setIsTyping(false);
                setMessages((p) => [...p, n2]);
                setStep(nextStep + 2);
              }, 500);
            }
          }, 200);
        }, 600);
      }
    }, 150);
  }

  function handleRestart() {
    setStep(0);
    setMessages([]);
    setWtStep(0);
    setIsTyping(false);
    setScanComplete(false);
    setCompsExpanded(false);
    setEditTitle("Gibson Les Paul Standard '59 Reissue - Cherry Sunburst - Like New w/ Case");
    setEditDesc(AI_DESCRIPTION);
  }

  const currentWt = WALKTHROUGH[wtStep];
  const isLastWt = wtStep >= WALKTHROUGH.length - 1;

  const bg = dark ? "bg-[#0A0A0A]" : "bg-[#F8F7F4]";
  const headerBg = dark ? "bg-[#0A0A0A]/95 border-white/5" : "bg-[#F8F7F4]/95 border-[#E8E5DE]";
  const userBubble = "bg-[#F15A22] text-white";
  const aiBubble = dark ? "bg-white/8 text-white/90 border-white/5" : "bg-white text-[#1A1A1A] border-[#E8E5DE] shadow-sm";
  const pillStyle = dark ? "border-[#5B9BD5]/30 bg-[#0047AB]/10 text-[#5B9BD5]" : "border-[#0047AB]/30 bg-[#0047AB]/10 text-[#0047AB]";
  const pillDisabled = dark ? "border-white/10 bg-white/5 text-white/20 cursor-not-allowed" : "border-[#E8E5DE] bg-[#F8F7F4] text-[#C0C0C0] cursor-not-allowed";
  const compCard = dark ? "border-white/8 bg-white/5" : "border-[#E8E5DE] bg-white shadow-sm";
  const inputBg = dark ? "bg-white/5 border-white/10 text-white placeholder:text-white/25" : "bg-white border-[#E8E5DE] text-[#1A1A1A] placeholder:text-[#A3A3A3] shadow-sm";
  const mutedText = dark ? "text-white/50" : "text-[#6B6B6B]";
  const actionPill = dark ? "bg-white/5 border-white/10 text-white/40" : "bg-white border-[#E8E5DE] text-[#6B6B6B] shadow-sm";
  const cardBorder = dark ? "border-white/10 bg-white/5" : "border-[#E8E5DE] bg-white shadow-sm";
  const textPrimary = dark ? "text-white" : "text-[#1A1A1A]";
  const textSecondary = dark ? "text-white/60" : "text-[#6B6B6B]";
  const subtleBorder = dark ? "border-white/5" : "border-[#E8E5DE]";
  const editableField = dark ? "bg-white/5 border-white/10 text-white/90 focus:border-[#0047AB]" : "bg-[#FAFAF8] border-[#E8E5DE] text-[#1A1A1A] focus:border-[#0047AB]";

  function renderBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  // AI Badge component
  function AiBadge({ label = "AI Generated" }: { label?: string }) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0047AB]/10 text-[#0047AB] text-[11px] font-medium">
        <span>✨</span> {label}
      </span>
    );
  }

  function renderMessage(msg: Message, i: number) {
    return (
      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`} style={{ animation: "fadeSlideUp 0.3s ease-out forwards" }}>
        <div className="max-w-[88%]">
          {/* Text bubble */}
          {msg.type !== "scanning" && (
            <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed border ${msg.role === "user" ? `${userBubble} rounded-br-md border-transparent` : `${aiBubble} rounded-bl-md`}`}>
              {renderBold(msg.content)}
            </div>
          )}

          {/* === SCANNING === */}
          {msg.type === "scanning" && (
            <div className={`rounded-2xl px-4 py-4 border ${aiBubble} rounded-bl-md`}>
              <p className="text-[15px] mb-3">{msg.content}</p>
              <div className={`rounded-xl overflow-hidden border ${subtleBorder}`}>
                <div className="relative h-28 bg-[#1a2e1a] overflow-hidden flex items-center justify-center">
                  <img src={MOCK_PHOTO} alt="" className="w-20 h-20 rounded-lg object-cover opacity-80" />
                  {!scanComplete && (
                    <>
                      <div className="absolute inset-0 scanLineAnim" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="scanPulse w-24 h-24 rounded-full border-2 border-[#0047AB]/50" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="scanPulse w-32 h-32 rounded-full border border-[#0047AB]/30" style={{ animationDelay: "0.5s" }} />
                      </div>
                    </>
                  )}
                  {scanComplete && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30" style={{ animation: "fadeIn 0.3s ease-out" }}>
                      <div className="w-10 h-10 rounded-full bg-[#0047AB] flex items-center justify-center" style={{ animation: "scaleIn 0.4s ease-out" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                    </div>
                  )}
                </div>
                {!scanComplete && (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0047AB] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0047AB] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0047AB] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className={`text-xs ${mutedText}`}>Identifying item...</span>
                  </div>
                )}
                {scanComplete && (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                    <span className="text-xs text-[#0047AB] font-medium">Item recognized</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === RECOGNITION === */}
          {msg.type === "recognition" && msg.item && (
            <div className={`mt-2 rounded-2xl overflow-hidden border ${cardBorder}`}>
              <div className="relative h-44 bg-[#1a2e1a] overflow-hidden">
                <img src={msg.item.photo} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0047AB] text-white text-xs font-semibold shadow-lg">
                    98% match
                  </span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-[15px] font-semibold">{msg.item.title}</p>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Brand</span>
                  <span className={`text-sm font-medium ${textPrimary}`}>Gibson</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Model</span>
                  <span className={`text-sm font-medium ${textPrimary}`}>Les Paul Standard &apos;59 Reissue</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Condition</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-medium">{msg.item.condition}</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Estimated Value</span>
                  <span className={`text-sm font-semibold ${textPrimary}`}>{msg.item.value}</span>
                </div>
              </div>
            </div>
          )}

          {/* === CATEGORY === */}
          {msg.type === "category" && (
            <div className={`mt-2 rounded-2xl border p-4 ${cardBorder}`}>
              <div className="flex items-center flex-wrap gap-1.5 text-sm">
                {["Musical Instruments", "Guitars & Basses", "Electric Guitars", "Solid Body"].map((cat, ci) => (
                  <span key={ci} className="flex items-center gap-1.5">
                    {ci > 0 && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={textSecondary}><path d="M9 18l6-6-6-6" /></svg>}
                    <span className={ci === 3 ? `font-medium ${textPrimary}` : textSecondary}>{cat}</span>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <AiBadge label="AI Suggested" />
              </div>
            </div>
          )}

          {/* === COMPS === */}
          {msg.comps && (
            <>
              {/* Stats bar */}
              <div className={`mt-2 px-3 py-2 rounded-xl border ${cardBorder}`}>
                <p className={`text-xs font-mono ${textSecondary}`}>
                  12 sold · median <span className={`font-semibold ${textPrimary}`}>$1,450</span> · range $1,180–$1,890
                </p>
              </div>
              {/* Top 4 cards */}
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {msg.comps.map((comp, ci) => (
                  <div key={ci} className={`flex-shrink-0 w-44 rounded-xl border p-3 ${compCard}`}>
                    <p className={`text-sm truncate ${textSecondary}`}>{comp.title}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`font-semibold text-[15px] ${textPrimary}`}>${comp.price.toLocaleString()}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${comp.sold ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{comp.sold ? "Sold" : "Active"}</span>
                    </div>
                    {comp.date && <p className={`text-[11px] mt-1 ${mutedText}`}>{comp.date}</p>}
                  </div>
                ))}
              </div>
              {/* Expandable section */}
              <div className="mt-2">
                <button
                  onClick={() => setCompsExpanded(!compsExpanded)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${dark ? "border-white/10 bg-white/5 text-[#5B9BD5] hover:bg-white/8" : "border-[#0047AB]/20 bg-[#0047AB]/5 text-[#0047AB] hover:bg-[#0047AB]/10"}`}
                >
                  {compsExpanded ? "Hide comps ↑" : "See all 12 comps →"}
                </button>
                {compsExpanded && (
                  <div className={`mt-2 rounded-xl border overflow-hidden ${cardBorder}`} style={{ animation: "fadeSlideUp 0.2s ease-out" }}>
                    <div className="max-h-52 overflow-y-auto divide-y divide-[#E8E5DE] dark:divide-white/5">
                      {COMPS_FULL.map((comp, ci) => (
                        <div key={ci} className={`flex items-center justify-between px-3 py-2.5 ${dark ? "hover:bg-white/5" : "hover:bg-[#F8F7F4]"}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${textPrimary}`}>{comp.title}</p>
                            <p className={`text-[11px] ${mutedText}`}>{comp.condition} · {comp.date}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <span className={`font-semibold text-sm font-mono ${textPrimary}`}>${comp.price.toLocaleString()}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${comp.sold ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{comp.sold ? "Sold" : "Active"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* === LISTING PREVIEW === */}
          {msg.type === "listing-preview" && (
            <div className={`mt-2 rounded-2xl border overflow-hidden ${cardBorder}`}>
              <div className="p-4 space-y-3">
                {/* Title */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${textSecondary}`}>Title</span>
                    <AiBadge />
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm font-medium outline-none transition-colors ${editableField}`}
                  />
                </div>
                {/* Description */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${textSecondary}`}>Description</span>
                    <AiBadge />
                    <button className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${dark ? "bg-[#0047AB]/20 text-[#5B9BD5]" : "bg-[#0047AB]/10 text-[#0047AB]"}`}>
                      ✨ Regenerate
                    </button>
                  </div>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={4}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors resize-none ${editableField}`}
                  />
                </div>
                {/* Read-only fields */}
                <div className={`border-t pt-3 ${subtleBorder}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs ${textSecondary}`}>Category</span>
                    <span className={`text-xs ${textSecondary}`}>Musical Instruments › Electric Guitars › Solid Body</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs ${textSecondary}`}>Condition</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-medium">Like New</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${textSecondary}`}>Price</span>
                    <span className={`text-sm font-semibold ${textPrimary}`}>$1,450</span>
                  </div>
                </div>
                {/* Photo strip */}
                <div className={`border-t pt-3 ${subtleBorder}`}>
                  <span className={`text-xs ${textSecondary} mb-1.5 block`}>Photos</span>
                  <div className="flex gap-2">
                    {[0, 1, 2].map((pi) => (
                      <div key={pi} className="w-16 h-16 rounded-lg overflow-hidden bg-[#1a2e1a] border border-[#E8E5DE]">
                        <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" style={{ opacity: pi === 0 ? 1 : 0.6 + pi * 0.1 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Listing preview pills */}
              <div className={`border-t px-4 py-3 ${subtleBorder}`}>
                <div className="flex gap-2">
                  <button onClick={handlePillClick} className={`px-4 py-2.5 rounded-full border text-sm font-medium hover:opacity-80 active:scale-95 transition-all ${pillStyle}`}>
                    ✓ Looks good
                  </button>
                  <button className={`px-4 py-2.5 rounded-full border text-sm font-medium hover:opacity-80 active:scale-95 transition-all ${pillStyle}`}>
                    ✏️ Edit more
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === SHIPPING === */}
          {msg.type === "shipping" && (
            <div className={`mt-2 rounded-2xl border p-4 ${cardBorder}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📦</span>
                <div>
                  <p className={`text-sm font-medium ${textPrimary}`}>Large package · ~12 lbs</p>
                  <p className={`text-xs ${mutedText}`}>Estimated from item type</p>
                </div>
                <AiBadge label="Estimated" />
              </div>
            </div>
          )}

          {/* === CONFIRM (enhanced) === */}
          {msg.type === "confirm" && msg.item && (
            <div className={`mt-2 rounded-2xl overflow-hidden border ${dark ? "border-emerald-500/30 bg-emerald-950/30" : "border-[#2D5A27]/20 bg-[#F0F7EF]"}`}>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-xl bg-[#1a2e1a] overflow-hidden flex-shrink-0"><img src={msg.item.photo} alt="" className="w-full h-full object-cover" /></div>
                  <div>
                    <p className={`text-[15px] font-semibold ${textPrimary}`}>{msg.item.title}</p>
                    <p className="text-[#2D5A27] text-sm">{msg.item.condition}</p>
                  </div>
                </div>
                <div className={`space-y-0 divide-y ${dark ? "divide-white/5" : "divide-[#2D5A27]/10"}`}>
                  <div className="flex items-center justify-between py-2.5">
                    <span className={`text-sm ${mutedText}`}>Price</span>
                    <span className={`font-semibold text-xl ${textPrimary}`}>{msg.item.value}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className={`text-sm ${mutedText}`}>Marketplace</span>
                    <span className={`text-[15px] ${textPrimary}`}>🏷️ eBay</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className={`text-sm ${mutedText}`}>Category</span>
                    <span className={`text-xs ${textPrimary}`}>Electric Guitars › Solid Body</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className={`text-sm ${mutedText}`}>Condition</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-medium">Like New</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className={`text-sm ${mutedText}`}>Shipping</span>
                    <span className={`text-[15px] ${textPrimary}`}>📦 Free shipping</span>
                  </div>
                </div>
                <div className={`mt-3 pt-3 border-t ${dark ? "border-white/5" : "border-[#2D5A27]/10"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${mutedText}`}>eBay fees (est.)</span>
                    <span className={`text-xs ${mutedText}`}>~$189</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-sm font-medium ${dark ? "text-emerald-400" : "text-[#2D5A27]"}`}>You keep (est.)</span>
                    <span className={`text-sm font-semibold ${dark ? "text-emerald-400" : "text-[#2D5A27]"}`}>~$1,261</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === ITEM-CARD (original, for non-recognition, non-confirm) === */}
          {msg.item && msg.type === "item-card" && (
            <div className={`mt-2 rounded-2xl overflow-hidden border ${cardBorder}`}>
              <div className="relative h-44 bg-[#1a2e1a] overflow-hidden">
                <img src={msg.item.photo} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-[15px] font-semibold">{msg.item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">{msg.item.condition}</span>
                    <span className="text-white/60 text-sm">{msg.item.value}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === SUCCESS === */}
          {msg.type === "success" && (
            <div className="mt-3 text-center py-4">
              <div className="inline-flex w-16 h-16 rounded-full bg-[#2D5A27]/15 items-center justify-center mb-3" style={{ animation: "scaleIn 0.5s ease-out" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D5A27" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <p className="text-[#2D5A27] text-base font-semibold">Live on eBay</p>
            </div>
          )}

          {/* === LISTING DETAIL === */}
          {msg.type === "listing-detail" && (
            <div className={`mt-2 rounded-2xl border overflow-hidden ${cardBorder}`}>
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Status</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-semibold">Active</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>eBay Listing #</span>
                  <span className="text-sm text-[#0047AB] font-medium underline underline-offset-2 cursor-pointer">294718503921</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Price</span>
                  <span className={`text-sm font-semibold ${textPrimary}`}>$1,450</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Views</span>
                  <span className={`text-sm ${textPrimary}`}>0</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Watchers</span>
                  <span className={`text-sm ${textPrimary}`}>0</span>
                </div>
                <div className={`border-t ${subtleBorder}`} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Listed</span>
                  <span className={`text-sm ${textPrimary}`}>Just now</span>
                </div>
              </div>
            </div>
          )}

          {/* === PILLS (generic, for most message types) === */}
          {msg.pills && msg.type !== "success" && msg.type !== "listing-preview" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {msg.pills.map((pill) => (
                <button
                  key={pill.label}
                  onClick={pill.disabled ? undefined : handlePillClick}
                  className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${pill.disabled ? pillDisabled : `${pillStyle} hover:opacity-80 active:scale-95`}`}
                >
                  {pill.icon && <span className="mr-1">{pill.icon}</span>}{pill.label}
                  {pill.disabled && <span className="ml-1 text-[10px] opacity-50">soon</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 ${bg} flex flex-col transition-colors duration-300`} style={{ maxWidth: "430px", margin: "0 auto" }}>
      {/* Header */}
      <header className={`flex items-center gap-3 px-4 py-3 border-b ${headerBg} backdrop-blur-xl z-20`}>
        <Link href="/mockups" className={dark ? "text-white/40" : "text-[#6B6B6B]"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <div className="w-9 h-9 rounded-full bg-[#F15A22] flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.2 4.7 3 6.3V21l3.5-2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" /></svg>
        </div>
        <div className="flex-1">
          <h1 className={`text-base font-semibold font-[family-name:var(--font-instrument)] ${textPrimary}`}>Porter</h1>
          <p className="text-xs text-[#0047AB]">{isTyping ? "typing..." : "Online"}</p>
        </div>
        <button onClick={() => setDark(!dark)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${dark ? "bg-white/10 text-white/70" : "bg-[#1A1A1A] text-white"}`}>
          {dark ? "☀ Light" : "● Dark"}
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => renderMessage(msg, i))}
        {isTyping && (
          <div className="flex justify-start">
            <div className={`rounded-2xl rounded-bl-md px-4 py-3 border ${aiBubble}`}>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#2D5A27]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#2D5A27]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#2D5A27]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slash commands menu */}
      {slashOpen && (
        <div className="px-4 pb-1">
          <div className={`rounded-xl border overflow-hidden ${dark ? "border-white/10 bg-[#141a14]/95" : "border-[#E8E5DE] bg-white shadow-lg"}`}>
            {[{ cmd: "/list", desc: "Create a listing" }, { cmd: "/comps", desc: "Check comparable prices" }, { cmd: "/scan", desc: "Scan a new item" }, { cmd: "/price", desc: "Price check" }].map((c) => (
              <button key={c.cmd} className={`w-full flex items-center gap-3 px-4 py-3 text-left ${dark ? "hover:bg-white/5" : "hover:bg-[#F0F7EF]"} transition-colors`} onClick={() => setSlashOpen(false)}>
                <span className="text-[#2D5A27] text-sm font-mono">{c.cmd}</span><span className={`text-sm ${mutedText}`}>{c.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className={`border-t px-4 py-3 pb-safe ${dark ? "border-white/5 bg-[#0A0A0A]" : "border-[#E8E5DE] bg-[#F8F7F4]"}`}>
        <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setSlashOpen(!slashOpen)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-mono ${actionPill}`}><span className="text-sm">/</span> commands</button>
          <button className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs ${actionPill}`}>📎 attach</button>
          <a href="/mockups/camera" className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs ${actionPill}`}>📸 scan</a>
        </div>
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="Ask Porter anything..." className={`flex-1 pl-4 pr-4 py-3 rounded-2xl border text-[15px] focus:border-[#0047AB] focus:outline-none transition-colors ${inputBg}`} onFocus={() => setSlashOpen(false)} />
          <button className="w-11 h-11 rounded-2xl bg-[#F15A22] flex items-center justify-center active:scale-95 transition-all flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Walkthrough overlay */}
      {currentWt && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {(wtStep === 0 || isLastWt) && (
            <div className="pointer-events-auto" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: "430px", height: "100%" }}>
              <div className="absolute inset-0 bg-black/60" onClick={wtStep === 0 ? advanceWalkthrough : handleRestart} />
            </div>
          )}
          <div
            className="pointer-events-auto"
            style={{
              position: "fixed",
              left: "calc(50% + 235px)",
              width: "320px",
              ...(currentWt.position === "top" ? { top: "100px" } : currentWt.position === "bottom" ? { bottom: "100px" } : { top: "50%", transform: "translateY(-50%)" }),
              animation: "fadeSlideIn 0.3s ease-out",
            }}
          >
            <div style={{ position: "absolute", left: "-20px", top: "50%", width: "20px", height: "2px", background: "rgba(245,158,11,0.4)", transform: "translateY(-50%)" }} />
            <div style={{ position: "absolute", left: "-24px", top: "50%", width: "8px", height: "8px", borderRadius: "50%", background: "rgba(245,158,11,0.5)", transform: "translate(-50%, -50%)" }} />
            <div className="rounded-2xl border border-amber-400/40 bg-[#1C1508] p-5 shadow-2xl" style={{ boxShadow: "0 0 40px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.4)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1">{WALKTHROUGH.map((_, i) => <div key={i} className={`w-2 h-2 rounded-full ${i === wtStep ? "bg-amber-400" : i < wtStep ? "bg-amber-400/40" : "bg-white/10"}`} />)}</div>
                <span className="text-amber-400/60 text-xs font-mono ml-1">{wtStep + 1}/{WALKTHROUGH.length}</span>
              </div>
              <h3 className="text-amber-200 text-base font-semibold mb-2">{currentWt.title}</h3>
              <p className="text-amber-100/60 text-sm leading-relaxed mb-4">{currentWt.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-amber-400 text-sm font-medium">→ {currentWt.action}</p>
                {wtStep === 0 && <button onClick={advanceWalkthrough} className="px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors">Start →</button>}
                {isLastWt && (
                  <div className="flex gap-2">
                    <button onClick={handleRestart} className="px-4 py-2 rounded-full bg-white/10 text-white/60 text-sm font-medium hover:bg-white/15 transition-colors">Replay</button>
                    <Link href="/mockups" className="px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors">Back</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DevSteps direction="Conversational" steps={WALKTHROUGH} currentStep={wtStep} />
      <ReviewComments direction="conversational" currentStep={wtStep} />

      <style jsx>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        @keyframes scanLine {
          0% { top: 0; opacity: 0.8; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0.8; }
        }
        @keyframes scanPulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.2; }
          100% { transform: scale(0.8); opacity: 0.6; }
        }
        .scanLineAnim::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #0047AB, transparent);
          box-shadow: 0 0 12px 2px rgba(0,71,171,0.4);
          animation: scanLine 1.5s ease-in-out infinite;
        }
        .scanPulse {
          animation: scanPulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
