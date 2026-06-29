import { describe, it, expect } from 'vitest';
import {
  buildAddFixedPriceItemXml,
  buildVerifyAddFixedPriceItemXml,
  buildReviseInventoryStatusXml,
  buildReviseFixedPriceItemXml,
  buildEndFixedPriceItemXml,
  buildGetItemXml,
  parseAddItemResponse,
  parseGetItemStatus,
  splitOunces,
  type TradingListingInput,
} from './ebay-trading-builders.js';

const baseInput: TradingListingInput = {
  title: 'Sennheiser HD 600 Headphones',
  description: 'Open-box, excellent condition.',
  categoryId: '14985',
  price: 199.99,
  currency: 'USD',
  quantity: 1,
  conditionId: '3000',
  conditionDescription: 'Light wear on headband.',
  sku: 'PRT-000011',
  pictureUrls: ['https://img.example/r2/a.jpg', 'https://img.example/r2/b.jpg'],
  aspects: { Brand: ['Sennheiser'], Model: ['HD 600'], MPN: ['Does Not Apply'] },
  shipping: {
    originPostalCode: '10001',
    weightMajor: 1,
    weightMinor: 8,
    dimensions: { length: 12, width: 9, height: 6 },
  },
};

describe('buildAddFixedPriceItemXml', () => {
  it('wraps core fields in AddFixedPriceItemRequest with auth token, numeric condition, US/USD GTC', () => {
    const xml = buildAddFixedPriceItemXml(baseInput, 'TOKEN123');
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain('<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">');
    expect(xml).toContain('<eBayAuthToken>TOKEN123</eBayAuthToken>');
    expect(xml).toContain('<Title>Sennheiser HD 600 Headphones</Title>');
    expect(xml).toContain('<PrimaryCategory><CategoryID>14985</CategoryID></PrimaryCategory>');
    expect(xml).toContain('<StartPrice currencyID="USD">199.99</StartPrice>');
    expect(xml).toContain('<Quantity>1</Quantity>');
    expect(xml).toContain('<ListingType>FixedPriceItem</ListingType>');
    expect(xml).toContain('<ListingDuration>GTC</ListingDuration>');
    expect(xml).toContain('<ConditionID>3000</ConditionID>');
    expect(xml).toContain('<Country>US</Country>');
    expect(xml).toContain('<Currency>USD</Currency>');
    expect(xml).toContain('</AddFixedPriceItemRequest>');
  });

  it('renders description, every picture URL, multi-value item specifics, SKU and condition description', () => {
    const xml = buildAddFixedPriceItemXml(
      { ...baseInput, aspects: { Color: ['Black', 'Silver'], Brand: ['Sennheiser'] } },
      'T',
    );
    expect(xml).toContain('<Description>Open-box, excellent condition.</Description>');
    expect(xml).toContain('<PictureDetails>');
    expect(xml).toContain('<PictureURL>https://img.example/r2/a.jpg</PictureURL>');
    expect(xml).toContain('<PictureURL>https://img.example/r2/b.jpg</PictureURL>');
    expect(xml).toContain('<ItemSpecifics>');
    expect(xml).toContain('<NameValueList><Name>Color</Name><Value>Black</Value><Value>Silver</Value></NameValueList>');
    expect(xml).toContain('<NameValueList><Name>Brand</Name><Value>Sennheiser</Value></NameValueList>');
    expect(xml).toContain('<SKU>PRT-000011</SKU>');
    expect(xml).toContain('<ConditionDescription>Light wear on headband.</ConditionDescription>');
  });

  it('marks self-hosted (R2) pictures with PictureSource=Vendor so eBay does not treat them as EPS', () => {
    expect(buildAddFixedPriceItemXml(baseInput, 'T')).toContain('<PictureDetails><PictureSource>Vendor</PictureSource>');
  });

  it('sends inline terms (Decision 5): no-returns + Calculated buyer-paid USPS + DispatchTimeMax=1, never SellerProfiles/PaymentMethods', () => {
    const xml = buildAddFixedPriceItemXml(baseInput, 'T');
    expect(xml).toContain('<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>');
    expect(xml).toContain('<ShippingDetails>');
    expect(xml).toContain('<ShippingType>Calculated</ShippingType>');
    expect(xml).toContain('<OriginatingPostalCode>10001</OriginatingPostalCode>');
    expect(xml).toMatch(/<ShippingService>USPS\w+<\/ShippingService>/);
    // weight/dims live in ShippingPackageDetails at Item level (CalculatedShippingRate
    // is deprecated for them — schema-verified); units are oz/in/lbs, not ozs/inches.
    expect(xml).toContain('<ShippingPackageDetails>');
    expect(xml).toContain('<MeasurementUnit>English</MeasurementUnit>');
    expect(xml).toContain('<WeightMajor unit="lbs">1</WeightMajor>');
    expect(xml).toContain('<WeightMinor unit="oz">8</WeightMinor>');
    expect(xml).toContain('<PackageLength unit="in">12</PackageLength>');
    expect(xml).toContain('<PackageWidth unit="in">9</PackageWidth>');
    expect(xml).toContain('<PackageDepth unit="in">6</PackageDepth>');
    expect(xml).toContain('<ShippingPackage>');
    expect(xml).toContain('<DispatchTimeMax>1</DispatchTimeMax>');
    expect(xml).not.toContain('<SellerProfiles>');
    expect(xml).not.toContain('<PaymentMethods>');
  });

  it('includes BestOfferDetails only when a floor below price is set (G9), and escapes XML-special chars', () => {
    const withFloor = buildAddFixedPriceItemXml({ ...baseInput, bestOfferAutoAcceptPrice: 150 }, 'T');
    expect(withFloor).toContain('<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>');
    expect(withFloor).toContain('<BestOfferAutoAcceptPrice currencyID="USD">150</BestOfferAutoAcceptPrice>');
    expect(buildAddFixedPriceItemXml(baseInput, 'T')).not.toContain('<BestOfferDetails>');
    expect(buildAddFixedPriceItemXml({ ...baseInput, bestOfferAutoAcceptPrice: 250 }, 'T')).not.toContain('<BestOfferDetails>');
    const escaped = buildAddFixedPriceItemXml(
      { ...baseInput, title: 'Tom & Jerry <best>', aspects: { Brand: ['A & B'] } },
      'T',
    );
    expect(escaped).toContain('<Title>Tom &amp; Jerry &lt;best&gt;</Title>');
    expect(escaped).toContain('<Value>A &amp; B</Value>');
    expect(escaped).not.toContain('Tom & Jerry');
  });
});

describe('buildVerifyAddFixedPriceItemXml (dry-run validation, no listing created)', () => {
  it('wraps the SAME item body as Add in a VerifyAddFixedPriceItemRequest', () => {
    const xml = buildVerifyAddFixedPriceItemXml(baseInput, 'T');
    expect(xml).toContain('<VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">');
    expect(xml).toContain('<eBayAuthToken>T</eBayAuthToken>');
    // identical Item content to the real Add call (so validating proves the real payload)
    expect(xml).toContain('<Title>Sennheiser HD 600 Headphones</Title>');
    expect(xml).toContain('<ListingType>FixedPriceItem</ListingType>');
    expect(xml).toContain('<ShippingPackageDetails>');
    expect(xml).not.toContain('<SellerProfiles>');
    expect(xml).toContain('</VerifyAddFixedPriceItemRequest>');
  });
});

describe('buildReviseInventoryStatusXml (price/qty-only fast path)', () => {
  it('revises price and quantity by ItemID, emitting only provided fields and no listing content', () => {
    const both = buildReviseInventoryStatusXml('item-1', { price: 179.5, quantity: 2, currency: 'USD' }, 'T');
    expect(both).toContain('<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">');
    expect(both).toContain('<InventoryStatus>');
    expect(both).toContain('<ItemID>item-1</ItemID>');
    expect(both).toContain('<StartPrice currencyID="USD">179.5</StartPrice>');
    expect(both).toContain('<Quantity>2</Quantity>');
    expect(both).not.toContain('<Title>');
    const priceOnly = buildReviseInventoryStatusXml('item-1', { price: 50, currency: 'USD' }, 'T');
    expect(priceOnly).toContain('<StartPrice currencyID="USD">50</StartPrice>');
    expect(priceOnly).not.toContain('<Quantity>');
  });
});

describe('buildReviseFixedPriceItemXml (full content revise)', () => {
  it('revises by ItemID, carrying the full inline item body without SellerProfiles', () => {
    const xml = buildReviseFixedPriceItemXml('item-9', baseInput, 'T');
    expect(xml).toContain('<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">');
    expect(xml).toContain('<Item><ItemID>item-9</ItemID>');
    expect(xml).toContain('<Title>Sennheiser HD 600 Headphones</Title>');
    expect(xml).toContain('<ShippingType>Calculated</ShippingType>');
    expect(xml).not.toContain('<SellerProfiles>');
  });
});

describe('buildEndFixedPriceItemXml', () => {
  it('ends a listing by ItemID with NotAvailable reason', () => {
    const xml = buildEndFixedPriceItemXml('item-3', 'T');
    expect(xml).toContain('<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">');
    expect(xml).toContain('<ItemID>item-3</ItemID>');
    expect(xml).toContain('<EndingReason>NotAvailable</EndingReason>');
  });
});

describe('buildGetItemXml', () => {
  it('requests one item by ItemID', () => {
    const xml = buildGetItemXml('item-7', 'T');
    expect(xml).toContain('<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">');
    expect(xml).toContain('<ItemID>item-7</ItemID>');
  });
});

describe('parseAddItemResponse', () => {
  it('returns ItemID on success and on Warning (M7), null when absent', () => {
    expect(parseAddItemResponse({ AddFixedPriceItemResponse: { Ack: 'Success', ItemID: '3001234567' } })).toBe('3001234567');
    expect(parseAddItemResponse({ AddFixedPriceItemResponse: { Ack: 'Warning', ItemID: '3009999999' } })).toBe('3009999999');
    expect(parseAddItemResponse({ AddFixedPriceItemResponse: { Ack: 'Failure' } })).toBeNull();
  });
});

describe('parseGetItemStatus', () => {
  it('maps eBay ListingStatus to the adapter status union', () => {
    const mk = (status: string, qtySold = 0) => ({
      GetItemResponse: { Item: { SellingStatus: { ListingStatus: status, QuantitySold: qtySold } } },
    });
    expect(parseGetItemStatus(mk('Active'))).toBe('active');
    expect(parseGetItemStatus(mk('Completed', 1))).toBe('sold');
    expect(parseGetItemStatus(mk('Completed', 0))).toBe('ended');
    expect(parseGetItemStatus(mk('Ended'))).toBe('ended');
    expect(parseGetItemStatus({ GetItemResponse: {} })).toBe('unknown');
  });
});

describe('splitOunces', () => {
  it('splits total ounces into whole lbs + remainder oz (eBay WeightMajor/WeightMinor)', () => {
    expect(splitOunces(24)).toEqual({ weightMajor: 1, weightMinor: 8 });
    expect(splitOunces(8)).toEqual({ weightMajor: 0, weightMinor: 8 });
    expect(splitOunces(32)).toEqual({ weightMajor: 2, weightMinor: 0 });
    expect(splitOunces(0)).toEqual({ weightMajor: 0, weightMinor: 0 });
    expect(splitOunces(17.5)).toEqual({ weightMajor: 1, weightMinor: 2 });
  });
});
