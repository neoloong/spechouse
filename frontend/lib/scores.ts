/**
 * SpecHouse scoring engine.
 *
 * Produces three component scores (value, investment, environment) and an
 * overall weighted score. All scores are 0–100 unless data is missing, in
 * which case null is returned and callers should use getScoreWithNullHandling.
 */

import type { PropertySpec } from './api'
import {
  SCORE_WEIGHTS,
  NOISE_BUCKETS,
  NOISE_LABELS,
  MIN_DATA_COMPLETENESS,
  CAP_RATE_MIN,
  CAP_RATE_MAX,
  CAP_RATE_RANGE,
  VALUE_SCORE_MIN_DISCOUNT,
  VALUE_SCORE_MAX_DISCOUNT,
  DOM_SLOW_MARKET,
  DOM_FAST_MARKET,
  PRICE_CUT_MAX_BONUS,
  CRIME_SCORE_MIN,
  CRIME_SCORE_MAX,
} from './scoreConfig'

// ---------------------------------------------------------------------------
// Value Score
// ---------------------------------------------------------------------------

/**
 * Compute the value score (0–100).
 *
 * Signals:
 *  - AVM discount ratio  → primary driver (list price vs automated valuation)
 *  - Days on market      → slow properties get a bonus (seller may accept lowball)
 *  - Price cut count     → additional negotiation room signal
 *
 * Returns null when AVM is unavailable (core required input).
 */
export function calculateValueScore(
  price: number,
  avm: number,
  daysOnMarket: number,
  priceCutCount: number,
): number | null {
  if (!avm || avm <= 0) return null

  // AVM discount ratio: (price - avm) / avm
  // Negative = above market, positive = below market
  const discountRatio = (price - avm) / avm

  // Map discount ratio → 0-100 score
  // 30% below AVM  → 100
  // at AVM         → ~50
  // 10% above AVM  → 0
  const discountScore = clamp(
    ((VALUE_SCORE_MAX_DISCOUNT - discountRatio) /
      (VALUE_SCORE_MAX_DISCOUNT - VALUE_SCORE_MIN_DISCOUNT)) *
      100,
    0,
    100,
  )

  // Days-on-market factor: 0–10 bonus points
  // Fresh (< DOM_FAST_MARKET days)  → 0 bonus
  // Stale (> DOM_SLOW_MARKET days)  → +10 bonus
  const domFactor = clamp(
    ((daysOnMarket - DOM_FAST_MARKET) / (DOM_SLOW_MARKET - DOM_FAST_MARKET)) * PRICE_CUT_MAX_BONUS,
    0,
    PRICE_CUT_MAX_BONUS,
  )

  // Price-cut factor: each cut adds a small bonus (capped at PRICE_CUT_MAX_BONUS)
  const cutFactor = clamp(priceCutCount * 2, 0, PRICE_CUT_MAX_BONUS)

  return clamp(discountScore + domFactor + cutFactor, 0, 100)
}

// ---------------------------------------------------------------------------
// Investment Score
// ---------------------------------------------------------------------------

export interface InvestmentScoreResult {
  score: number
  confidenceRange: number // ± value
}

/**
 * Compute the investment score (0–100) using cap rate methodology.
 *
 * Cap rate = (annual_rental_net / price)
 *   where annual_rental_net = (rentEstimate * 12) - propertyTax - insurance
 *
 * Returns null when rent estimate is unavailable (core required input).
 */
export function calculateInvestmentScore(
  rentEstimate: number,
  price: number,
  propertyTax: number,
  insurance: number,
): InvestmentScoreResult | null {
  if (!rentEstimate || rentEstimate <= 0) return null

  const annualRent = rentEstimate * 12
  const annualExpenses = (propertyTax ?? 0) + (insurance ?? 0)
  const netIncome = annualRent - annualExpenses

  if (price <= 0) return null

  const capRate = netIncome / price

  // Map cap rate → 0-100 score
  // 2%  → 0
  // 10% → 100
  const score = clamp(((capRate - CAP_RATE_MIN) / CAP_RATE_RANGE) * 100, 0, 100)

  // Confidence range: wider when cap rate is near boundaries
  // ±10 at extremes, ±5 near middle
  const normalizedCap = clamp((capRate - CAP_RATE_MIN) / CAP_RATE_RANGE, 0, 1)
  const confidenceRange = 10 - normalizedCap * 5

  return {
    score: clamp(score, 0, 100),
    confidenceRange,
  }
}

// ---------------------------------------------------------------------------
// Environment Score
// ---------------------------------------------------------------------------

export interface EnvironmentScoreResult {
  score: number
  confidence: number // 0–1
  noiseLabel?: string
}

/**
 * Compute the environment score (0–100) from noise and crime data.
 *
 * Noise: bucketed into Quiet / Moderate / Loud bands (dB thresholds).
 * Crime:  inverted (lower crime score = higher environment score).
 *
 * Returns null only when BOTH noise and crime are unavailable.
 * When only one is available the other is treated as 50 (neutral) with
 * lower overall confidence.
 */
export function calculateEnvironmentScore(
  noiseDB: number | null,
  crimeScore: number | null,
): EnvironmentScoreResult | null {
  const hasNoise = noiseDB != null
  const hasCrime = crimeScore != null

  if (!hasNoise && !hasCrime) return null

  // Noise bucket: 0–100
  let noiseScore = 50
  let noiseLabel: string | undefined

  if (hasNoise) {
    if (noiseDB! < NOISE_BUCKETS.quiet) {
      noiseScore = 100
      noiseLabel = NOISE_LABELS.below_50
    } else if (noiseDB! < NOISE_BUCKETS.moderate) {
      noiseScore = 70
      noiseLabel = NOISE_LABELS.above_50_below_65
    } else {
      noiseScore = 30
      noiseLabel = NOISE_LABELS.above_65
    }
  }

  // Crime score: 0–100, already on scale where 0=worst, 100=best
  // (API returns higher = safer, so we use directly)
  let crimeNorm = 50
  if (hasCrime) {
    crimeNorm = clamp(crimeScore!, CRIME_SCORE_MIN, CRIME_SCORE_MAX)
  }

  // Weight noise and crime equally
  const divisor = (hasNoise ? 1 : 0) + (hasCrime ? 1 : 0)
  const score = (noiseScore + crimeNorm) / divisor

  // Confidence: 1.0 when both available, 0.6 when only one
  const confidence = hasNoise && hasCrime ? 1.0 : 0.6

  return {
    score: clamp(score, 0, 100),
    confidence,
    noiseLabel,
  }
}

// ---------------------------------------------------------------------------
// Overall Score
// ---------------------------------------------------------------------------

export interface OverallScoreResult {
  score: number
  breakdown: {
    value: number
    investment: number
    environment: number
  }
  confidence: number // 0–1, weighted average of component confidences
}

/**
 * Compute the overall score as a weighted average of the three component scores.
 * All inputs should already be on a 0–100 scale.
 *
 * Confidence is propagated as the weighted average of component confidences.
 * Component confidences should be in [0, 1].
 */
export function calculateOverallScore(
  value: number,
  investment: number,
  environment: number,
  weights = SCORE_WEIGHTS,
): OverallScoreResult {
  const rawScore =
    value * weights.value + investment * weights.investment + environment * weights.environment

  const confidence =
    weights.value * 1.0 +   // value: assume full confidence when passed in
    weights.investment * 1.0 + // investment: full confidence
    weights.environment * 1.0  // environment: already has confidence [0-1]

  return {
    score: clamp(rawScore, 0, 100),
    breakdown: { value, investment, environment },
    confidence: clamp(confidence, 0, 1),
  }
}

// ---------------------------------------------------------------------------
// Null / Missing-Data Handling
// ---------------------------------------------------------------------------

export interface DisplayScore {
  displayScore: number
  isVisible: boolean
  note: string
}

/**
 * Convert a raw score (or null) into a display-safe result.
 *
 * If rawScore is null → treat as 50 (neutral) and hide from UI.
 * If dataCompleteness < MIN_DATA_COMPLETENESS → treat as insufficient.
 */
export function getScoreWithNullHandling(
  rawScore: number | null,
  confidence: number = 1,
  dataCompleteness: number = 1,
): DisplayScore {
  if (rawScore === null || dataCompleteness < MIN_DATA_COMPLETENESS) {
    return {
      displayScore: 50,
      isVisible: false,
      note: 'Insufficient data',
    }
  }

  return {
    displayScore: clamp(rawScore, 0, 100),
    isVisible: true,
    note: '',
  }
}

// ---------------------------------------------------------------------------
// City Percentile Calibration
// ---------------------------------------------------------------------------

/**
 * Given a list of properties, update each property's overall score to its
 * percentile rank within the city (relative to other properties in the list).
 *
 * This lets us answer "this property is in the top 30% of the city" rather
 * than "this property scored 72."
 *
 * Mutates the `score_overall` field of each property in place and returns
 * the same array.
 */
export function calibrateCityPercentile(properties: PropertySpec[]): PropertySpec[] {
  if (properties.length === 0) return properties

  const valid = properties.filter((p) => p.score_overall != null)
  if (valid.length < 2) {
    // Not enough data to compute percentiles; leave scores unchanged
    return properties
  }

  const sorted = [...valid].sort((a, b) => (a.score_overall ?? 0) - (b.score_overall ?? 0))
  const n = sorted.length

  for (const prop of valid) {
    const score = prop.score_overall ?? 0
    // Use findLastIndex to get the position of the LAST property with this score
    // (so tied top properties all get 100, not a lower value)
    const rankPosition = sorted.findLastIndex((p) => (p.score_overall ?? 0) === score)
    // percentile rank: 0 = lowest score, n-1 = highest score → 0-100 scale
    const percentile = Math.round((rankPosition / (n - 1)) * 100)
    prop.score_overall = clamp(percentile, 0, 100) as typeof prop.score_overall
  }

  return properties
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
