/**
 * Unit tests for the SpecHouse scoring engine.
 */

import { describe, expect, it } from 'vitest'
import {
  calculateValueScore,
  calculateInvestmentScore,
  calculateEnvironmentScore,
  calculateOverallScore,
  getScoreWithNullHandling,
  calibrateCityPercentile,
} from './scores'
import type { PropertySpec } from './api'

// ---------------------------------------------------------------------------
// Value Score
// ---------------------------------------------------------------------------

describe('calculateValueScore', () => {
  it('returns null when AVM is unavailable', () => {
    expect(calculateValueScore(500_000, 0, 30, 0)).toBeNull()
    expect(calculateValueScore(500_000, -1, 30, 0)).toBeNull()
  })

  it('returns higher score for deeper AVM discounts', () => {
    // 10% below AVM → should score well
    const below = calculateValueScore(450_000, 500_000, 30, 0)
    // At AVM
    const at = calculateValueScore(500_000, 500_000, 30, 0)
    // 10% above AVM → poor
    const above = calculateValueScore(550_000, 500_000, 30, 0)

    expect(below).toBeGreaterThan(at!)
    expect(at!).toBeGreaterThan(above!)
  })

  it('returns a score in 0–100 range', () => {
    const s = calculateValueScore(400_000, 500_000, 30, 0)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(100)
  })

  it('applies DOM bonus for stale listings', () => {
    // Use a smaller AVM discount (5%) so there's room for DOM bonus
    const fresh = calculateValueScore(475_000, 500_000, 7, 0)
    const stale = calculateValueScore(475_000, 500_000, 90, 0)
    expect(stale!).toBeGreaterThan(fresh!)
  })

  it('applies price-cut bonus', () => {
    // Use a smaller AVM discount so there's room for cut bonus
    const noCuts = calculateValueScore(475_000, 500_000, 30, 0)
    const withCuts = calculateValueScore(475_000, 500_000, 30, 3)
    expect(withCuts!).toBeGreaterThan(noCuts!)
  })
})

// ---------------------------------------------------------------------------
// Investment Score
// ---------------------------------------------------------------------------

describe('calculateInvestmentScore', () => {
  it('returns null when rent estimate is unavailable', () => {
    expect(calculateInvestmentScore(0, 500_000, 5000, 1500)).toBeNull()
    expect(calculateInvestmentScore(-1, 500_000, 5000, 1500)).toBeNull()
  })

  it('returns null when price is zero or negative', () => {
    expect(calculateInvestmentScore(2500, 0, 5000, 1500)).toBeNull()
  })

  it('returns score with confidence range when data is valid', () => {
    const result = calculateInvestmentScore(2500, 500_000, 5000, 1500)
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThanOrEqual(0)
    expect(result!.score).toBeLessThanOrEqual(100)
    expect(result!.confidenceRange).toBeGreaterThan(0)
  })

  it('returns higher score for higher cap rates', () => {
    // $2500/mo rent on $500k → cap ~5.4%
    const moderate = calculateInvestmentScore(2500, 500_000, 5000, 1500)
    // $4000/mo rent on $500k → cap ~8.8%
    const high = calculateInvestmentScore(4000, 500_000, 5000, 1500)

    expect(high!.score).toBeGreaterThan(moderate!.score)
  })

  it('caps score at 0–100', () => {
    // Extremely high rent → should not exceed 100
    const result = calculateInvestmentScore(10_000, 100_000, 1000, 500)
    expect(result!.score).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// Environment Score
// ---------------------------------------------------------------------------

describe('calculateEnvironmentScore', () => {
  it('returns null when both noise and crime are null', () => {
    expect(calculateEnvironmentScore(null, null)).toBeNull()
  })

  it('returns a result when only noise is available', () => {
    const result = calculateEnvironmentScore(45, null)
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThan(0)
    expect(result!.confidence).toBeLessThan(1.0)
  })

  it('returns a result when only crime is available', () => {
    const result = calculateEnvironmentScore(null, 80)
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThan(0)
    expect(result!.confidence).toBeLessThan(1.0)
  })

  it('noise null with crime available → score shown but lower confidence', () => {
    const result = calculateEnvironmentScore(null, 80)
    expect(result).not.toBeNull()
    expect(result!.isVisible).toBeUndefined() // not returned in this function
    expect(result!.confidence).toBe(0.6)
  })

  it('returns null when both are null', () => {
    expect(calculateEnvironmentScore(null, null)).toBeNull()
  })

  it('returns full confidence when both inputs are available', () => {
    const result = calculateEnvironmentScore(45, 80)
    expect(result!.confidence).toBe(1.0)
  })

  it('assigns Quiet label for noise below 50 dB', () => {
    const result = calculateEnvironmentScore(45, null)
    expect(result!.noiseLabel).toBe('Quiet')
  })

  it('assigns Moderate label for noise 50–65 dB', () => {
    const result = calculateEnvironmentScore(55, null)
    expect(result!.noiseLabel).toBe('Moderate')
  })

  it('assigns Loud label for noise above 65 dB', () => {
    const result = calculateEnvironmentScore(70, null)
    expect(result!.noiseLabel).toBe('Loud')
  })
})

// ---------------------------------------------------------------------------
// Overall Score
// ---------------------------------------------------------------------------

describe('calculateOverallScore', () => {
  it('is a weighted average of component scores', () => {
    const result = calculateOverallScore(80, 70, 60)
    // value: 0.4, investment: 0.35, environment: 0.25
    // 80*0.4 + 70*0.35 + 60*0.25 = 32 + 24.5 + 15 = 71.5
    expect(result.score).toBeCloseTo(71.5, 1)
  })

  it('uses custom weights when provided', () => {
    const result = calculateOverallScore(80, 70, 60, {
      value: 0.5,
      investment: 0.3,
      environment: 0.2,
    })
    // 80*0.5 + 70*0.3 + 60*0.2 = 40 + 21 + 12 = 73
    expect(result.score).toBeCloseTo(73, 1)
  })

  it('returns breakdown with all three component scores', () => {
    const result = calculateOverallScore(80, 70, 60)
    expect(result.breakdown.value).toBe(80)
    expect(result.breakdown.investment).toBe(70)
    expect(result.breakdown.environment).toBe(60)
  })

  it('caps score at 0–100', () => {
    const result = calculateOverallScore(100, 100, 100)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// Null / Missing Data Handling
// ---------------------------------------------------------------------------

describe('getScoreWithNullHandling', () => {
  it('converts null rawScore to displayScore=50, isVisible=false', () => {
    const result = getScoreWithNullHandling(null)
    expect(result.displayScore).toBe(50)
    expect(result.isVisible).toBe(false)
    expect(result.note).toBe('Insufficient data')
  })

  it('returns valid score when rawScore is provided', () => {
    const result = getScoreWithNullHandling(72)
    expect(result.displayScore).toBe(72)
    expect(result.isVisible).toBe(true)
    expect(result.note).toBe('')
  })

  it('hides score when dataCompleteness < MIN_DATA_COMPLETENESS', () => {
    const result = getScoreWithNullHandling(72, 1, 0.3)
    expect(result.displayScore).toBe(50)
    expect(result.isVisible).toBe(false)
    expect(result.note).toBe('Insufficient data')
  })

  it('shows score when dataCompleteness >= MIN_DATA_COMPLETENESS', () => {
    const result = getScoreWithNullHandling(72, 1, 0.6)
    expect(result.displayScore).toBe(72)
    expect(result.isVisible).toBe(true)
  })

  it('clamps negative scores to 0', () => {
    const result = getScoreWithNullHandling(-10)
    expect(result.displayScore).toBe(0)
  })

  it('clamps scores above 100 to 100', () => {
    const result = getScoreWithNullHandling(110)
    expect(result.displayScore).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// City Percentile Calibration
// ---------------------------------------------------------------------------

describe('calibrateCityPercentile', () => {
  it('returns empty array for empty input', () => {
    expect(calibrateCityPercentile([])).toEqual([])
  })

  it('does not modify properties with no scores', () => {
    const props: PropertySpec[] = [
      { id: 1, address_display: '123 Main St', score_overall: undefined },
      { id: 2, address_display: '456 Oak Ave', score_overall: undefined },
    ]
    calibrateCityPercentile(props)
    expect(props[0].score_overall).toBeUndefined()
    expect(props[1].score_overall).toBeUndefined()
  })

  it('assigns top score to the highest-rated property', () => {
    const props: PropertySpec[] = [
      { id: 1, address_display: 'Low', score_overall: 30 } as PropertySpec,
      { id: 2, address_display: 'Mid', score_overall: 60 } as PropertySpec,
      { id: 3, address_display: 'High', score_overall: 90 } as PropertySpec,
    ]
    calibrateCityPercentile(props)
    const high = props.find((p) => p.address_display === 'High')!
    expect(high.score_overall).toBe(100)
  })

  it('assigns 0 to the lowest-rated property', () => {
    const props: PropertySpec[] = [
      { id: 1, address_display: 'Low', score_overall: 10 } as PropertySpec,
      { id: 2, address_display: 'High', score_overall: 80 } as PropertySpec,
    ]
    calibrateCityPercentile(props)
    const low = props.find((p) => p.address_display === 'Low')!
    expect(low.score_overall).toBe(0)
  })

  it('does not crash with a single property', () => {
    const props: PropertySpec[] = [
      { id: 1, address_display: 'Only', score_overall: 75 } as PropertySpec,
    ]
    expect(() => calibrateCityPercentile(props)).not.toThrow()
  })
})
