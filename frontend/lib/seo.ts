/**
 * SEO meta-generation for SpecHouse pages.
 *
 * Produces title, description, canonical URL, OG image URL, and JSON-LD
 * structured data for compare pages, city listing pages, and property detail pages.
 */

import type { PropertySpec } from './api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparePageMeta {
  title: string
  description: string
  canonicalUrl: string
  ogImage: string
  jsonLd: object
}

export interface CityListingMeta {
  title: string
  description: string
  canonicalUrl: string
}

export interface PropertyPageMeta {
  title: string
  description: string
  canonicalUrl: string
  ogImage: string
  jsonLd: object
}

// ---------------------------------------------------------------------------
// Compare page
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://spechouse.vercel.app'

/**
 * Generate SEO metadata for a property comparison page.
 *
 * @param properties Array of 2–4 PropertySpec objects to compare.
 * @param idsParam The raw `ids` query string (e.g. "1,2,3"). Used to build canonical URL.
 * @param eidsParam The raw `eids` query string. Used as fallback when idsParam is empty.
 */
export function getComparePageMeta(
  properties: PropertySpec[],
  idsParam?: string | null,
  eidsParam?: string | null,
): ComparePageMeta {
  const n = properties.length

  // Title: "Compare 123 Main St vs 456 Oak Ave | SpecHouse"
  const addresses = properties.map((p) => p.address_display?.split(',')[0] ?? p.address_display ?? 'Property').filter(Boolean)
  const title =
    n === 2
      ? `Compare ${addresses[0]} vs ${addresses[1]} | SpecHouse`
      : `Compare ${addresses[0]} and ${n - 1} more properties | SpecHouse`

  // Description
  const firstCity = properties[0]?.city ?? ''
  const description = `Side-by-side comparison of ${n} propert${n === 1 ? 'y' : 'ies'} in ${firstCity}. View value, investment, and environment scores.`

  // Canonical URL — use `ids` param if available, otherwise `eids`
  const rawIds = idsParam ?? ''
  const rawEids = eidsParam ?? ''
  const canonicalUrl =
    rawIds
      ? `${BASE_URL}/compare?ids=${encodeURIComponent(rawIds)}`
      : rawEids
        ? `${BASE_URL}/compare?eids=${encodeURIComponent(rawEids)}`
        : `${BASE_URL}/compare`

  // OG image — placeholder URL (swap for a real dynamic image service later)
  const ogImage = `${BASE_URL}/og-compare.png`

  // JSON-LD RealEstateListing
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: title,
    description,
    url: canonicalUrl,
    numberOfProperties: n,
    properties: properties.map((p) => ({
      '@type': 'Offer',
      name: p.address_display,
      url: `${BASE_URL}/property/${p.id}`,
      price: p.list_price,
      priceCurrency: 'USD',
      address: {
        '@type': 'PostalAddress',
        streetAddress: p.address_display,
        addressLocality: p.city,
        addressRegion: p.state,
        postalCode: p.zip_code,
      },
    })),
  }

  return { title, description, canonicalUrl, ogImage, jsonLd }
}

// ---------------------------------------------------------------------------
// City listings page
// ---------------------------------------------------------------------------

/**
 * Generate SEO metadata for a city property listing page.
 */
export function getCityListingMeta(
  city: string,
  state: string,
  propertyCount: number,
): CityListingMeta {
  const title = `${city} Property Listings | SpecHouse`
  const description = `Compare ${propertyCount} propert${propertyCount === 1 ? 'y' : 'ies'} in ${city}. View specs, scores, and value analysis.`
  const canonicalUrl = `${BASE_URL}/listings?city=${encodeURIComponent(city)}${state ? `&state=${encodeURIComponent(state)}` : ''}`

  return { title, description, canonicalUrl }
}

// ---------------------------------------------------------------------------
// Property detail page
// ---------------------------------------------------------------------------

/**
 * Generate SEO metadata for a single property detail page.
 */
export function getPropertyPageMeta(property: PropertySpec): PropertyPageMeta {
  const { address_display, city, state, list_price, beds, baths, sqft, id } = property

  const title = `${address_display} - ${list_price ? `$${list_price.toLocaleString()}` : 'For Sale'} | SpecHouse`
  const description = `${beds ?? '?'} bed, ${baths ?? '?'} bath, ${sqft?.toLocaleString() ?? '?'} sqft home in ${city}, ${state}. Compare prices, schools, noise, and crime on SpecHouse.`

  const canonicalUrl = `${BASE_URL}/property/${id}`
  const ogImage = property.photo_url ?? `${BASE_URL}/og-property.png`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: address_display,
    description,
    url: canonicalUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address_display,
      addressLocality: city,
      addressRegion: state,
      postalCode: property.zip_code,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: property.latitude,
      longitude: property.longitude,
    },
    offers: {
      '@type': 'Offer',
      price: list_price,
      priceCurrency: 'USD',
    },
    numberOfRooms: (beds ?? 0) + ((baths ?? 0) % 1 >= 0.5 ? 0.5 : 0),
    floorSize: {
      '@type': 'QuantitativeValue',
      value: sqft,
      unitCode: 'FTK',
    },
  }

  return { title, description, canonicalUrl, ogImage, jsonLd }
}