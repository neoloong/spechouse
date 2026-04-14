/**
 * Score configuration — constants and types for the SpecHouse scoring engine.
 */

// Score weights (PM-recommended defaults)
export const SCORE_WEIGHTS = {
  value: 0.4,
  investment: 0.35,
  environment: 0.25,
} as const

// Noise bucket thresholds (dB)
export const NOISE_BUCKETS = {
  quiet: 50,
  moderate: 65,
} as const

export const NOISE_LABELS = {
  below_50: 'Quiet',
  above_50_below_65: 'Moderate',
  above_65: 'Loud',
} as const

// Minimum data completeness (fraction of inputs available) before showing a score
export const MIN_DATA_COMPLETENESS = 0.5

// Cap rate scoring constants
export const CAP_RATE_MIN = 0.02   // 2% → bottom of scale
export const CAP_RATE_MAX = 0.10   // 10% → top of scale
export const CAP_RATE_RANGE = CAP_RATE_MAX - CAP_RATE_MIN

// Value score constants (AVM discount %)
export const VALUE_SCORE_MIN_DISCOUNT = -0.10  // 10% above AVM
export const VALUE_SCORE_MAX_DISCOUNT = 0.30   // 30% below AVM

// Days on market scoring
export const DOM_SLOW_MARKET = 90   // days → max score penalty
export const DOM_FAST_MARKET = 7    // days → max bonus
export const PRICE_CUT_MAX_BONUS = 10 // max extra points from price cuts

// Crime score constants
export const CRIME_SCORE_MIN = 0
export const CRIME_SCORE_MAX = 100
