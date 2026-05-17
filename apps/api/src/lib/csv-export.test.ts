import { describe, it, expect } from 'vitest';
import { itemsToEbayCsv } from './csv-export.js';
import { items } from '../db/schema.js';

type Item = typeof items.$inferSelect;

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    userId: '11111111-2222-3333-4444-555555555555',
    photos: [
      { url: 'https://r2.example.com/photo1.jpg', key: 'photo1.jpg', isPrimary: true },
      { url: 'https://r2.example.com/photo2.jpg', key: 'photo2.jpg' },
    ],
    title: 'Fender Telecaster 2019 American Professional',
    description: 'Great condition guitar with original case.',
    category: 'music',
    condition: 'good',
    conditionNotes: 'Minor fret wear on first 3 frets, small ding on headstock',
    brand: 'Fender',
    model: 'American Professional Telecaster',
    features: ['Alder body', 'Maple neck'],
    estimatedValueMin: 900,
    estimatedValueMax: 1200,
    estimatedValueRecommended: 1050,
    aiConfidenceScore: 0.85,
    marketplaceData: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  } as Item;
}

describe('itemsToEbayCsv', () => {
  describe('header row', () => {
    it('emits decorated Action header with SiteID metadata', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      const headerRow = csv.split('\r\n')[0];
      expect(headerRow).toContain('Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)');
    });

    it('does not CSV-escape the decorated header (no quotes around it)', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      const headerRow = csv.split('\r\n')[0];
      expect(headerRow).not.toContain('"Action(');
    });

    it('includes Custom label (SKU) column', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      const headerRow = csv.split('\r\n')[0];
      expect(headerRow).toContain('Custom label (SKU)');
    });

    it('includes C:Brand and C:Model columns', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      const headerRow = csv.split('\r\n')[0];
      expect(headerRow).toContain('C:Brand');
      expect(headerRow).toContain('C:Model');
    });

    it('includes Condition description column', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      const headerRow = csv.split('\r\n')[0];
      expect(headerRow).toContain('Condition description');
    });
  });

  describe('Action field', () => {
    it('defaults to Draft', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      const dataRow = csv.split('\r\n')[1];
      expect(dataRow.startsWith('Draft,')).toBe(true);
    });

    it('respects action override', () => {
      const { csv } = itemsToEbayCsv([makeItem()], { action: 'Add' });
      const dataRow = csv.split('\r\n')[1];
      expect(dataRow.startsWith('Add,')).toBe(true);
    });
  });

  describe('Category field', () => {
    it('uses marketplaceData.ebay.categoryId when present', () => {
      const item = makeItem({
        marketplaceData: {
          ebay: { categoryId: '33034', categoryName: 'Electric Guitars', title: 'Fender Telecaster', cachedAt: '2026-01-15T00:00:00Z' },
        },
      });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[2]).toBe('33034');
    });

    it('falls back to empty string when marketplaceData is null', () => {
      const item = makeItem({ marketplaceData: null });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[2]).toBe('');
    });
  });

  describe('Title field', () => {
    it('uses marketplaceData.ebay.title when present', () => {
      const item = makeItem({
        marketplaceData: {
          ebay: { categoryId: '33034', categoryName: 'Electric Guitars', title: 'Fender Telecaster American Pro 2019 Electric Guitar Alder Maple', cachedAt: '2026-01-15T00:00:00Z' },
        },
      });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[3]).toBe('Fender Telecaster American Pro 2019 Electric Guitar Alder Maple');
    });

    it('falls back to item.title truncated to 80 chars', () => {
      const longTitle = 'A'.repeat(100);
      const item = makeItem({ title: longTitle, marketplaceData: null });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[3]).toHaveLength(80);
    });

    it('truncates cached eBay title to 80 chars when it exceeds limit', () => {
      const item = makeItem({
        marketplaceData: {
          ebay: { categoryId: '33034', categoryName: 'Guitars', title: 'B'.repeat(95), cachedAt: '2026-01-15T00:00:00Z' },
        },
      });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[3]).toHaveLength(80);
    });
  });

  describe('Description field', () => {
    it('wraps description in HTML paragraph tags', () => {
      const item = makeItem({ description: 'Great condition guitar.' });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[4]).toContain('<p>');
      expect(fields[4]).toContain('Great condition guitar.');
      expect(fields[4]).toContain('</p>');
    });
  });

  describe('PicURL field', () => {
    it('pipe-delimits all photo URLs', () => {
      const item = makeItem({
        photos: [
          { url: 'https://r2.example.com/a.jpg', key: 'a.jpg', isPrimary: true },
          { url: 'https://r2.example.com/b.jpg', key: 'b.jpg' },
          { url: 'https://r2.example.com/c.jpg', key: 'c.jpg' },
        ],
      });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      const picUrlField = fields[fields.length - 3]; // PicURL is 3rd from last (before C:Brand, C:Model)
      expect(picUrlField).toContain('|');
      expect(picUrlField.split('|')).toHaveLength(3);
    });

    it('caps at 12 photos', () => {
      const photos = Array.from({ length: 15 }, (_, i) => ({
        url: `https://r2.example.com/photo${i}.jpg`,
        key: `photo${i}.jpg`,
      }));
      const item = makeItem({ photos });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      const picUrlField = fields[fields.length - 3];
      expect(picUrlField.split('|').length).toBeLessThanOrEqual(12);
    });

    it('returns empty string when no photos', () => {
      const item = makeItem({ photos: [] });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      const picUrlField = fields[fields.length - 3];
      expect(picUrlField).toBe('');
    });

    it('returns empty string when photos is null', () => {
      const item = makeItem({ photos: null as unknown as Item['photos'] });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      const picUrlField = fields[fields.length - 3];
      expect(picUrlField).toBe('');
    });
  });

  describe('Custom label (SKU) field', () => {
    it('uses item UUID as SKU', () => {
      const item = makeItem({ id: 'deadbeef-1234-5678-9abc-def012345678' });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[1]).toBe('deadbeef-1234-5678-9abc-def012345678');
    });
  });

  describe('C:Brand and C:Model fields', () => {
    it('includes brand and model from item', () => {
      const item = makeItem({ brand: 'Fender', model: 'Telecaster' });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[fields.length - 2]).toBe('Fender');
      expect(fields[fields.length - 1]).toBe('Telecaster');
    });

    it('handles empty brand/model gracefully', () => {
      const item = makeItem({ brand: '', model: '' });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields[fields.length - 2]).toBe('');
      expect(fields[fields.length - 1]).toBe('');
    });
  });

  describe('Condition description field', () => {
    it('includes conditionNotes', () => {
      const item = makeItem({ conditionNotes: 'Minor wear on fretboard' });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      const fields = parseCSVRow(dataRow);
      expect(fields.some(f => f === 'Minor wear on fretboard')).toBe(true);
    });
  });

  describe('return shape', () => {
    it('returns { csv, missingCategories, totalRows }', () => {
      const result = itemsToEbayCsv([makeItem()]);
      expect(result).toHaveProperty('csv');
      expect(result).toHaveProperty('missingCategories');
      expect(result).toHaveProperty('totalRows');
      expect(typeof result.csv).toBe('string');
      expect(typeof result.missingCategories).toBe('number');
      expect(typeof result.totalRows).toBe('number');
    });

    it('counts items missing eBay category as missingCategories', () => {
      const items = [
        makeItem({ marketplaceData: { ebay: { categoryId: '33034', categoryName: 'Guitars', title: null, cachedAt: '2026-01-15T00:00:00Z' } } }),
        makeItem({ marketplaceData: null }),
        makeItem({ marketplaceData: { ebay: { categoryId: null, categoryName: null, title: null, cachedAt: '2026-01-15T00:00:00Z' } } }),
      ];
      const result = itemsToEbayCsv(items);
      expect(result.missingCategories).toBe(2);
      expect(result.totalRows).toBe(3);
    });
  });

  describe('existing fields preserved', () => {
    it('includes ConditionID mapped from item.condition', () => {
      const item = makeItem({ condition: 'like_new' });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      expect(dataRow).toContain('3000');
    });

    it('falls back to condition 4000 when condition is null', () => {
      const item = makeItem({ condition: null as unknown as Item['condition'] });
      const { csv } = itemsToEbayCsv([item]);
      const dataRow = csv.split('\r\n')[1];
      expect(dataRow).toContain('4000');
    });

    it('includes shipping and returns fields', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      const headerRow = csv.split('\r\n')[0];
      expect(headerRow).toContain('ShippingType');
      expect(headerRow).toContain('ShippingService-1:Option');
      expect(headerRow).toContain('ReturnsAcceptedOption');
      expect(headerRow).toContain('ReturnsWithinOption');
    });

    it('uses CRLF line endings', () => {
      const { csv } = itemsToEbayCsv([makeItem()]);
      expect(csv).toContain('\r\n');
      expect(csv.split('\r\n').length).toBe(2);
    });
  });

  describe('RFC 4180 escaping', () => {
    it('escapes fields containing commas', () => {
      const item = makeItem({ description: 'Great guitar, excellent tone' });
      const { csv } = itemsToEbayCsv([item]);
      expect(csv).toContain('"');
    });

    it('escapes fields containing double quotes', () => {
      const item = makeItem({ description: 'Called the "workhorse" of guitars' });
      const { csv } = itemsToEbayCsv([item]);
      expect(csv).toContain('""');
    });
  });
});

function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (inQuotes) {
      if (char === '"') {
        if (row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}
