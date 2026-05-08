"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ReviewComments } from "@/components/review-comments";
import { DevSteps } from "@/components/dev-steps";

const MOCK_PHOTO = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect fill="#1a2e1a" width="400" height="400"/>
    <text x="200" y="180" text-anchor="middle" fill="#4CAF50" font-size="60" font-family="serif">&#127928;</text>
    <text x="200" y="240" text-anchor="middle" fill="#aaa" font-size="18" font-family="sans-serif">Gibson Les Paul</text>
    <text x="200" y="265" text-anchor="middle" fill="#666" font-size="13" font-family="sans-serif">Standard '59 Reissue</text>
  </svg>`
);

const MOCK_PHOTO_2 = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect fill="#1e1a2e" width="400" height="400"/>
    <text x="200" y="200" text-anchor="middle" fill="#8B5CF6" font-size="48" font-family="serif">&#127928;</text>
    <text x="200" y="250" text-anchor="middle" fill="#888" font-size="12" font-family="sans-serif">Angle 2</text>
  </svg>`
);

const MOCK_PHOTO_3 = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect fill="#2e1a1a" width="400" height="400"/>
    <text x="200" y="200" text-anchor="middle" fill="#EF4444" font-size="48" font-family="serif">&#127928;</text>
    <text x="200" y="250" text-anchor="middle" fill="#888" font-size="12" font-family="sans-serif">Headstock</text>
  </svg>`
);

const COMPS = [
  { title: "LP Std '59 Reissue Sunburst", price: 1380, sold: true, date: "Apr 28" },
  { title: "Gibson Les Paul Standard VOS", price: 1520, sold: true, date: "Apr 25" },
  { title: "Les Paul '59 RI Cherry", price: 1450, sold: true, date: "Apr 22" },
  { title: "Gibson LP Standard R9", price: 1650, sold: true, date: "Apr 18" },
  { title: "Les Paul '59 Reissue Tobacco", price: 1280, sold: true, date: "Apr 15" },
  { title: "Gibson LP Std '59 Aged", price: 1890, sold: true, date: "Apr 10" },
  { title: "LP Custom '57 Reissue", price: 1180, sold: false, date: "Active" },
  { title: "Gibson Les Paul R9 VOS", price: 1550, sold: false, date: "Active" },
];

const AI_DESCRIPTION = "Gibson Les Paul Standard '59 Reissue in excellent condition. Cherry sunburst finish with AAA flame maple top. PAF-style humbuckers, ABR-1 bridge, lightweight aluminum tailpiece. Brazilian rosewood fingerboard with trapezoid inlays. Long neck tenon for superior sustain. Includes original hardshell case and certificate of authenticity.";

const CATEGORY_PARTS = ["Musical Instruments", "Guitars & Basses", "Electric Guitars", "Solid Body"];

type CardState = "idle" | "scanning" | "category" | "marketplace" | "details" | "pricing" | "shipping" | "review" | "published";

interface ChatMsg {
  role: "user" | "assistant";
  text?: string;
}

interface WalkthroughStep {
  title: string;
  description: string;
  action: string;
  position: "top" | "center" | "bottom";
}

const WALKTHROUGH: WalkthroughStep[] = [
  {
    title: "Welcome to Direction C",
    description: "This is 'Hybrid' -- Porter chat as the hub, with a context-aware action bar. Structured listing cards appear inline in the conversation. Best of both worlds.",
    action: "Tap anywhere to begin",
    position: "center",
  },
  {
    title: "Step 1: Context-aware actions",
    description: "The action bar above the prompt changes based on context. Right now it shows default actions. Notice the /commands and attachment buttons in the prompt area.",
    action: "Tap 'List it' in the action bar",
    position: "bottom",
  },
  {
    title: "Step 2: AI scans your item",
    description: "Porter analyzes your item photos using AI vision. The scanning card shows real-time analysis with confidence scoring and value estimation.",
    action: "Tap 'Confirm' to accept identification",
    position: "center",
  },
  {
    title: "Step 3: Category suggestion",
    description: "Porter auto-categorizes the item using marketplace taxonomy. The breadcrumb shows the full category path. You can accept or change it.",
    action: "Tap 'Looks right' to confirm",
    position: "center",
  },
  {
    title: "Step 4: Choose marketplace",
    description: "A structured card appears inline showing available marketplaces. Each option shows fees and availability. Everything stays in the conversation flow.",
    action: "Tap a marketplace option",
    position: "center",
  },
  {
    title: "Step 5: AI-generated listing",
    description: "Porter drafts the full listing with AI -- title, description, condition, photos. Fields are editable inline. Regenerate any section with one tap.",
    action: "Tap 'Looks good' to continue",
    position: "center",
  },
  {
    title: "Step 6: Price with comps context",
    description: "Pricing card shows comparable sold listings. Expand to see all 8 comps with prices and dates. The suggested price comes from market data.",
    action: "Tap 'Accept $1,450' to continue",
    position: "center",
  },
  {
    title: "Step 7: Shipping options",
    description: "Shipping card shows package details and method options. Pick free, calculated, or flat rate -- all inline without leaving the chat.",
    action: "Choose a shipping method",
    position: "center",
  },
  {
    title: "Step 8: Review & publish",
    description: "Full summary card with every detail: photos, title, price, marketplace, category, shipping, fee estimates. Publish or save as draft.",
    action: "Tap 'Publish' to list",
    position: "center",
  },
  {
    title: "Listed!",
    description: "Success with listing details inline -- status badge, listing ID, real-time stats. The action bar returns with context-aware actions for your live listing.",
    action: "Walkthrough complete -- tap to restart or go back",
    position: "center",
  },
];

export default function HybridMockup() {
  const [dark, setDark] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", text: "Hey! I see you have a Gibson Les Paul in your inventory. Want to list it?" },
  ]);
  const [cardState, setCardState] = useState<CardState>("idle");
  const [marketplace, setMarketplace] = useState<string | null>(null);
  const [price, setPrice] = useState("1450");
  const [isTyping, setIsTyping] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [wtStep, setWtStep] = useState(0);
  const [scanPhase, setScanPhase] = useState<"scanning" | "result">("scanning");
  const [compsExpanded, setCompsExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState("Gibson Les Paul Standard '59 Reissue Cherry Sunburst");
  const [editDesc, setEditDesc] = useState(AI_DESCRIPTION);
  const [shippingMethod, setShippingMethod] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, cardState, isTyping, scanPhase, compsExpanded]);

  /* ---- Theme tokens ---- */
  const pageBg = dark
    ? "linear-gradient(180deg, #0A0A14 0%, #0F0F1A 100%)"
    : "linear-gradient(180deg, #F8F7F4 0%, #F0EDE6 100%)";
  const headerBg = dark ? "bg-[#0A0A14]/95" : "bg-[#F8F7F4]/95";
  const headerBorder = dark ? "border-white/5" : "border-[#E8E5DE]";
  const headerTitle = dark ? "text-white" : "text-[#1A1A1A]";
  const headerSub = dark ? "text-violet-400/70" : "text-[#0047AB]/70";
  const dirBadge = dark ? "text-white/20 border-white/10" : "text-[#8A8A8A] border-[#E8E5DE] bg-white/60";
  const backColor = dark ? "text-white/40 hover:text-white/70" : "text-[#6B6B6B] hover:text-[#1A1A1A]";
  const userBubble = dark ? "bg-violet-600 text-white" : "bg-[#F15A22] text-white";
  const aiBubble = dark
    ? "bg-white/8 text-white/90 border border-white/5"
    : "bg-white text-[#1A1A1A] border border-[#E8E5DE] shadow-sm";
  const inlineCardBorder = dark ? "border-violet-500/20" : "border-[#0047AB]/20";
  const inlineCardBg = dark ? "bg-violet-950/20 backdrop-blur-sm" : "bg-white shadow-sm";
  const cardItemTitle = dark ? "text-white" : "text-[#1A1A1A]";
  const cardItemSub = dark ? "text-white/40" : "text-[#8A8A8A]";
  const labelColor = dark ? "text-white/30" : "text-[#6B6B6B]";
  const mpBtnActive = dark ? "bg-violet-500 text-white" : "bg-[#F15A22] text-white";
  const mpBtnInactive = dark
    ? "bg-white/5 text-white/50 border border-white/10 hover:border-violet-500/30"
    : "bg-[#F0EDE6] text-[#6B6B6B] border border-[#E8E5DE] hover:border-[#0047AB]/30";
  const priceInputBg = dark
    ? "bg-white/5 border-white/10 text-white focus:border-violet-500/50"
    : "bg-[#F8F7F4] border-[#E8E5DE] text-[#1A1A1A] focus:border-[#0047AB]/50";
  const priceDollar = dark ? "text-white/30" : "text-[#8A8A8A]";
  const reviewLabel = dark ? "text-white/40" : "text-[#8A8A8A]";
  const reviewValue = dark ? "text-white" : "text-[#1A1A1A]";
  const reviewBorder = dark ? "border-white/5" : "border-[#E8E5DE]";
  const editBtn = dark ? "bg-white/5 text-white/60 border-white/10" : "bg-[#F0EDE6] text-[#6B6B6B] border-[#E8E5DE]";
  const publishBtn = dark ? "bg-violet-600 hover:bg-violet-500" : "bg-[#F15A22] hover:bg-[#d94e1c]";
  const successBorder = dark ? "border-emerald-500/20" : "border-[#F15A22]/20";
  const successBg = dark ? "bg-emerald-950/20" : "bg-[#F15A22]/5";
  const successText = dark ? "text-emerald-400" : "text-[#F15A22]";
  const typingDot = dark ? "bg-violet-400/50" : "bg-[#F15A22]/40";
  const actionBarBg = dark ? "border-white/5" : "border-[#E8E5DE]";
  const actionPill = dark
    ? "bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/20"
    : "bg-[#0047AB]/8 border-[#0047AB]/20 text-[#0047AB] hover:bg-[#0047AB]/15";
  const slashPaletteBg = dark ? "bg-[#12121f]/95" : "bg-white/95 shadow-lg";
  const slashPaletteBorder = dark ? "border-white/10" : "border-[#E8E5DE]";
  const slashCmd = dark ? "text-violet-400" : "text-[#0047AB]";
  const slashDesc = dark ? "text-white/40" : "text-[#8A8A8A]";
  const promptBarBg = dark
    ? "linear-gradient(180deg, #0A0A14 0%, #08080F 100%)"
    : "linear-gradient(180deg, #F8F7F4 0%, #F0EDE6 100%)";
  const promptBorder = dark ? "border-white/5" : "border-[#E8E5DE]";
  const attachBtn = dark
    ? "bg-white/5 border-white/10 text-white/30 hover:text-violet-400 hover:border-violet-500/30"
    : "bg-white border-[#E8E5DE] text-[#8A8A8A] hover:text-[#0047AB] hover:border-[#0047AB]/30";
  const inputBg = dark
    ? "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-violet-500/40"
    : "bg-white border-[#E8E5DE] text-[#1A1A1A] placeholder:text-[#BCBCBC] focus:border-[#0047AB]/40";
  const sendBtn = dark ? "bg-violet-600 hover:bg-violet-500" : "bg-[#F15A22] hover:bg-[#d94e1c]";
  const aiBadge = dark ? "bg-violet-500/20 text-violet-300" : "bg-[#0047AB]/10 text-[#0047AB]";
  const fieldBg = dark ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7F4] border-[#E8E5DE] text-[#1A1A1A]";
  const fieldFocus = dark ? "focus:border-violet-500/50" : "focus:border-[#0047AB]/50";
  const compRowBg = dark ? "hover:bg-white/5" : "hover:bg-[#F8F7F4]";
  const compSold = dark ? "text-emerald-400" : "text-emerald-600";
  const compActive = dark ? "text-[#0047AB]" : "text-[#0047AB]";
  const breadcrumbBg = dark ? "bg-white/5 text-white/60" : "bg-[#F8F7F4] text-[#6B6B6B]";
  const breadcrumbArrow = dark ? "text-white/20" : "text-[#BCBCBC]";
  const pillSelected = dark ? "bg-violet-500 text-white border-violet-500" : "bg-[#F15A22] text-white border-[#F15A22]";
  const pillUnselected = dark ? "bg-white/5 text-white/50 border-white/10" : "bg-[#F0EDE6] text-[#6B6B6B] border-[#E8E5DE]";
  const scanOverlay = dark ? "from-violet-500/20 via-transparent to-violet-500/20" : "from-[#0047AB]/15 via-transparent to-[#0047AB]/15";
  const confidenceBadge = dark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-700";

  /* ---- Walkthrough helpers ---- */
  function advanceWt() {
    if (wtStep === 0) setWtStep(1);
  }

  /* ---- State transition handlers ---- */
  function handleListAction() {
    setMsgs((prev) => [...prev, { role: "user", text: "List my Les Paul" }]);
    setIsTyping(true);
    setWtStep(2);
    setScanPhase("scanning");
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: "Let me analyze your item..." }]);
      setCardState("scanning");
      // Auto-advance scan phase after 1.5s
      setTimeout(() => {
        setScanPhase("result");
      }, 1500);
    }, 600);
  }

  function handleConfirmScan() {
    setMsgs((prev) => [...prev, { role: "user", text: "That's correct" }]);
    setIsTyping(true);
    setWtStep(3);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: "I'd categorize this as:" }]);
      setCardState("category");
    }, 400);
  }

  function handleConfirmCategory() {
    setMsgs((prev) => [...prev, { role: "user", text: "Looks right" }]);
    setIsTyping(true);
    setWtStep(4);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: "Where would you like to list it?" }]);
      setCardState("marketplace");
    }, 400);
  }

  function handleMarketplaceSelect(mp: string) {
    if (mp === "Etsy") return; // disabled
    setMarketplace(mp);
    setMsgs((prev) => [...prev, { role: "user", text: `List on ${mp}` }]);
    setIsTyping(true);
    setWtStep(5);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: "Here's your AI-generated listing:" }]);
      setCardState("details");
    }, 500);
  }

  function handleDetailsConfirm() {
    setMsgs((prev) => [...prev, { role: "user", text: "Looks good" }]);
    setIsTyping(true);
    setWtStep(6);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: "Based on 12 sold listings, I'd suggest $1,450. Here are the comps:" }]);
      setCardState("pricing");
    }, 500);
  }

  function handlePriceAccept() {
    setMsgs((prev) => [...prev, { role: "user", text: `Price at $${price}` }]);
    setIsTyping(true);
    setWtStep(7);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: "How should we ship it?" }]);
      setCardState("shipping");
    }, 400);
  }

  function handleShippingSelect(method: string) {
    setShippingMethod(method);
    setMsgs((prev) => [...prev, { role: "user", text: `${method} shipping` }]);
    setIsTyping(true);
    setWtStep(8);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: "Here's your listing summary. Tap publish when ready." }]);
      setCardState("review");
    }, 400);
  }

  function handlePublish() {
    setMsgs((prev) => [...prev, { role: "user", text: "Publish it!" }]);
    setIsTyping(true);
    setWtStep(9);
    setTimeout(() => {
      setIsTyping(false);
      setMsgs((prev) => [...prev, { role: "assistant", text: `Your Gibson Les Paul is live on ${marketplace} at $${price}!` }]);
      setCardState("published");
    }, 1200);
  }

  function handleRestart() {
    setMsgs([{ role: "assistant", text: "Hey! I see you have a Gibson Les Paul in your inventory. Want to list it?" }]);
    setCardState("idle");
    setMarketplace(null);
    setPrice("1450");
    setWtStep(0);
    setIsTyping(false);
    setInputVal("");
    setSlashOpen(false);
    setScanPhase("scanning");
    setCompsExpanded(false);
    setEditTitle("Gibson Les Paul Standard '59 Reissue Cherry Sunburst");
    setEditDesc(AI_DESCRIPTION);
    setShippingMethod(null);
  }

  /* ---- Context-aware action bar ---- */
  const contextActions = (() => {
    switch (cardState) {
      case "idle":
        return [
          { label: "List it", icon: "📋", action: handleListAction },
          { label: "Check comps", icon: "💰", action: () => {} },
          { label: "Scan new", icon: "📸", action: () => { window.location.href = "/mockups/camera"; } },
          { label: "Orders", icon: "📦", action: () => {} },
        ];
      case "scanning":
        return scanPhase === "result"
          ? [
              { label: "Confirm", icon: "✓", action: handleConfirmScan },
              { label: "Wrong item", icon: "✗", action: () => {} },
            ]
          : [];
      case "category":
        return [
          { label: "Looks right", icon: "✓", action: handleConfirmCategory },
          { label: "Change", icon: "✏️", action: () => {} },
        ];
      case "marketplace":
        return [];
      case "details":
        return [
          { label: "Looks good", icon: "✓", action: handleDetailsConfirm },
          { label: "Edit more", icon: "✏️", action: () => {} },
        ];
      case "pricing":
        return [
          { label: `Accept $${price}`, icon: "✓", action: handlePriceAccept },
          { label: "Set my own", icon: "💲", action: () => {} },
        ];
      case "shipping":
        return [
          { label: "Free shipping", icon: "🎁", action: () => handleShippingSelect("Free") },
          { label: "Calculated", icon: "📐", action: () => handleShippingSelect("Calculated") },
          { label: "Flat rate", icon: "📦", action: () => handleShippingSelect("Flat $15") },
        ];
      case "review":
        return [];
      case "published":
        return [
          { label: "View on eBay", icon: "↗", action: () => {} },
          { label: "Edit listing", icon: "✏️", action: () => {} },
          { label: "List on Reverb", icon: "🎸", action: () => {} },
          { label: "End listing", icon: "🛑", action: () => {} },
        ];
      default:
        return [];
    }
  })();

  const slashCommands = [
    { cmd: "/list", desc: "Create a marketplace listing", action: handleListAction },
    { cmd: "/comps", desc: "Check comparable prices" },
    { cmd: "/scan", desc: "Scan a new item", action: () => { window.location.href = "/mockups/camera"; } },
    { cmd: "/price", desc: "Get a price suggestion" },
    { cmd: "/status", desc: "Check listing statuses" },
  ];

  const currentWt = WALKTHROUGH[wtStep];
  const isLastWt = wtStep >= WALKTHROUGH.length - 1;

  const feeAmount = Math.round(Number(price) * 0.1325);
  const netAmount = Number(price) - feeAmount;

  /* ---- Inline card content ---- */
  function renderInlineCard() {
    if (cardState === "idle" || cardState === "published") return null;

    return (
      <div style={{ animation: "slideUp 0.3s ease-out" }}>
        <div className={`rounded-2xl border ${inlineCardBorder} ${inlineCardBg} overflow-hidden`}>

          {/* --- SCANNING --- */}
          {cardState === "scanning" && (
            <div className="p-4">
              {scanPhase === "scanning" ? (
                <div className="relative">
                  <div className={`w-full h-48 rounded-xl overflow-hidden border ${dark ? "border-white/10" : "border-[#E8E5DE]"} relative`}>
                    <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
                    {/* Scan overlay */}
                    <div className="absolute inset-0">
                      <div className={`absolute inset-0 bg-gradient-to-b ${scanOverlay} opacity-60`} />
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="scan-line absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#0047AB] to-transparent opacity-80" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className={`${dark ? "bg-black/60" : "bg-white/80"} backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2`}>
                        <div className="w-2 h-2 rounded-full bg-[#0047AB] animate-pulse" />
                        <span className={`text-xs font-medium ${dark ? "text-white/70" : "text-[#6B6B6B]"}`}>Analyzing item...</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-16 h-16 rounded-xl overflow-hidden border ${dark ? "border-white/10" : "border-[#E8E5DE]"} flex-shrink-0`}>
                      <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`${cardItemTitle} text-[15px] font-semibold`}>Gibson Les Paul Standard &apos;59 Reissue</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${confidenceBadge}`}>98% match</span>
                        <span className={`${cardItemSub} text-xs`}>Like New</span>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-xl ${dark ? "bg-white/5" : "bg-[#F8F7F4]"} px-3 py-2.5 flex items-center justify-between`}>
                    <span className={`${labelColor} text-xs`}>Estimated Value</span>
                    <span className={`${cardItemTitle} text-lg font-bold`}>$1,350 - $1,650</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- CATEGORY --- */}
          {cardState === "category" && (
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORY_PARTS.map((part, i) => (
                  <div key={part} className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-1.5 rounded-lg text-[13px] ${breadcrumbBg}`}>{part}</span>
                    {i < CATEGORY_PARTS.length - 1 && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={breadcrumbArrow}><path d="M9 18l6-6-6-6" /></svg>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${aiBadge}`}>&#10024; AI-suggested</span>
              </div>
            </div>
          )}

          {/* --- MARKETPLACE --- */}
          {cardState === "marketplace" && (
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl overflow-hidden border ${dark ? "border-white/10" : "border-[#E8E5DE]"} flex-shrink-0`}>
                  <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className={`${cardItemTitle} text-[15px] font-semibold`}>Gibson Les Paul Std &apos;59</p>
                  <p className={`${cardItemSub} text-xs`}>Like New &middot; 3 photos</p>
                </div>
              </div>
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-2`}>Where?</p>
              <div className="flex gap-2 mb-3">
                {[
                  { label: "eBay", icon: "🏷️", enabled: true },
                  { label: "Reverb", icon: "🎸", enabled: true },
                  { label: "Etsy", icon: "🧵", enabled: false },
                ].map((mp) => (
                  <button
                    key={mp.label}
                    onClick={() => mp.enabled && handleMarketplaceSelect(mp.label)}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all relative ${
                      !mp.enabled
                        ? `${dark ? "bg-white/3 text-white/20 border border-white/5" : "bg-gray-100 text-gray-300 border border-gray-200"} cursor-not-allowed`
                        : marketplace === mp.label ? mpBtnActive : mpBtnInactive
                    }`}
                  >
                    {mp.icon} {mp.label}
                    {!mp.enabled && (
                      <span className={`absolute -top-1 -right-1 text-[8px] px-1.5 py-0.5 rounded-full ${dark ? "bg-white/10 text-white/30" : "bg-gray-200 text-gray-400"}`}>Soon</span>
                    )}
                  </button>
                ))}
              </div>
              {marketplace && (
                <div className={`rounded-lg ${dark ? "bg-white/5" : "bg-[#F8F7F4]"} px-3 py-2 flex items-center gap-2`} style={{ animation: "fadeIn 0.2s ease-out" }}>
                  <span className={`text-xs ${dark ? "text-white/40" : "text-[#8A8A8A]"}`}>{marketplace} Standard listing &middot; 13.25% final value fee</span>
                </div>
              )}
            </div>
          )}

          {/* --- DETAILS --- */}
          {cardState === "details" && (
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Title</label>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${aiBadge}`}>&#10024; AI</span>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-[14px] font-medium focus:outline-none transition-colors ${fieldBg} ${fieldFocus}`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Description</label>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${aiBadge}`}>&#10024; AI</span>
                  </div>
                  <button className={`text-[11px] font-medium ${dark ? "text-violet-400 hover:text-violet-300" : "text-[#0047AB] hover:text-[#003380]"} transition-colors`}>&#10024; Regenerate</button>
                </div>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2.5 rounded-xl border text-[13px] leading-relaxed focus:outline-none transition-colors resize-none ${fieldBg} ${fieldFocus}`}
                />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <label className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Condition</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-3 py-1.5 rounded-full text-[12px] font-medium ${dark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>Like New</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Category</label>
                  <div className="mt-1 flex items-center gap-1 overflow-x-auto">
                    {CATEGORY_PARTS.map((part, i) => (
                      <span key={part} className={`text-[11px] ${dark ? "text-white/40" : "text-[#8A8A8A]"} whitespace-nowrap`}>
                        {part}{i < CATEGORY_PARTS.length - 1 ? " >" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Photos</label>
                <div className="flex gap-2 mt-1.5">
                  {[MOCK_PHOTO, MOCK_PHOTO_2, MOCK_PHOTO_3].map((photo, i) => (
                    <div key={i} className={`w-16 h-16 rounded-xl overflow-hidden border ${dark ? "border-white/10" : "border-[#E8E5DE]"}`}>
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- PRICING --- */}
          {cardState === "pricing" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${priceDollar} text-[15px]`}>$</span>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                    className={`w-full pl-7 pr-4 py-3 rounded-xl border ${priceInputBg} text-lg font-semibold focus:outline-none transition-colors`}
                  />
                </div>
                <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-medium ${aiBadge}`}>&#10024; AI-suggested</span>
              </div>
              {/* Comps summary / expandable */}
              <div>
                <button
                  onClick={() => setCompsExpanded(!compsExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl ${dark ? "bg-white/5 hover:bg-white/8" : "bg-[#F8F7F4] hover:bg-[#F0EDE6]"} transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                    <span className={`${dark ? "text-white/60" : "text-[#6B6B6B]"} text-[13px]`}>Based on 12 sold listings &middot; median $1,450</span>
                  </div>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`${dark ? "text-white/30" : "text-[#BCBCBC]"} transition-transform ${compsExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {compsExpanded && (
                  <div className={`mt-2 rounded-xl border ${dark ? "border-white/5" : "border-[#E8E5DE]"} overflow-hidden`} style={{ animation: "slideUp 0.2s ease-out" }}>
                    {COMPS.map((comp, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 ${compRowBg} ${i > 0 ? `border-t ${dark ? "border-white/5" : "border-[#E8E5DE]"}` : ""} transition-colors`}>
                        <div className="flex-1 min-w-0">
                          <p className={`${cardItemTitle} text-[12px] truncate`}>{comp.title}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-2">
                          <span className={`text-[13px] font-semibold ${cardItemTitle}`}>${comp.price.toLocaleString()}</span>
                          <span className={`text-[10px] font-medium ${comp.sold ? compSold : compActive}`}>
                            {comp.sold ? `Sold ${comp.date}` : comp.date}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- SHIPPING --- */}
          {cardState === "shipping" && (
            <div className="p-4 space-y-3">
              <div className={`flex items-center justify-between py-2`}>
                <div className="flex items-center gap-2">
                  <span className={`${labelColor} text-xs`}>Package</span>
                  <span className={`${cardItemTitle} text-[13px] font-medium`}>Large (guitar)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${labelColor} text-xs`}>Weight</span>
                  <span className={`${cardItemTitle} text-[13px] font-medium`}>~12 lbs</span>
                </div>
              </div>
              <div className={`border-t ${reviewBorder}`} />
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Method</p>
              <div className="flex gap-2">
                {[
                  { label: "Free", icon: "🎁", sub: "You pay" },
                  { label: "Calculated", icon: "📐", sub: "Buyer pays" },
                  { label: "Flat $15", icon: "📦", sub: "Buyer pays" },
                ].map((m) => (
                  <button
                    key={m.label}
                    onClick={() => handleShippingSelect(m.label)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-[13px] font-medium transition-all border ${
                      shippingMethod === m.label ? pillSelected : pillUnselected
                    }`}
                  >
                    <span className="text-lg">{m.icon}</span>
                    <span>{m.label}</span>
                    <span className={`text-[10px] ${shippingMethod === m.label ? "text-white/60" : labelColor}`}>{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* --- REVIEW --- */}
          {cardState === "review" && (
            <div className="p-4 space-y-3">
              {/* Photo strip */}
              <div className="flex gap-2 mb-1">
                {[MOCK_PHOTO, MOCK_PHOTO_2, MOCK_PHOTO_3].map((photo, i) => (
                  <div key={i} className={`w-16 h-16 rounded-xl overflow-hidden border ${dark ? "border-white/10" : "border-[#E8E5DE]"}`}>
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              {/* Title */}
              <p className={`${cardItemTitle} text-[15px] font-semibold leading-snug`}>{editTitle}</p>
              {/* Description preview */}
              <p className={`${cardItemSub} text-[12px] leading-relaxed line-clamp-2`}>{editDesc}</p>
              {/* Detail rows */}
              <div className={`border-t ${reviewBorder}`} />
              <div className="space-y-0">
                {[
                  { label: "Price", value: `$${price}`, bold: true },
                  { label: "Marketplace", value: marketplace || "eBay" },
                  { label: "Category", value: CATEGORY_PARTS[CATEGORY_PARTS.length - 1] },
                  { label: "Condition", value: "Like New" },
                  { label: "Shipping", value: shippingMethod || "Free" },
                ].map((row) => (
                  <div key={row.label} className={`flex items-center justify-between py-1.5 border-t ${reviewBorder} first:border-t-0`}>
                    <span className={`${reviewLabel} text-[13px]`}>{row.label}</span>
                    <span className={`${reviewValue} text-[14px] ${row.bold ? "font-bold" : ""}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              {/* Fee estimate */}
              <div className={`rounded-xl ${dark ? "bg-amber-500/10" : "bg-amber-50"} px-3 py-2.5 flex items-center justify-between`}>
                <span className={`text-xs ${dark ? "text-amber-400/70" : "text-amber-700/70"}`}>eBay fees: ~${feeAmount}</span>
                <span className={`text-sm font-bold ${dark ? "text-emerald-400" : "text-emerald-700"}`}>Net: ~${netAmount.toLocaleString()}</span>
              </div>
              {/* Buttons */}
              <div className="flex gap-2">
                <button onClick={() => setCardState("details")} className={`flex-1 py-2.5 rounded-xl ${editBtn} text-[13px] font-medium border`}>Save Draft</button>
                <button onClick={handlePublish} className={`flex-1 py-2.5 rounded-xl ${publishBtn} text-white text-[13px] font-medium active:scale-95 transition-all flex items-center justify-center gap-1.5`}>
                  Publish <span className="text-base">🚀</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  /* ---- Published card ---- */
  function renderPublishedCard() {
    if (cardState !== "published") return null;
    return (
      <div className="flex justify-start" style={{ animation: "scaleIn 0.4s ease-out" }}>
        <div className={`rounded-2xl border ${successBorder} ${successBg} backdrop-blur-sm px-4 py-4 w-full`}>
          {/* Success header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full ${dark ? "bg-emerald-500/20" : "bg-[#F15A22]/10"} flex items-center justify-center flex-shrink-0`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dark ? "#4CAF50" : "#F15A22"} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div>
              <p className={`${successText} font-semibold text-[15px]`}>Live on {marketplace}</p>
              <p className={`${dark ? "text-white/40" : "text-[#8A8A8A]"} text-[12px]`}>Just now</p>
            </div>
            <span className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${dark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>
          {/* Listing detail */}
          <div className={`rounded-xl border ${dark ? "border-white/5" : "border-[#E8E5DE]"} ${dark ? "bg-white/5" : "bg-white"} p-3 space-y-2`}>
            <div className="flex items-start gap-3">
              <div className={`w-14 h-14 rounded-lg overflow-hidden border ${dark ? "border-white/10" : "border-[#E8E5DE]"}`}>
                <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${cardItemTitle} text-[13px] font-semibold truncate`}>{editTitle}</p>
                <p className={`${dark ? "text-white/60" : "text-[#F15A22]"} text-[15px] font-bold mt-0.5`}>${price}</p>
              </div>
            </div>
            <div className={`border-t ${dark ? "border-white/5" : "border-[#E8E5DE]"} pt-2 grid grid-cols-3 gap-2`}>
              <div className="text-center">
                <p className={`text-[18px] font-bold ${cardItemTitle}`}>0</p>
                <p className={`text-[10px] ${cardItemSub}`}>Views</p>
              </div>
              <div className="text-center">
                <p className={`text-[18px] font-bold ${cardItemTitle}`}>0</p>
                <p className={`text-[10px] ${cardItemSub}`}>Watchers</p>
              </div>
              <div className="text-center">
                <p className={`text-[10px] font-mono ${cardItemSub} mt-1`}>eBay ID</p>
                <p className={`text-[11px] font-mono ${dark ? "text-white/60" : "text-[#6B6B6B]"}`}>394827153</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col transition-colors duration-300" style={{ maxWidth: "430px", margin: "0 auto", background: pageBg }}>
      {/* Header */}
      <header className={`flex items-center gap-3 px-4 py-3 border-b ${headerBorder} ${headerBg} backdrop-blur-xl z-20`}>
        <Link href="/mockups" className={`${backColor} transition-colors`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <div className={`w-9 h-9 rounded-full ${dark ? "bg-gradient-to-br from-violet-500 to-indigo-600" : "bg-[#F15A22]"} flex items-center justify-center flex-shrink-0`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.2 4.7 3 6.3V21l3.5-2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className={`text-[15px] font-semibold ${headerTitle} font-[family-name:var(--font-instrument)]`}>Porter</h1>
          <p className={`text-[11px] ${headerSub}`}>{isTyping ? "typing..." : "Ready to help"}</p>
        </div>
        <span className={`text-[9px] font-mono tracking-wider uppercase ${dirBadge} px-2 py-0.5 rounded-full border`}>Direction C</span>
        <button
          onClick={() => setDark(!dark)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            dark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-[#1A1A1A] text-white hover:bg-[#333]"
          }`}
        >
          {dark ? "☀ Light" : "● Dark"}
        </button>
      </header>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`} style={{ animation: "fadeIn 0.25s ease-out" }}>
            {msg.text && (
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                msg.role === "user" ? `${userBubble} rounded-br-md` : `${aiBubble} rounded-bl-md`
              }`}>
                {msg.text}
              </div>
            )}
          </div>
        ))}

        {/* Inline card */}
        {renderInlineCard()}

        {/* Published card */}
        {renderPublishedCard()}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className={`${aiBubble} rounded-2xl rounded-bl-md px-4 py-3`}>
              <div className="flex gap-1.5">
                <div className={`w-2 h-2 rounded-full ${typingDot} animate-bounce`} style={{ animationDelay: "0ms" }} />
                <div className={`w-2 h-2 rounded-full ${typingDot} animate-bounce`} style={{ animationDelay: "150ms" }} />
                <div className={`w-2 h-2 rounded-full ${typingDot} animate-bounce`} style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context actions */}
      {contextActions.length > 0 && (
        <div className={`px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-t ${actionBarBg}`} style={{ animation: "fadeIn 0.3s ease-out" }}>
          {contextActions.map((a) => (
            <button key={a.label} onClick={a.action} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[13px] font-medium active:scale-95 transition-all whitespace-nowrap ${actionPill}`}>
              <span>{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      )}

      {/* Slash palette */}
      {slashOpen && (
        <div className="px-4 pb-1">
          <div className={`rounded-xl border ${slashPaletteBorder} ${slashPaletteBg} backdrop-blur-xl overflow-hidden`}>
            {slashCommands.map((cmd) => (
              <button key={cmd.cmd} className={`w-full flex items-center gap-3 px-4 py-2.5 ${dark ? "hover:bg-white/5" : "hover:bg-[#F0EDE6]"} transition-colors text-left`} onClick={() => { setSlashOpen(false); setInputVal(""); if (cmd.action) cmd.action(); }}>
                <span className={`${slashCmd} text-[13px] font-mono`}>{cmd.cmd}</span>
                <span className={`${slashDesc} text-[13px]`}>{cmd.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt bar */}
      <div className={`border-t ${promptBorder} px-4 py-3 pb-safe`} style={{ background: promptBarBg }}>
        <div className="flex gap-2 items-center">
          <button className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors flex-shrink-0 ${attachBtn}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <input type="text" value={inputVal} onChange={(e) => { setInputVal(e.target.value); setSlashOpen(e.target.value === "/"); }} placeholder="Ask Porter anything..." className={`flex-1 pl-4 pr-4 py-3 rounded-2xl border text-[15px] focus:outline-none transition-colors ${inputBg}`} />
          <button className={`w-9 h-9 rounded-xl ${sendBtn} flex items-center justify-center active:scale-95 transition-all flex-shrink-0`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>

      {/* WALKTHROUGH SIDE PANEL */}
      {currentWt && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {(wtStep === 0 || isLastWt) && (
            <div className="pointer-events-auto" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: "430px", height: "100%" }}>
              <div className="absolute inset-0 bg-black/60" onClick={wtStep === 0 ? advanceWt : handleRestart} />
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
                <div className="flex gap-1">
                  {WALKTHROUGH.map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === wtStep ? "bg-amber-400" : i < wtStep ? "bg-amber-400/40" : "bg-white/10"}`} />
                  ))}
                </div>
                <span className="text-amber-400/60 text-xs font-mono ml-1">{wtStep + 1}/{WALKTHROUGH.length}</span>
              </div>
              <h3 className="text-amber-200 text-base font-semibold mb-2">{currentWt.title}</h3>
              <p className="text-amber-100/60 text-sm leading-relaxed mb-4">{currentWt.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-amber-400 text-sm font-medium">&#8594; {currentWt.action}</p>
                {wtStep === 0 && (
                  <button onClick={advanceWt} className="px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors">Start &#8594;</button>
                )}
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

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scanMove {
          0% { top: 0%; }
          50% { top: 90%; }
          100% { top: 0%; }
        }
        .scan-line {
          animation: scanMove 2s ease-in-out infinite;
        }
      `}</style>

      <DevSteps direction="Hybrid" steps={WALKTHROUGH} currentStep={wtStep} />
      <ReviewComments direction="hybrid" currentStep={wtStep} />
    </div>
  );
}
