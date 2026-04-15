/**
 * Unit tests for ScoreDisplay component.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScoreDisplay from './ScoreDisplay'

// ---------------------------------------------------------------------------
// Score rendering
// ---------------------------------------------------------------------------

describe('ScoreDisplay — score rendering', () => {
  it('displays score normalized to 0-10 scale', () => {
    render(<ScoreDisplay score={75} label="Value" />)
    expect(screen.getByText('7.5')).toBeTruthy()
  })

  it('displays 0 for score 0', () => {
    render(<ScoreDisplay score={0} label="Value" />)
    expect(screen.getByText('0.0')).toBeTruthy()
  })

  it('displays 10 for score 100', () => {
    render(<ScoreDisplay score={100} label="Value" />)
    expect(screen.getByText('10.0')).toBeTruthy()
  })

  it('renders label text', () => {
    render(<ScoreDisplay score={65} label="Investment" />)
    expect(screen.getByText('Investment')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Confidence interval
// ---------------------------------------------------------------------------

describe('ScoreDisplay — confidence interval', () => {
  it('renders confidence as ± value when provided', () => {
    render(<ScoreDisplay score={72} label="Value" confidence={8} />)
    expect(screen.getByText('±8')).toBeTruthy()
  })

  it('does not render ± when confidence is undefined', () => {
    render(<ScoreDisplay score={72} label="Value" />)
    expect(screen.queryByText(/±/)).toBeNull()
  })

  it('renders confidence with decimal', () => {
    render(<ScoreDisplay score={72} label="Value" confidence={4.5} />)
    expect(screen.getByText('±4.5')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Expandable breakdown panel
// ---------------------------------------------------------------------------

describe('ScoreDisplay — expandable breakdown', () => {
  it('does not render breakdown toggle when no breakdown provided', () => {
    render(<ScoreDisplay score={72} label="Value" />)
    expect(screen.queryByText('Why this score?')).toBeNull()
  })

  it('renders breakdown toggle when breakdown is provided', () => {
    const breakdown = [{ label: 'AVM Discount', value: '+12 pts' }]
    render(<ScoreDisplay score={72} label="Value" breakdown={breakdown} />)
    expect(screen.getByText('Why this score?')).toBeTruthy()
  })

  it('hides breakdown content initially', () => {
    const breakdown = [{ label: 'AVM Discount', value: '+12 pts' }]
    render(<ScoreDisplay score={72} label="Value" breakdown={breakdown} />)
    // "Why this score?" should be visible; breakdown items should not
    expect(screen.getByText('Why this score?')).toBeTruthy()
    expect(screen.queryByText('AVM Discount')).toBeNull()
  })

  it('shows breakdown after click', () => {
    const breakdown = [{ label: 'AVM Discount', value: '+12 pts' }]
    render(<ScoreDisplay score={72} label="Value" breakdown={breakdown} />)
    fireEvent.click(screen.getByText('Why this score?'))
    expect(screen.getByText('AVM Discount')).toBeTruthy()
    expect(screen.getByText('+12 pts')).toBeTruthy()
  })

  it('toggles breakdown closed on second click', () => {
    const breakdown = [{ label: 'AVM Discount', value: '+12 pts' }]
    render(<ScoreDisplay score={72} label="Value" breakdown={breakdown} />)
    fireEvent.click(screen.getByText('Why this score?'))
    expect(screen.getByText('AVM Discount')).toBeTruthy()
    fireEvent.click(screen.getByText('Hide'))
    expect(screen.queryByText('AVM Discount')).toBeNull()
  })

  it('renders multiple breakdown items', () => {
    const breakdown = [
      { label: 'AVM Discount', value: '+12 pts' },
      { label: 'Days on Market', value: '+3 pts' },
      { label: 'Price Cuts', value: '+2 pts' },
    ]
    render(<ScoreDisplay score={72} label="Value" breakdown={breakdown} />)
    fireEvent.click(screen.getByText('Why this score?'))
    expect(screen.getByText('AVM Discount')).toBeTruthy()
    expect(screen.getByText('Days on Market')).toBeTruthy()
    expect(screen.getByText('Price Cuts')).toBeTruthy()
  })

  it('shows score-based color for individual breakdown items when score is provided', () => {
    const breakdown = [
      { label: 'AVM Discount', value: 'High', score: 85 },
      { label: 'Crime Rate', value: 'Low', score: 30 },
    ]
    render(<ScoreDisplay score={65} label="Environment" breakdown={breakdown} />)
    fireEvent.click(screen.getByText('Why this score?'))
    // Both items should render without crashing
    expect(screen.getByText('AVM Discount')).toBeTruthy()
    expect(screen.getByText('Low')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Size variants
// ---------------------------------------------------------------------------

describe('ScoreDisplay — size variants', () => {
  it('renders sm size', () => {
    const { container } = render(<ScoreDisplay score={70} label="Value" size="sm" />)
    // sm = 48px circle
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('48')
  })

  it('renders md size', () => {
    const { container } = render(<ScoreDisplay score={70} label="Value" size="md" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('72')
  })

  it('renders lg size', () => {
    const { container } = render(<ScoreDisplay score={70} label="Value" size="lg" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('96')
  })
})

// ---------------------------------------------------------------------------
// Color coding
// ---------------------------------------------------------------------------

describe('ScoreDisplay — color coding', () => {
  it('renders without crashing for green score ≥70', () => {
    const { container } = render(<ScoreDisplay score={80} label="Value" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders without crashing for yellow score 50-69', () => {
    const { container } = render(<ScoreDisplay score={55} label="Value" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders without crashing for red score <50', () => {
    const { container } = render(<ScoreDisplay score={35} label="Value" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// showLabel prop
// ---------------------------------------------------------------------------

describe('ScoreDisplay — showLabel', () => {
  it('hides label when showLabel=false', () => {
    render(<ScoreDisplay score={72} label="Value" showLabel={false} />)
    expect(screen.queryByText('Value')).toBeNull()
  })

  it('shows label when showLabel=true (default)', () => {
    render(<ScoreDisplay score={72} label="Value" showLabel={true} />)
    expect(screen.getByText('Value')).toBeTruthy()
  })
})