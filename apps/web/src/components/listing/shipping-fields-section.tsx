"use client";

/**
 * eBay per-listing shipping fields (beta 17be7322): method select, flat buyer
 * cost, service select, handling days. Extracted from CreateListingSheet so
 * scan-review can ride along with the same controls. Controlled + dumb — the
 * owner tracks touched state via onChange.
 *
 * Service enums come from the live GeteBayDetails probe (2026-08-01, PR #274),
 * never memory.
 */
export interface ShippingFieldsValue {
  method: "calculated" | "flat" | "free";
  flatCost: string;
  service: string;
  handlingDays: string;
}

export const SHIPPING_FIELDS_DEFAULT: ShippingFieldsValue = {
  method: "calculated",
  flatCost: "",
  service: "",
  handlingDays: "",
};

interface ShippingFieldsSectionProps {
  value: ShippingFieldsValue;
  onChange: (value: ShippingFieldsValue) => void;
  /** Distinguish element ids when two sections coexist (scan-review + sheet). */
  idPrefix?: string;
}

export function ShippingFieldsSection({ value, onChange, idPrefix = "" }: ShippingFieldsSectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}shipping-method`} className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
          Shipping method
        </label>
        <select
          id={`${idPrefix}shipping-method`}
          value={value.method}
          onChange={(e) => onChange({ ...value, method: e.target.value as ShippingFieldsValue["method"] })}
          className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
        >
          <option value="calculated">Calculated (buyer pays actual)</option>
          <option value="flat">Flat rate</option>
          <option value="free">Free shipping</option>
        </select>
      </div>
      {value.method === "flat" && (
        <div>
          <label htmlFor={`${idPrefix}flat-cost`} className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
            Buyer pays ($)
          </label>
          <input
            id={`${idPrefix}flat-cost`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={value.flatCost}
            onChange={(e) => onChange({ ...value, flatCost: e.target.value })}
            placeholder="e.g. 5.00"
            className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
          />
        </div>
      )}
      {value.method !== "calculated" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor={`${idPrefix}shipping-service`} className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Service
            </label>
            <select
              id={`${idPrefix}shipping-service`}
              value={value.service}
              onChange={(e) => onChange({ ...value, service: e.target.value })}
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            >
              <option value="">USPS Priority (default)</option>
              <option value="USPSFirstClass">USPS First Class</option>
              <option value="USPSParcel">USPS Ground (Parcel Select)</option>
              <option value="USPSMedia">USPS Media Mail</option>
              <option value="UPSGround">UPS Ground</option>
              <option value="FedExHomeDelivery">FedEx Home Delivery</option>
              <option value="FedEx2Day">FedEx 2Day</option>
              <option value="UPS2ndDay">UPS 2nd Day Air</option>
            </select>
          </div>
          <div className="w-28">
            <label htmlFor={`${idPrefix}handling-days`} className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Handling (days)
            </label>
            <input
              id={`${idPrefix}handling-days`}
              type="number"
              inputMode="numeric"
              min="0"
              max="30"
              value={value.handlingDays}
              onChange={(e) => onChange({ ...value, handlingDays: e.target.value })}
              placeholder="1"
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
