"use client";

import { useState, useEffect } from "react";

const DISCLAIMER_CLAUSES = [
  {
    title: "Accuracy of Information",
    text: "I confirm that all item descriptions, conditions, and photos accurately represent the item being listed. I have reviewed any AI-generated content and verified its accuracy.",
  },
  {
    title: "AI-Generated Content",
    text: "I understand that Portage uses artificial intelligence to generate item descriptions, condition assessments, and pricing recommendations. I have reviewed and approved all AI-generated content before publishing.",
  },
  {
    title: "Item Ownership",
    text: "I confirm that I am the rightful owner of the item being listed and have the legal right to sell it.",
  },
  {
    title: "Marketplace Compliance",
    text: "I agree to comply with all applicable marketplace policies, terms of service, and community guidelines for the selected platform (eBay, Reverb, or others).",
  },
  {
    title: "Prohibited Items",
    text: "I confirm that the item being listed is not prohibited, restricted, or counterfeit under applicable marketplace policies or federal, state, or local law.",
  },
  {
    title: "Pricing and Fees",
    text: "I understand that marketplace fees, shipping costs, and payment processing fees will be deducted from the sale price. The estimated profit shown is an approximation.",
  },
  {
    title: "Shipping Responsibility",
    text: "I agree to ship sold items within the timeframe specified in the listing and to provide accurate tracking information.",
  },
  {
    title: "Returns and Disputes",
    text: "I acknowledge that buyers may request returns or file disputes according to marketplace policies, and I agree to handle them in good faith.",
  },
  {
    title: "Tax Obligations",
    text: "I understand that I am solely responsible for any tax obligations arising from sales made through Portage, including income tax and sales tax where applicable.",
  },
  {
    title: "Data Accuracy",
    text: "I understand that while Portage strives for accuracy in pricing recommendations and market data, these are estimates and do not constitute financial advice or guarantees.",
  },
  {
    title: "Account Security",
    text: "I am responsible for maintaining the security of my marketplace account credentials stored in Portage. I will notify Portage immediately if I suspect unauthorized access.",
  },
  {
    title: "Limitation of Liability",
    text: "I understand that Portage is a listing management tool and is not liable for marketplace disputes, shipping damage, buyer fraud, or any losses arising from the sale of items.",
  },
];

interface DisclaimerSheetProps {
  itemId: string;
  isFirstTime: boolean;
  /** suppress7d = the seller ticked "don't show again for 7 days" (display only). */
  onAccept: (suppress7d: boolean) => void;
  onCancel: () => void;
  /** Publish in flight — disables Accept so a second tap cannot re-submit
   *  (UX layer; the parent's synchronous in-flight ref is the real guard). */
  busy?: boolean;
}

export function DisclaimerSheet({ itemId, isFirstTime, onAccept, onCancel, busy = false }: DisclaimerSheetProps) {
  const [isExpanded, setIsExpanded] = useState(isFirstTime);
  const [isChecked, setIsChecked] = useState(false);
  // F3b: opt-in to skip this sheet for 7 days. Unchecked by default.
  const [suppress7d, setSuppress7d] = useState(false);

  // Reset checkboxes when sheet opens
  useEffect(() => {
    setIsChecked(false);
    setSuppress7d(false);
    setIsExpanded(isFirstTime);
  }, [itemId, isFirstTime]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
      <div className="flex items-start gap-3 mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-primary">Listing Terms & Conditions</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Please review and accept before publishing
          </p>
        </div>
      </div>

      {/* Collapsed summary */}
      {!isExpanded && (
        <div className="mb-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            By publishing, you confirm item accuracy, ownership, marketplace compliance, and accept responsibility for shipping, taxes, and disputes.
          </p>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-forest-green font-medium mt-1"
          >
            Review full terms
          </button>
        </div>
      )}

      {/* Expanded full text */}
      {isExpanded && (
        <div className="mb-3 max-h-64 overflow-y-auto space-y-3 pr-1">
          {DISCLAIMER_CLAUSES.map((clause, index) => (
            <div key={clause.title}>
              <h4 className="text-xs font-semibold text-text-primary mb-0.5">
                {index + 1}. {clause.title}
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                {clause.text}
              </p>
            </div>
          ))}

          {!isFirstTime && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-forest-green font-medium"
            >
              Collapse
            </button>
          )}
        </div>
      )}

      {/* Checkbox */}
      <label className="flex items-start gap-2.5 cursor-pointer py-2">
        <button
          role="checkbox"
          aria-checked={isChecked}
          onClick={() => setIsChecked(!isChecked)}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
            isChecked
              ? "bg-forest-green border-forest-green"
              : "border-border hover:border-forest-green"
          }`}
        >
          {isChecked && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className="text-xs text-text-primary leading-relaxed">
          I have read and agree to the listing terms and conditions above. I confirm that all information is accurate and I accept full responsibility.
        </span>
      </label>

      {/* F3b: opt-in to skip this sheet for 7 days (display only — consent is still recorded). */}
      <label className="flex items-center gap-2 mt-3 cursor-pointer">
        <input
          type="checkbox"
          aria-label="Don't show again for 7 days"
          checked={suppress7d}
          onChange={(e) => setSuppress7d(e.target.checked)}
          className="h-4 w-4 accent-[var(--forest-green,#2D5A27)]"
        />
        <span className="text-xs text-text-secondary">Don&apos;t show these terms again for 7 days</span>
      </label>

      {/* Action buttons */}
      <div className="flex gap-3 mt-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
        >
          Cancel
        </button>
        <button
          onClick={() => onAccept(suppress7d)}
          disabled={!isChecked || busy}
          className="flex-1 py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Accept & Publish"}
        </button>
      </div>
    </div>
  );
}
