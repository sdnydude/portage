import { items } from '../db/schema.js';

type Item = typeof items.$inferSelect;

// eBay File Exchange condition ID mapping
const EBAY_CONDITION_MAP: Record<string, string> = {
  new: '1000',
  like_new: '3000',
  good: '4000',
  fair: '5000',
  poor: '7000',
};

// eBay File Exchange column order (required header sequence)
const EBAY_COLUMNS = [
  'Action',
  'Category',
  'Title',
  'Description',
  'ConditionID',
  'Price',
  'Quantity',
  'Format',
  'Duration',
  'PayPalAccepted',
  'PayPalEmailAddress',
  'ShippingType',
  'ShippingService-1:Option',
  'ShippingService-1:Cost',
  'DispatchTimeMax',
  'ReturnsAcceptedOption',
  'ReturnsWithinOption',
  'Location',
  'Country',
  'Currency',
  'PicURL',
] as const;

export interface EbayCsvOptions {
  action?: 'Add' | 'Revise' | 'Verify';
  location?: string;
  country?: string;
}

/**
 * Escape a field value for CSV output.
 * Per RFC 4180: wrap in double-quotes if the field contains
 * commas, double-quotes, or newlines; escape embedded double-quotes
 * by doubling them.
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a single CSV row from an ordered array of field values.
 */
function buildRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

/**
 * Extract the primary photo URL from an item's photos array.
 * Falls back to the first photo if no primary is marked.
 */
function getPrimaryPhotoUrl(photos: unknown): string {
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const primary = (photos as Array<{ url?: string; isPrimary?: boolean }>).find(p => p.isPrimary);
  const photo = primary ?? photos[0];
  return (photo as { url?: string }).url ?? '';
}

/**
 * Convert Portage items to eBay File Exchange CSV format.
 *
 * @param items  - Array of Item rows from the database
 * @param options - Optional overrides for Action, Location, Country
 * @returns Full CSV string including header row, ready for file download
 */
export function itemsToEbayCsv(
  items: Item[],
  options: EbayCsvOptions = {},
): string {
  const action = options.action ?? 'Add';
  const location = options.location ?? 'United States';
  const country = options.country ?? 'US';

  const rows: string[] = [
    // Header
    EBAY_COLUMNS.join(','),
  ];

  for (const item of items) {
    const conditionId = EBAY_CONDITION_MAP[item.condition ?? 'good'] ?? '4000';

    // Use recommended value; fall back to min, then max, then empty
    const price =
      item.estimatedValueRecommended ??
      item.estimatedValueMin ??
      item.estimatedValueMax ??
      null;

    const picUrl = getPrimaryPhotoUrl(item.photos);

    const row = buildRow([
      action,                          // Action
      item.category || '',             // Category
      item.title,                      // Title
      item.description || '',          // Description
      conditionId,                     // ConditionID
      price != null ? price.toFixed(2) : '', // Price
      '1',                             // Quantity
      'FixedPrice',                    // Format
      'GTC',                           // Duration (Good Till Cancelled)
      '1',                             // PayPalAccepted
      '',                              // PayPalEmailAddress (seller fills in)
      'Flat',                          // ShippingType
      'USPSPriority',                  // ShippingService-1:Option
      '0.00',                          // ShippingService-1:Cost (free shipping default)
      '3',                             // DispatchTimeMax (business days)
      'ReturnsAccepted',               // ReturnsAcceptedOption
      'Days_30',                       // ReturnsWithinOption
      location,                        // Location
      country,                         // Country
      'USD',                           // Currency
      picUrl,                          // PicURL
    ]);

    rows.push(row);
  }

  return rows.join('\r\n');
}
