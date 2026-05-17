import { items } from '../db/schema.js';

type Item = typeof items.$inferSelect;

const EBAY_CONDITION_MAP: Record<string, string> = {
  new: '1000',
  like_new: '3000',
  good: '4000',
  fair: '5000',
  poor: '7000',
};

const EBAY_COLUMNS = [
  'Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)',
  'Custom label (SKU)',
  'Category',
  'Title',
  'Description',
  'ConditionID',
  'Condition description',
  'Price',
  'Quantity',
  'Format',
  'Duration',
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
  'C:Brand',
  'C:Model',
] as const;

export interface EbayCsvOptions {
  action?: 'Draft' | 'Add' | 'Revise' | 'Verify';
  location?: string;
  country?: string;
}

export interface EbayCsvResult {
  csv: string;
  missingCategories: number;
  totalRows: number;
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

function getAllPhotoUrls(photos: unknown): string {
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const urls = (photos as Array<{ url?: string; isPrimary?: boolean }>)
    .slice(0, 12)
    .map(p => p.url)
    .filter(Boolean) as string[];
  return urls.join('|');
}

function wrapHtml(text: string): string {
  if (!text) return '';
  return `<p>${text}</p>`;
}

export function itemsToEbayCsv(
  items: Item[],
  options: EbayCsvOptions = {},
): EbayCsvResult {
  const action = options.action ?? 'Draft';
  const location = options.location ?? 'United States';
  const country = options.country ?? 'US';

  let missingCategories = 0;

  const rows: string[] = [
    EBAY_COLUMNS.join(','),
  ];

  for (const item of items) {
    const ebayCache = (item.marketplaceData as { ebay?: { categoryId?: string | null; title?: string | null } } | null)?.ebay;

    const categoryId = ebayCache?.categoryId ?? '';
    if (!categoryId) missingCategories++;

    const title = ebayCache?.title ?? item.title.slice(0, 80);
    const conditionId = EBAY_CONDITION_MAP[item.condition ?? 'good'] ?? '4000';

    const price =
      item.estimatedValueRecommended ??
      item.estimatedValueMin ??
      item.estimatedValueMax ??
      null;

    const picUrl = getAllPhotoUrls(item.photos);

    const row = buildRow([
      action,
      item.id,
      categoryId,
      title,
      wrapHtml(item.description || ''),
      conditionId,
      item.conditionNotes || '',
      price != null ? price.toFixed(2) : '',
      '1',
      'FixedPrice',
      'GTC',
      'Flat',
      'USPSPriority',
      '0.00',
      '3',
      'ReturnsAccepted',
      'Days_30',
      location,
      country,
      'USD',
      picUrl,
      item.brand || '',
      item.model || '',
    ]);

    rows.push(row);
  }

  return {
    csv: rows.join('\r\n'),
    missingCategories,
    totalRows: items.length,
  };
}
