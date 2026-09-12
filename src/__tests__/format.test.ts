import {describe, expect, it} from 'vitest';
import {
  formatPrice,
  idFromSlug,
  listingPath,
  parseCustomFields,
  sellerIdOf,
  slugify,
} from '@/lib/format';
import type {Product} from '@/types';

const UUID = '07034207-e142-487e-a737-bcfb78d5feb6';

describe('slugify', () => {
  it('builds a URL-safe slug from Latin text', () => {
    expect(slugify('iPhone 15 Pro  256GB!')).toBe('iphone-15-pro-256gb');
  });

  it('keeps Arabic characters, which most listings use', () => {
    expect(slugify('أرض ريف اللاذقية')).toBe('أرض-ريف-اللاذقية');
  });

  it('never leaves leading or trailing separators', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
  });
});

describe('listingPath / idFromSlug', () => {
  it('round-trips the listing id through a slugged path', () => {
    const product = {id: UUID, name: 'iPhone 15 Pro', location: 'Berlin, DE'} as Product;
    const path = listingPath(product);
    expect(path).toBe(`/listing/iphone-15-pro-berlin-${UUID}`);
    expect(idFromSlug(path.replace('/listing/', ''))).toBe(UUID);
  });

  it('recovers the id from an Arabic slug', () => {
    const product = {id: UUID, name: 'أرض ريف اللاذقية', location: 'اللاذقية'} as Product;
    expect(idFromSlug(listingPath(product).replace('/listing/', ''))).toBe(UUID);
  });

  it('accepts a bare id with no slug', () => {
    expect(idFromSlug(UUID)).toBe(UUID);
  });
});

describe('formatPrice', () => {
  it('uses the same symbols as the mobile app', () => {
    expect(formatPrice(1250, 'USD')).toBe('$ 1,250');
    expect(formatPrice(200000, 'SYP')).toBe('£ 200,000');
    expect(formatPrice(150, 'TRY')).toBe('₺ 150');
  });

  it('keeps Latin digits so prices match the app in Arabic', () => {
    const formatted = formatPrice(200000, 'SYP');
    expect(formatted).toBe('£ 200,000');
    // No Arabic-Indic digits (U+0660–U+0669).
    expect(formatted).not.toMatch(/[\u0660-\u0669]/);
  });

  it('returns null when there is no price, rather than rendering zero', () => {
    expect(formatPrice(null, 'USD')).toBeNull();
    expect(formatPrice(undefined, 'USD')).toBeNull();
    expect(formatPrice('', 'USD')).toBeNull();
    expect(formatPrice('abc', 'USD')).toBeNull();
  });

  it('shows a genuine zero price', () => {
    expect(formatPrice(0, 'USD')).toBe('$ 0');
  });

  it('falls back to the code itself for an unmapped currency', () => {
    expect(formatPrice(100, 'EUR')).toBe('EUR 100');
  });

  it('defaults to the dollar sign when no currency is stored', () => {
    expect(formatPrice(50, null)).toBe('$ 50');
  });
});

describe('parseCustomFields', () => {
  it('parses the JSON string the API returns', () => {
    expect(parseCustomFields('[{"name":"brand","value":"Apple"}]')).toEqual([
      {name: 'brand', value: 'Apple'},
    ]);
  });

  it('tolerates empty and malformed values', () => {
    expect(parseCustomFields('[]')).toEqual([]);
    expect(parseCustomFields('not json')).toEqual([]);
    expect(parseCustomFields(null)).toEqual([]);
  });
});

describe('sellerIdOf', () => {
  it('prefers seller_id but falls back through the API aliases', () => {
    expect(sellerIdOf({seller_id: 'a', user_id: 'b', userID: 'c'} as Product)).toBe('a');
    expect(sellerIdOf({user_id: 'b', userID: 'c'} as Product)).toBe('b');
    expect(sellerIdOf({userID: 'c'} as Product)).toBe('c');
  });
});
