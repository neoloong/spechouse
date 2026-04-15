/**
 * Unit tests for SEO meta generation.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getComparePageMeta,
  getCityListingMeta,
  getPropertyPageMeta,
} from './seo'
import type { PropertySpec } from './api'

// Mock environment
vi.mock('../env', () => ({ NEXT_PUBLIC_BASE_URL: 'https://test.spechouse.vercel.app' }))

const BASE = 'https://test.spechouse.vercel.app'

// ---------------------------------------------------------------------------
// getComparePageMeta
// ---------------------------------------------------------------------------

const makeProps = (overrides: Partial<PropertySpec> = {}): PropertySpec =>
  ({
    id: 1,
    external_id: 'ext-1',
    address_display: '123 Main St, Austin, TX 78701',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    list_price: 500_000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    score_overall: 72,
    score_value: 70,
    score_investment: 65,
    ...overrides,
  }) as PropertySpec

describe('getComparePageMeta', () => {
  // 2-property comparison
  it('generates correct title for 2-property comparison', () => {
    const props = [makeProps({ id: 1, address_display: '123 Main St' }), makeProps({ id: 2, address_display: '456 Oak Ave' })]
    const meta = getComparePageMeta(props)
    expect(meta.title).toBe('Compare 123 Main St vs 456 Oak Ave | SpecHouse')
  })

  it('generates correct title for 3-property comparison', () => {
    const props = [
      makeProps({ id: 1, address_display: '123 Main St' }),
      makeProps({ id: 2, address_display: '456 Oak Ave' }),
      makeProps({ id: 3, address_display: '789 Pine Rd' }),
    ]
    const meta = getComparePageMeta(props)
    expect(meta.title).toBe('Compare 123 Main St and 2 more properties | SpecHouse')
  })

  it('generates correct title for 4-property comparison', () => {
    const props = [
      makeProps({ id: 1, address_display: '123 Main St' }),
      makeProps({ id: 2, address_display: '456 Oak Ave' }),
      makeProps({ id: 3, address_display: '789 Pine Rd' }),
      makeProps({ id: 4, address_display: '321 Elm Blvd' }),
    ]
    const meta = getComparePageMeta(props)
    expect(meta.title).toBe('Compare 123 Main St and 3 more properties | SpecHouse')
  })

  it('includes city in description', () => {
    const props = [makeProps({ city: 'Austin' }), makeProps({ city: 'Austin' })]
    const meta = getComparePageMeta(props)
    expect(meta.description).toContain('Austin')
  })

  it('includes property count in description', () => {
    const props = [makeProps(), makeProps(), makeProps()]
    const meta = getComparePageMeta(props)
    expect(meta.description).toContain('3')
  })

  it('uses idsParam for canonical URL when provided', () => {
    const props = [makeProps({ id: 1 }), makeProps({ id: 2 })]
    const meta = getComparePageMeta(props, '1,2')
    expect(meta.canonicalUrl).toContain('ids=1%2C2')
  })

  it('uses eidsParam for canonical URL when idsParam is absent', () => {
    const props = [makeProps({ id: 1, external_id: 'ext-1' }), makeProps({ id: 2, external_id: 'ext-2' })]
    const meta = getComparePageMeta(props, '', 'ext-1,ext-2')
    expect(meta.canonicalUrl).toContain('eids=ext-1%2Cext-2')
  })

  it('uses base URL without params when neither idsParam nor eidsParam provided', () => {
    const props = [makeProps(), makeProps()]
    const meta = getComparePageMeta(props)
    expect(meta.canonicalUrl).toBe('https://spechouse.vercel.app/compare')
  })

  it('includes JSON-LD RealEstateListing schema', () => {
    const props = [makeProps({ id: 1 }), makeProps({ id: 2 })]
    const meta = getComparePageMeta(props)
    const ld = meta.jsonLd as Record<string, unknown>
    expect(ld['@type']).toBe('RealEstateListing')
    expect(ld['url']).toBe(meta.canonicalUrl)
    expect(ld['numberOfProperties']).toBe(2)
  })

  it('sets ogImage to a placeholder URL', () => {
    const props = [makeProps()]
    const meta = getComparePageMeta(props)
    expect(meta.ogImage).toContain('/og-compare.png')
  })
})

// ---------------------------------------------------------------------------
// getCityListingMeta
// ---------------------------------------------------------------------------

describe('getCityListingMeta', () => {
  it('generates title with city name', () => {
    const meta = getCityListingMeta('Austin', 'TX', 25)
    expect(meta.title).toBe('Austin Property Listings | SpecHouse')
  })

  it('generates description with property count and city', () => {
    const meta = getCityListingMeta('Austin', 'TX', 25)
    expect(meta.description).toContain('25')
    expect(meta.description).toContain('Austin')
  })

  it('includes state in canonical URL', () => {
    const meta = getCityListingMeta('Austin', 'TX', 25)
    expect(meta.canonicalUrl).toContain('state=TX')
  })

  it('omits state param when state is empty', () => {
    const meta = getCityListingMeta('Austin', '', 25)
    expect(meta.canonicalUrl).not.toContain('state=')
  })
})

// ---------------------------------------------------------------------------
// getPropertyPageMeta
// ---------------------------------------------------------------------------

describe('getPropertyPageMeta', () => {
  it('includes price in title when available', () => {
    const prop = makeProps({ id: 99, list_price: 750_000 })
    const meta = getPropertyPageMeta(prop)
    expect(meta.title).toContain('750')
  })

  it('includes address in title', () => {
    const prop = makeProps({ id: 99, address_display: '999 Test Blvd' })
    const meta = getPropertyPageMeta(prop)
    expect(meta.title).toContain('999 Test Blvd')
  })

  it('includes beds/baths/sqft in description', () => {
    const prop = makeProps({ id: 99, beds: 4, baths: 3, sqft: 2500 })
    const meta = getPropertyPageMeta(prop)
    expect(meta.description).toContain('4')
    expect(meta.description).toContain('3')
    expect(meta.description).toContain('2,500')
  })

  it('uses property photo_url as ogImage when available', () => {
    const prop = makeProps({ id: 99, photo_url: 'https://example.com/photo.jpg' })
    const meta = getPropertyPageMeta(prop)
    expect(meta.ogImage).toBe('https://example.com/photo.jpg')
  })

  it('falls back to placeholder ogImage when no photo_url', () => {
    const prop = makeProps({ id: 99, photo_url: undefined })
    const meta = getPropertyPageMeta(prop)
    expect(meta.ogImage).toContain('/og-property.png')
  })

  it('canonical URL includes property id', () => {
    const prop = makeProps({ id: 42 })
    const meta = getPropertyPageMeta(prop)
    expect(meta.canonicalUrl).toContain('/property/42')
  })

  it('JSON-LD includes RealEstateListing schema with geo', () => {
    const prop = makeProps({ id: 99, latitude: 30.27, longitude: -97.74 })
    const meta = getPropertyPageMeta(prop)
    const ld = meta.jsonLd as Record<string, unknown>
    expect(ld['@type']).toBe('RealEstateListing')
    expect((ld['geo'] as Record<string, unknown>)['@type']).toBe('GeoCoordinates')
    expect((ld['geo'] as Record<string, unknown>)['latitude']).toBe(30.27)
  })
})