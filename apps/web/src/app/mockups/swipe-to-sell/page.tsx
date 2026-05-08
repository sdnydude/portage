"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ReviewComments } from "@/components/review-comments";
import { DevSteps } from "@/components/dev-steps";

const MOCK_PHOTO = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1a3a1a"/>
        <stop offset="100%" stop-color="#0a1a0a"/>
      </linearGradient>
    </defs>
    <rect fill="url(#bg)" width="600" height="800"/>
    <text x="300" y="340" text-anchor="middle" fill="#4CAF50" font-size="120" font-family="serif">&#127928;</text>
    <text x="300" y="440" text-anchor="middle" fill="#ccc" font-size="28" font-family="sans-serif" font-weight="bold">Gibson Les Paul</text>
    <text x="300" y="480" text-anchor="middle" fill="#888" font-size="20" font-family="sans-serif">Standard '59 Reissue</text>
  </svg>`
);

const COMPS = [
  { price: 1180 }, { price: 1280 }, { price: 1380 }, { price: 1420 },
  { price: 1450 }, { price: 1450 }, { price: 1520 }, { price: 1550 },
  { price: 1650 }, { price: 1800 }, { price: 1890 },
];

const CONDITIONS = ["New", "Like New", "Very Good", "Good", "Acceptable"];
const MARKETPLACES = [
  { id: "ebay", label: "eBay", color: "#0064D2", icon: "🏷️" },
  { id: "reverb", label: "Reverb", color: "#F56B00", icon: "🎸" },
  { id: "etsy", label: "Etsy", color: "#F56400", icon: "🧡" },
];

const AI_DESCRIPTION = "Gibson Les Paul Standard '59 Reissue in excellent condition. Cherry sunburst finish with AAA flame maple top. PAF-style humbuckers, ABR-1 bridge, lightweight aluminum tailpiece. Brazilian rosewood fingerboard. Includes original hardshell case and COA.";
const CATEGORY_PATH = "Musical Instruments > Guitars > Electric Guitars > Solid Body";
const LISTING_TITLE = "Gibson Les Paul Standard '59 Reissue - Cherry Sunburst";

type Phase = "card" | "scanning" | "configure" | "details" | "shipping" | "publishing" | "success";

interface WalkthroughStep {
  title: string;
  description: string;
  action: string;
  position: "top" | "center" | "bottom";
}

const WALKTHROUGH: WalkthroughStep[] = [
  {
    title: "Welcome to Direction B",
    description: "This is 'Swipe to Sell' — card-based, gesture-driven. Your item is the hero. Configure with taps, publish in seconds. No forms.",
    action: "Tap anywhere to begin",
    position: "center",
  },
  {
    title: "Step 1: Item hero card",
    description: "Your item appears as a full-bleed card with photo, name, condition, and AI value estimate. The background blurs from the item photo.",
    action: "Tap 'Sell this item' button",
    position: "bottom",
  },
  {
    title: "Step 2: AI scanning",
    description: "Full-screen AI recognition with dramatic scan animation. The AI identifies the item, shows confidence level, condition, and value estimate. This is the hero moment.",
    action: "Wait for scan, then tap Confirm",
    position: "center",
  },
  {
    title: "Step 3: Configure listing",
    description: "Marketplace selection as visual pills. Condition pills. Category from AI with change option. Price slider with comp dots on the track.",
    action: "Select marketplace, condition, adjust price",
    position: "top",
  },
  {
    title: "Step 4: Listing details",
    description: "AI-generated title and description, fully editable. Three photo thumbnails. Each field has an AI badge showing it was auto-filled. Regenerate description with one tap.",
    action: "Review or edit fields, then tap Next",
    position: "center",
  },
  {
    title: "Step 5: Shipping",
    description: "Package size as pills (pre-selected for guitar). Weight, dimensions, and shipping method — all one-tap choices. AI pre-fills based on item category.",
    action: "Confirm shipping options, then tap Next",
    position: "top",
  },
  {
    title: "Step 6: Review & publish",
    description: "Summary card with photo, title, price, marketplace, shipping, and fee breakdown. Two choices: Publish or Save Draft. The card IS the confirmation.",
    action: "Tap Publish or Save Draft",
    position: "bottom",
  },
  {
    title: "Step 7: Publishing",
    description: "Quick animation while the listing goes live. Shows progress with marketplace branding.",
    action: "Watch the magic happen",
    position: "center",
  },
  {
    title: "Listed!",
    description: "Success with celebration. Full listing detail: status badge, listing number, price, view link, cross-list option. The entire flow was gesture-driven with zero manual text entry.",
    action: "Walkthrough complete — tap to restart or go back",
    position: "center",
  },
];

export default function SwipeToSellMockup() {
  const [dark, setDark] = useState(false);
  const [phase, setPhase] = useState<Phase>("card");
  const [selectedMarketplace, setSelectedMarketplace] = useState("ebay");
  const [selectedCondition, setSelectedCondition] = useState("Like New");
  const [price, setPrice] = useState(1450);
  const [wtStep, setWtStep] = useState(0);

  // Scanning phase state
  const [scanPhase, setScanPhase] = useState<"scanning" | "recognized">("scanning");

  // Details phase state
  const [listingTitle, setListingTitle] = useState(LISTING_TITLE);
  const [listingDescription, setListingDescription] = useState(AI_DESCRIPTION);

  // Shipping phase state
  const [packageSize, setPackageSize] = useState("Large");
  const [shippingWeight, setShippingWeight] = useState("~12 lbs");
  const [shippingMethod, setShippingMethod] = useState("Free");

  // Publishing sub-phase: "summary" shows the review card, "animating" shows the spinner
  const [publishSubPhase, setPublishSubPhase] = useState<"summary" | "animating">("summary");

  // Pre-compute confetti particle data to avoid Math.random in render
  const confettiParticles = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      size: 4 + (((i * 7 + 3) % 11) / 11) * 6,
      color: ["#4CAF50", "#FFC107", "#2196F3", "#FF5722", "#9C27B0", "#F15A22", "#0047AB"][i % 7],
      top: 15 + (((i * 13 + 5) % 17) / 17) * 45,
      left: 5 + (((i * 11 + 7) % 19) / 19) * 90,
      duration: 1.2 + (((i * 3 + 1) % 9) / 9) * 0.8,
      delay: ((i * 5 + 2) % 11) / 11 * 0.5,
    })),
  []);

  const minPrice = 800;
  const maxPrice = 2200;
  const pricePercent = ((price - minPrice) / (maxPrice - minPrice)) * 100;

  const ebayFee = Math.round(price * 0.1305);
  const youKeep = price - ebayFee;

  const bg = dark ? "bg-[#0A0A0A]" : "bg-[#F8F7F4]";
  const overlayBg = dark ? "bg-black/60" : "bg-white/70";
  const labelColor = dark ? "text-white/30" : "text-[#6B6B6B]";
  const priceColor = dark ? "text-white" : "text-[#1A1A1A]";
  const mutedText = dark ? "text-white/40" : "text-[#8A8A8A]";
  const cardBorder = dark ? "border-white/10" : "border-[#E8E5DE]";
  const cardBg = dark ? "bg-white/5 backdrop-blur-md" : "bg-white backdrop-blur-md shadow-lg";
  const pillActive = "bg-[#F15A22] text-white";
  const pillInactive = dark
    ? "bg-white/5 text-white/40 border border-white/10"
    : "bg-[#F0EDE6] text-[#6B6B6B] border border-[#E8E5DE]";
  const mpActive = dark ? "bg-white text-black" : "bg-[#F15A22] text-white";
  const mpInactive = dark
    ? "bg-white/5 text-white/50 border border-white/10 hover:border-white/20"
    : "bg-white text-[#6B6B6B] border border-[#E8E5DE] hover:border-[#0047AB]/30";
  const trackBg = dark ? "bg-white/10" : "bg-[#E8E5DE]";
  const thumbBorder = dark ? "border-[#F15A22]" : "border-[#0047AB]";
  const backBtnBg = dark ? "bg-white/10 backdrop-blur-sm" : "bg-white/80 backdrop-blur-sm shadow-sm border border-[#E8E5DE]";
  const backStroke = dark ? "white" : "#1A1A1A";
  const dirBadge = dark
    ? "text-white/30 border-white/10"
    : "text-[#8A8A8A] border-[#E8E5DE] bg-white/60";
  const successBtnA = dark ? "bg-white/10 text-white" : "bg-[#F0EDE6] text-[#1A1A1A] border border-[#E8E5DE]";
  const successBtnB = dark ? "bg-[#F15A22] text-white" : "bg-[#F15A22] text-white";
  const blurOpacity = dark ? "opacity-30" : "opacity-15";
  const inputBg = dark ? "bg-white/5 border-white/10 text-white" : "bg-[#FAFAF8] border-[#E8E5DE] text-[#1A1A1A]";
  const aiBadge = dark ? "bg-[#0047AB]/30 text-[#5B9BD5]" : "bg-[#0047AB]/10 text-[#0047AB]";

  function advanceWt() {
    if (wtStep === 0) setWtStep(1);
  }

  function handleSellClick() {
    setPhase("scanning");
    setScanPhase("scanning");
    setWtStep(2);
  }

  // Auto-advance scanning phase
  useEffect(() => {
    if (phase === "scanning" && scanPhase === "scanning") {
      const timer = setTimeout(() => setScanPhase("recognized"), 2200);
      return () => clearTimeout(timer);
    }
  }, [phase, scanPhase]);

  function handleScanConfirm() {
    setPhase("configure");
    setWtStep(3);
  }

  function handleMarketplaceClick(mp: string) {
    setSelectedMarketplace(mp);
  }

  function handleConditionClick(c: string) {
    setSelectedCondition(c);
  }

  function handleConfigureNext() {
    setPhase("details");
    setWtStep(4);
  }

  function handleDetailsNext() {
    setPhase("shipping");
    setWtStep(5);
  }

  function handleShippingNext() {
    setPhase("publishing");
    setPublishSubPhase("summary");
    setWtStep(6);
  }

  function handlePublishConfirm() {
    setPublishSubPhase("animating");
    setWtStep(7);
    setTimeout(() => {
      setPhase("success");
      setWtStep(8);
    }, 1800);
  }

  function handleRestart() {
    setPhase("card");
    setPrice(1450);
    setSelectedMarketplace("ebay");
    setSelectedCondition("Like New");
    setListingTitle(LISTING_TITLE);
    setListingDescription(AI_DESCRIPTION);
    setPackageSize("Large");
    setShippingWeight("~12 lbs");
    setShippingMethod("Free");
    setScanPhase("scanning");
    setPublishSubPhase("summary");
    setWtStep(0);
  }

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPrice(Number(e.target.value));
  }

  function handleRegenerateDescription() {
    setListingDescription("Gibson Les Paul Standard '59 Reissue — Cherry Sunburst finish, exceptional condition. Features AAA flame maple cap, '59-spec rounded neck profile, Burstbucker pickups, premium hardware. Includes OHSC and Certificate of Authenticity. A serious player's guitar.");
  }

  const currentWt = WALKTHROUGH[wtStep];
  const isLastWt = wtStep >= WALKTHROUGH.length - 1;

  return (
    <div className={`fixed inset-0 ${bg} flex flex-col overflow-hidden transition-colors duration-300`} style={{ maxWidth: "430px", margin: "0 auto" }}>
      {/* Blurred bg */}
      <div className={`absolute inset-0 ${blurOpacity} blur-3xl scale-110`} style={{ backgroundImage: `url(${MOCK_PHOTO})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className={`absolute inset-0 ${overlayBg}`} />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3">
        <Link href="/mockups" className={`w-9 h-9 rounded-full ${backBtnBg} flex items-center justify-center`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={backStroke} strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <span className={`text-[9px] font-mono tracking-wider uppercase ${dirBadge} px-2 py-0.5 rounded-full border`}>Direction B</span>
        <button
          onClick={() => setDark(!dark)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            dark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-[#1A1A1A] text-white hover:bg-[#333]"
          }`}
        >
          {dark ? "☀ Light" : "● Dark"}
        </button>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col px-5 pb-4 overflow-y-auto scrollbar-hide">

        {/* ═══════ PHASE: CARD ═══════ */}
        {phase === "card" && (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ animation: "cardIn 0.6s ease-out" }}>
            <div className={`w-full rounded-3xl overflow-hidden border ${cardBorder} ${cardBg}`} style={{ boxShadow: dark ? "0 30px 60px -15px rgba(0,0,0,0.5)" : "0 30px 60px -15px rgba(0,0,0,0.12)" }}>
              <div className="relative aspect-[4/5] overflow-hidden">
                <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-5">
                  <h2 className="text-2xl font-bold text-white font-[family-name:var(--font-instrument)] leading-tight">
                    Gibson Les Paul<br />Standard &apos;59
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 backdrop-blur-sm text-emerald-300 text-xs font-medium border border-emerald-500/20">Like New</span>
                    <span className="text-white/50 text-xs">AI scanned · 3 photos</span>
                  </div>
                  <p className="text-white/60 text-[15px] mt-2">$1,200 – $1,800 estimated</p>
                </div>
              </div>
            </div>
            <button onClick={handleSellClick} className={`mt-8 px-8 py-4 rounded-2xl font-semibold text-[15px] active:scale-95 transition-transform ${
              dark ? "bg-white text-black" : "bg-[#F15A22] text-white"
            }`} style={{ boxShadow: dark ? "0 0 40px rgba(255,255,255,0.15)" : "0 0 40px rgba(241,90,34,0.2)" }}>
              Sell this item →
            </button>
          </div>
        )}

        {/* ═══════ PHASE: SCANNING ═══════ */}
        {phase === "scanning" && (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ animation: "cardIn 0.4s ease-out" }}>
            <div className="relative w-full rounded-3xl overflow-hidden" style={{ aspectRatio: "3/4" }}>
              <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover rounded-3xl" />

              {/* Scan overlay */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden">
                {/* Pulsing radial rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute w-40 h-40 rounded-full border-2 border-[#0047AB]/40" style={{ animation: "scanPulse 2s ease-out infinite" }} />
                  <div className="absolute w-56 h-56 rounded-full border border-[#0047AB]/25" style={{ animation: "scanPulse 2s ease-out infinite 0.4s" }} />
                  <div className="absolute w-72 h-72 rounded-full border border-[#0047AB]/15" style={{ animation: "scanPulse 2s ease-out infinite 0.8s" }} />
                </div>

                {/* Horizontal scan line */}
                {scanPhase === "scanning" && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#0047AB] to-transparent" style={{ animation: "scanLine 1.5s ease-in-out infinite", boxShadow: "0 0 20px 4px rgba(0,71,171,0.3)" }} />
                )}

                {/* Dark overlay that lifts on recognition */}
                <div className={`absolute inset-0 transition-all duration-700 ${scanPhase === "recognized" ? "bg-black/70" : "bg-black/40"}`} />

                {/* Corner brackets */}
                <div className="absolute top-6 left-6 w-10 h-10 border-l-2 border-t-2 border-[#0047AB]/60 rounded-tl-lg" style={{ animation: "cornerPulse 1.5s ease-in-out infinite" }} />
                <div className="absolute top-6 right-6 w-10 h-10 border-r-2 border-t-2 border-[#0047AB]/60 rounded-tr-lg" style={{ animation: "cornerPulse 1.5s ease-in-out infinite 0.2s" }} />
                <div className="absolute bottom-6 left-6 w-10 h-10 border-l-2 border-b-2 border-[#0047AB]/60 rounded-bl-lg" style={{ animation: "cornerPulse 1.5s ease-in-out infinite 0.4s" }} />
                <div className="absolute bottom-6 right-6 w-10 h-10 border-r-2 border-b-2 border-[#0047AB]/60 rounded-br-lg" style={{ animation: "cornerPulse 1.5s ease-in-out infinite 0.6s" }} />
              </div>

              {/* Status text overlay */}
              <div className="absolute inset-x-0 bottom-0 p-6">
                {scanPhase === "scanning" && (
                  <div className="text-center" style={{ animation: "fadeIn 0.4s ease-out" }}>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-md border border-[#0047AB]/30">
                      <div className="w-2 h-2 rounded-full bg-[#0047AB]" style={{ animation: "blink 1s ease-in-out infinite" }} />
                      <span className="text-white text-sm font-medium font-mono">Identifying item...</span>
                    </div>
                  </div>
                )}
                {scanPhase === "recognized" && (
                  <div className="space-y-3" style={{ animation: "slideUpFade 0.6s ease-out" }}>
                    <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${aiBadge}`}>AI Match</span>
                        <span className="text-emerald-400 text-xs font-mono font-bold">98% confidence</span>
                      </div>
                      <h3 className="text-white text-xl font-bold font-[family-name:var(--font-instrument)] leading-snug">
                        Gibson Les Paul Standard<br />&apos;59 Reissue
                      </h3>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/20">Like New</span>
                        <span className="text-white/50 text-xs">Est. $1,200 – $1,800</span>
                      </div>
                      <p className="text-white/40 text-xs mt-2 font-mono">Cherry Sunburst · 2019 · Solid Body Electric</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Confirm button */}
            {scanPhase === "recognized" && (
              <button
                onClick={handleScanConfirm}
                className="mt-6 w-full py-4 rounded-2xl bg-[#F15A22] text-white font-semibold text-[15px] active:scale-[0.98] transition-transform"
                style={{ animation: "slideUpFade 0.5s ease-out 0.2s both", boxShadow: "0 0 40px rgba(241,90,34,0.25)" }}
              >
                Confirm →
              </button>
            )}
          </div>
        )}

        {/* ═══════ PHASE: CONFIGURE ═══════ */}
        {phase === "configure" && (
          <div className="flex-1 flex flex-col" style={{ animation: "slideUp 0.4s ease-out" }}>
            <div className="flex items-center gap-3 mb-5 mt-2">
              <div className={`w-14 h-14 rounded-xl overflow-hidden border ${cardBorder} flex-shrink-0`}>
                <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className={`${priceColor} font-semibold text-[15px]`}>Gibson Les Paul Std &apos;59</h3>
                <p className={`${mutedText} text-xs`}>3 photos · AI-described</p>
              </div>
            </div>

            {/* Category */}
            <div className="mb-5">
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-1.5`}>Category</p>
              <div className="flex items-center gap-2">
                <p className={`${priceColor} text-sm`}>Electric Guitars &gt; Solid Body</p>
                <button className="text-[#0047AB] text-xs font-medium hover:underline">Change</button>
              </div>
            </div>

            {/* Marketplace */}
            <div className="mb-5">
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-2`}>Marketplace</p>
              <div className="flex gap-2">
                {MARKETPLACES.map((mp) => (
                  <button
                    key={mp.id}
                    onClick={() => handleMarketplaceClick(mp.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[15px] font-medium transition-all ${
                      selectedMarketplace === mp.id ? `${mpActive} scale-[1.03]` : mpInactive
                    }`}
                    style={selectedMarketplace === mp.id ? { boxShadow: dark ? `0 0 30px ${mp.color}40` : `0 0 20px ${mp.color}20` } : undefined}
                  >
                    <span>{mp.icon}</span>{mp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Condition */}
            <div className="mb-5">
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-2`}>Condition</p>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleConditionClick(c)}
                    className={`px-3.5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                      selectedCondition === c ? pillActive : pillInactive
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Price slider */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Price</p>
                <span className={`${priceColor} font-bold text-xl font-[family-name:var(--font-instrument)]`}>${price.toLocaleString()}</span>
              </div>
              <div className="relative h-12 flex items-center">
                <div className={`absolute inset-x-0 h-1.5 rounded-full ${trackBg}`}>
                  <div className={`h-full rounded-full ${dark ? "bg-gradient-to-r from-[#F15A22] to-[#FF8C5A]" : "bg-gradient-to-r from-[#0047AB] to-[#5B9BD5]"}`} style={{ width: `${pricePercent}%` }} />
                </div>
                {COMPS.map((comp, ci) => {
                  const pct = ((comp.price - minPrice) / (maxPrice - minPrice)) * 100;
                  return <div key={ci} className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/60 -translate-x-1/2 top-[calc(50%-3px)]" style={{ left: `${pct}%` }} title={`$${comp.price}`} />;
                })}
                <input type="range" min={minPrice} max={maxPrice} step={10} value={price} onChange={handleSliderChange} className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={`absolute w-7 h-7 rounded-full bg-white border-2 ${thumbBorder} -translate-x-1/2 pointer-events-none`} style={{ left: `${pricePercent}%`, boxShadow: dark ? "0 0 20px rgba(241,90,34,0.4), 0 2px 8px rgba(0,0,0,0.3)" : "0 0 20px rgba(0,71,171,0.25), 0 2px 8px rgba(0,0,0,0.1)" }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className={`${mutedText} text-[11px]`}>${minPrice}</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                  <span className="text-amber-500/70 text-[11px]">{COMPS.length} comps</span>
                </div>
                <span className={`${mutedText} text-[11px]`}>${maxPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Next */}
            <div className="mt-auto">
              <button
                onClick={handleConfigureNext}
                className="w-full py-4 rounded-2xl bg-[#F15A22] text-white font-semibold text-[15px] active:scale-[0.98] transition-transform"
                style={{ boxShadow: "0 0 30px rgba(241,90,34,0.2)" }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ═══════ PHASE: DETAILS ═══════ */}
        {phase === "details" && (
          <div className="flex-1 flex flex-col" style={{ animation: "slideUp 0.4s ease-out" }}>
            {/* Photo thumbnails */}
            <div className="flex gap-2 mb-5 mt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`w-20 h-20 rounded-xl overflow-hidden border ${cardBorder} ${i === 0 ? "ring-2 ring-[#F15A22]" : ""}`}>
                  <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" style={i === 1 ? { transform: "scaleX(-1)" } : i === 2 ? { objectPosition: "center 30%" } : undefined} />
                </div>
              ))}
              <button className={`w-20 h-20 rounded-xl border-2 border-dashed ${dark ? "border-white/15 text-white/30" : "border-[#E8E5DE] text-[#8A8A8A]"} flex items-center justify-center`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>

            {/* Title field */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Title</p>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${aiBadge}`}>AI</span>
              </div>
              <input
                type="text"
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
                className={`w-full px-4 py-3.5 rounded-xl border text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#0047AB]/30 transition-all ${inputBg}`}
              />
            </div>

            {/* Description field */}
            <div className="mb-4 flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest`}>Description</p>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${aiBadge}`}>AI</span>
                </div>
                <button
                  onClick={handleRegenerateDescription}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    dark ? "bg-white/5 text-white/50 hover:bg-white/10" : "bg-[#F0EDE6] text-[#6B6B6B] hover:bg-[#E8E5DE]"
                  }`}
                >
                  <span>✨</span> Regenerate
                </button>
              </div>
              <textarea
                value={listingDescription}
                onChange={(e) => setListingDescription(e.target.value)}
                rows={5}
                className={`w-full px-4 py-3.5 rounded-xl border text-[14px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0047AB]/30 transition-all resize-none ${inputBg}`}
              />
            </div>

            {/* Category (read-only) */}
            <div className="mb-5">
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-1`}>Category</p>
              <p className={`${mutedText} text-sm`}>{CATEGORY_PATH}</p>
            </div>

            {/* Next */}
            <div className="mt-auto pt-2">
              <button
                onClick={handleDetailsNext}
                className="w-full py-4 rounded-2xl bg-[#F15A22] text-white font-semibold text-[15px] active:scale-[0.98] transition-transform"
                style={{ boxShadow: "0 0 30px rgba(241,90,34,0.2)" }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ═══════ PHASE: SHIPPING ═══════ */}
        {phase === "shipping" && (
          <div className="flex-1 flex flex-col" style={{ animation: "slideUp 0.4s ease-out" }}>
            <div className="flex items-center gap-3 mb-6 mt-2">
              <div className={`w-10 h-10 rounded-full ${dark ? "bg-white/5" : "bg-[#F0EDE6]"} flex items-center justify-center`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "white" : "#1A1A1A"} strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" /></svg>
              </div>
              <div>
                <h3 className={`${priceColor} font-semibold text-lg font-[family-name:var(--font-instrument)]`}>Shipping</h3>
                <p className={`${mutedText} text-xs`}>Pre-filled for Electric Guitar</p>
              </div>
            </div>

            {/* Package Size */}
            <div className="mb-6">
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-2`}>Package Size</p>
              <div className="flex gap-2">
                {["Small", "Medium", "Large"].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPackageSize(size)}
                    className={`flex-1 py-3.5 rounded-xl text-[15px] font-medium transition-all ${
                      packageSize === size ? pillActive : pillInactive
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Weight + Dimensions */}
            <div className="flex gap-3 mb-6">
              <div className="flex-1">
                <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-1.5`}>Weight</p>
                <div className={`px-4 py-3 rounded-xl border ${inputBg} flex items-center justify-between`}>
                  <input
                    type="text"
                    value={shippingWeight}
                    onChange={(e) => setShippingWeight(e.target.value)}
                    className="bg-transparent text-[15px] font-medium w-full focus:outline-none"
                  />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={mutedText}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </div>
              </div>
              <div className="flex-1">
                <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-1.5`}>Dimensions</p>
                <div className={`px-4 py-3 rounded-xl border ${inputBg}`}>
                  <p className={`text-[15px] font-medium ${priceColor}`}>48 × 18 × 7&quot;</p>
                </div>
              </div>
            </div>

            {/* Shipping Method */}
            <div className="mb-6">
              <p className={`${labelColor} text-[11px] font-mono uppercase tracking-widest mb-2`}>Shipping Method</p>
              <div className="flex gap-2">
                {[
                  { id: "Free", label: "Free", sub: "You absorb" },
                  { id: "Calculated", label: "Calculated", sub: "Buyer pays" },
                  { id: "Flat", label: "Flat $15", sub: "Fixed rate" },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setShippingMethod(method.id)}
                    className={`flex-1 flex flex-col items-center py-3 rounded-xl text-[14px] font-medium transition-all ${
                      shippingMethod === method.id ? pillActive : pillInactive
                    }`}
                  >
                    <span>{method.label}</span>
                    <span className={`text-[10px] mt-0.5 ${shippingMethod === method.id ? "text-white/60" : mutedText}`}>{method.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated cost note */}
            <div className={`rounded-xl p-3 ${dark ? "bg-white/5 border border-white/10" : "bg-[#F0EDE6] border border-[#E8E5DE]"} mb-4`}>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#5B9BD5" : "#0047AB"} strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                <p className={`text-xs ${mutedText}`}>
                  {shippingMethod === "Free" ? "Free shipping typically increases sell-through rate by 20%" : shippingMethod === "Calculated" ? "Shipping cost calculated at checkout based on buyer location" : "Flat rate shipping — simple for buyer and seller"}
                </p>
              </div>
            </div>

            {/* Next */}
            <div className="mt-auto">
              <button
                onClick={handleShippingNext}
                className="w-full py-4 rounded-2xl bg-[#F15A22] text-white font-semibold text-[15px] active:scale-[0.98] transition-transform"
                style={{ boxShadow: "0 0 30px rgba(241,90,34,0.2)" }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ═══════ PHASE: PUBLISHING ═══════ */}
        {phase === "publishing" && publishSubPhase === "summary" && (
          <div className="flex-1 flex flex-col" style={{ animation: "slideUp 0.4s ease-out" }}>
            <h3 className={`${priceColor} text-xl font-bold font-[family-name:var(--font-instrument)] mb-5 mt-2`}>Review Listing</h3>

            {/* Summary card */}
            <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden mb-5`}>
              {/* Photo + title row */}
              <div className="flex gap-4 p-4">
                <div className={`w-20 h-20 rounded-xl overflow-hidden border ${cardBorder} flex-shrink-0`}>
                  <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`${priceColor} font-semibold text-[15px] leading-snug line-clamp-2`}>{listingTitle}</h4>
                  <p className={`${mutedText} text-xs mt-1`}>{selectedCondition} · {MARKETPLACES.find(m => m.id === selectedMarketplace)?.label}</p>
                </div>
              </div>

              {/* Details grid */}
              <div className={`border-t ${cardBorder} px-4 py-3 grid grid-cols-2 gap-y-2.5`}>
                <div>
                  <p className={`${labelColor} text-[10px] font-mono uppercase tracking-widest`}>Price</p>
                  <p className={`${priceColor} text-lg font-bold font-[family-name:var(--font-instrument)]`}>${price.toLocaleString()}</p>
                </div>
                <div>
                  <p className={`${labelColor} text-[10px] font-mono uppercase tracking-widest`}>Shipping</p>
                  <p className={`${priceColor} text-sm font-medium`}>{shippingMethod === "Free" ? "Free shipping" : shippingMethod === "Calculated" ? "Calculated" : "Flat $15"}</p>
                </div>
                <div>
                  <p className={`${labelColor} text-[10px] font-mono uppercase tracking-widest`}>Package</p>
                  <p className={`${priceColor} text-sm font-medium`}>{packageSize} · {shippingWeight}</p>
                </div>
                <div>
                  <p className={`${labelColor} text-[10px] font-mono uppercase tracking-widest`}>Category</p>
                  <p className={`${priceColor} text-sm font-medium`}>Solid Body</p>
                </div>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className={`rounded-2xl border ${cardBorder} ${dark ? "bg-white/5" : "bg-[#FAFAF8]"} p-4 mb-5`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`${mutedText} text-sm`}>eBay fees (~13%)</span>
                <span className={`${mutedText} text-sm font-mono`}>-${ebayFee.toLocaleString()}</span>
              </div>
              <div className={`flex justify-between items-center pt-2 border-t ${cardBorder}`}>
                <span className={`${priceColor} text-sm font-semibold`}>You keep</span>
                <span className={`text-lg font-bold font-[family-name:var(--font-instrument)] ${dark ? "text-emerald-400" : "text-emerald-600"}`}>~${youKeep.toLocaleString()}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-auto flex flex-col gap-2">
              <button
                onClick={handlePublishConfirm}
                className="w-full py-4 rounded-2xl bg-[#F15A22] text-white font-semibold text-[15px] active:scale-[0.98] transition-transform"
                style={{ boxShadow: "0 0 30px rgba(241,90,34,0.25)" }}
              >
                Publish →
              </button>
              <button
                onClick={handleRestart}
                className={`w-full py-3 rounded-2xl text-[15px] font-medium transition-all ${
                  dark ? "text-white/40 hover:bg-white/5" : "text-[#8A8A8A] hover:bg-[#F0EDE6]"
                }`}
              >
                Save Draft
              </button>
            </div>
          </div>
        )}

        {phase === "publishing" && publishSubPhase === "animating" && (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div className="relative">
              <div className={`w-20 h-20 rounded-full border-4 ${dark ? "border-[#F15A22]" : "border-[#F15A22]"} border-t-transparent`} style={{ animation: "spin 0.8s linear infinite" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">{MARKETPLACES.find(m => m.id === selectedMarketplace)?.icon}</span>
              </div>
            </div>
            <p className={`${priceColor} font-semibold text-lg mt-6 font-[family-name:var(--font-instrument)]`}>Publishing to {MARKETPLACES.find(m => m.id === selectedMarketplace)?.label}...</p>
            <p className={`${mutedText} text-[15px] mt-1`}>Creating listing at ${price.toLocaleString()}</p>
            <div className="flex gap-1 mt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#F15A22]" style={{ animation: `dotPulse 1.2s ease-in-out infinite ${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* ═══════ PHASE: SUCCESS ═══════ */}
        {phase === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ animation: "scaleIn 0.5s ease-out" }}>
            {/* Confetti */}
            {confettiParticles.map((p, i) => (
              <div key={i} className="absolute rounded-full" style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: p.color,
                top: `${p.top}%`, left: `${p.left}%`,
                animation: `confetti ${p.duration}s ease-out forwards`, animationDelay: `${p.delay}s`,
              }} />
            ))}

            {/* Success icon */}
            <div className={`w-20 h-20 rounded-full ${dark ? "bg-emerald-500/20" : "bg-emerald-500/10"} flex items-center justify-center mb-4`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={dark ? "#4ADE80" : "#16A34A"} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>

            <h2 className={`${priceColor} text-2xl font-bold font-[family-name:var(--font-instrument)]`}>Listed!</h2>
            <p className={`${mutedText} text-[15px] mt-1`}>Your listing is now active</p>

            {/* Listing detail card */}
            <div className={`w-full rounded-2xl border ${cardBorder} ${cardBg} mt-6 overflow-hidden`} style={{ animation: "slideUpFade 0.5s ease-out 0.3s both" }}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-semibold border border-emerald-500/20">Active</span>
                  <span className={`${mutedText} text-xs font-mono`}>eBay #294837261054</span>
                </div>
                <div className="flex gap-3">
                  <div className={`w-14 h-14 rounded-xl overflow-hidden border ${cardBorder} flex-shrink-0`}>
                    <img src={MOCK_PHOTO} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`${priceColor} font-semibold text-[14px] leading-snug line-clamp-2`}>{listingTitle}</h4>
                    <p className={`text-lg font-bold font-[family-name:var(--font-instrument)] mt-1 ${dark ? "text-emerald-400" : "text-emerald-600"}`}>${price.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="w-full flex flex-col gap-2 mt-5" style={{ animation: "slideUpFade 0.5s ease-out 0.5s both" }}>
              <button className={`w-full py-3.5 rounded-xl ${successBtnB} text-[15px] font-medium flex items-center justify-center gap-2`}>
                <span>View on eBay</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
              </button>
              <button className={`w-full py-3.5 rounded-xl ${successBtnA} text-[15px] font-medium`}>
                🎸 List on Reverb too
              </button>
              <div className="flex gap-2">
                <button className={`flex-1 py-3 rounded-xl ${successBtnA} text-[14px] font-medium`}>
                  Edit listing
                </button>
                <button onClick={handleRestart} className={`flex-1 py-3 rounded-xl ${successBtnA} text-[14px] font-medium`}>
                  List another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ WALKTHROUGH — SIDE PANEL ═══════ */}
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
                <p className="text-amber-400 text-sm font-medium">→ {currentWt.action}</p>
                {wtStep === 0 && (
                  <button onClick={advanceWt} className="px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors">Start →</button>
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
        @keyframes cardIn { from { opacity: 0; transform: scale(0.92) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes bobUp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes confetti { 0% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); } 100% { opacity: 0; transform: translateY(-80px) scale(0) rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes scanPulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes scanLine {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
        @keyframes cornerPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* Camera FAB */}
      <a href="/mockups/camera" className="fixed z-[58] bottom-24 left-6 w-12 h-12 rounded-full bg-[#F15A22] text-white shadow-lg flex items-center justify-center hover:bg-[#d94e1c] active:scale-95 transition-all" style={{ boxShadow: "0 4px 20px rgba(241,90,34,0.4)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
      </a>

      <DevSteps direction="Swipe to Sell" steps={WALKTHROUGH} currentStep={wtStep} />
      <ReviewComments direction="swipe-to-sell" currentStep={wtStep} />
    </div>
  );
}
