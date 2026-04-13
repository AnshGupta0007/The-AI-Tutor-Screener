'use client'

import { useState } from 'react'

export interface RadarDimension {
  key: string
  label: string
  shortLabel: string
  score: number   // 1–5
  weight: string
  color: string   // used for the tooltip chip
}

interface Props {
  dimensions: RadarDimension[]
  compositeScore: number
}

const CX = 140
const CY = 148
const R  = 96   // outer pentagon radius
const N  = 5
const LABEL_R = R + 26  // label distance from center

// Angle for each vertex: start at top (−π/2), go clockwise
function angle(i: number) {
  return -Math.PI / 2 + i * (2 * Math.PI / N)
}

// Convert polar → SVG xy
function polar(r: number, a: number) {
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

// Build SVG polygon points string from an array of {x,y}
function pts(points: { x: number; y: number }[]) {
  return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

// Score → color (same palette as bars)
function scoreColor(s: number) {
  if (s >= 4) return '#16A34A'
  if (s >= 3) return '#F59E0B'
  return '#DC2626'
}

const GRID_LEVELS = [1, 2, 3, 4, 5]

export default function RadarChart({ dimensions, compositeScore }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Outer pentagon vertices (for grid reference)
  const outerVerts = Array.from({ length: N }, (_, i) => polar(R, angle(i)))

  // Grid pentagons (one per score level)
  const gridPolygons = GRID_LEVELS.map(level =>
    Array.from({ length: N }, (_, i) => polar((R * level) / 5, angle(i)))
  )

  // Data polygon vertices — clamp score to [0, 5]
  const dataVerts = dimensions.map((d, i) => {
    const r = (Math.max(0, Math.min(5, d.score)) / 5) * R
    return polar(r, angle(i))
  })

  // Label positions
  const labelVerts = Array.from({ length: N }, (_, i) => {
    const a = angle(i)
    const raw = polar(LABEL_R, a)
    // Fine-tune each label anchor and offset
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const anchor: 'end' | 'start' | 'middle' = cos < -0.1 ? 'end' : cos > 0.1 ? 'start' : 'middle'
    // Small extra nudge for bottom labels so they don't crowd the pentagon
    const yExtra = sin > 0.5 ? 8 : sin < -0.5 ? -4 : 0
    return { x: raw.x, y: raw.y + yExtra, anchor }
  })

  return (
    <div className="relative">
      <svg
        viewBox="0 0 280 290"
        width="100%"
        style={{ maxWidth: 300, display: 'block', margin: '0 auto' }}
        aria-label="Radar chart of evaluation dimensions"
      >
        <defs>
          {/* Gradient fill for data polygon */}
          <linearGradient id="radar-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4338CA" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.10" />
          </linearGradient>
          {/* Drop shadow for data polygon */}
          <filter id="radar-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#4338CA" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* ── Background grid ─────────────────────────── */}
        {gridPolygons.map((verts, li) => (
          <polygon
            key={li}
            points={pts(verts)}
            fill="none"
            stroke={li === 4 ? '#C7D2FE' : '#E5E7EB'}
            strokeWidth={li === 4 ? 1.5 : 1}
            strokeDasharray={li < 4 ? '3 3' : undefined}
          />
        ))}

        {/* ── Axis lines ──────────────────────────────── */}
        {outerVerts.map((v, i) => (
          <line
            key={i}
            x1={CX} y1={CY} x2={v.x} y2={v.y}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        ))}

        {/* ── Score level numbers (1–5) on the top axis ─ */}
        {GRID_LEVELS.map(level => {
          const p = polar((R * level) / 5, angle(0))
          return (
            <text
              key={level}
              x={p.x - 5}
              y={p.y + 1}
              fontSize={8}
              fill="#9CA3AF"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ userSelect: 'none' }}
            >
              {level}
            </text>
          )
        })}

        {/* ── Data polygon ────────────────────────────── */}
        <polygon
          points={pts(dataVerts)}
          fill="url(#radar-fill)"
          stroke="#4338CA"
          strokeWidth={2}
          strokeLinejoin="round"
          filter="url(#radar-shadow)"
          style={{ transition: 'all 0.4s ease' }}
        />

        {/* ── Data dots + hover ───────────────────────── */}
        {dataVerts.map((v, i) => {
          const dim = dimensions[i]
          const sc = dim.score
          const c = scoreColor(sc)
          const isHov = hovered === i
          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              {/* Hit area */}
              <circle cx={v.x} cy={v.y} r={14} fill="transparent" />
              {/* Outer glow ring on hover */}
              {isHov && (
                <circle cx={v.x} cy={v.y} r={9} fill={c} opacity={0.15} />
              )}
              {/* Dot */}
              <circle
                cx={v.x} cy={v.y}
                r={isHov ? 6 : 4.5}
                fill={c}
                stroke="white"
                strokeWidth={isHov ? 2 : 1.5}
                style={{ transition: 'r 0.15s ease' }}
              />
            </g>
          )
        })}

        {/* ── Labels ──────────────────────────────────── */}
        {labelVerts.map((lv, i) => {
          const dim = dimensions[i]
          const sc = dim.score
          const isHov = hovered === i
          const c = scoreColor(sc)
          return (
            <g key={i}>
              <text
                x={lv.x}
                y={lv.y - 1}
                textAnchor={lv.anchor}
                fontSize={10.5}
                fontWeight={isHov ? '700' : '600'}
                fill={isHov ? c : '#374151'}
                style={{ transition: 'fill 0.15s', userSelect: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {dim.shortLabel}
              </text>
              {/* Score beneath label */}
              <text
                x={lv.x}
                y={lv.y + 11}
                textAnchor={lv.anchor}
                fontSize={9}
                fontWeight="600"
                fill={c}
                style={{ userSelect: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {sc.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* ── Center composite score ───────────────────── */}
        <circle cx={CX} cy={CY} r={22} fill="white" stroke="#E5E7EB" strokeWidth={1.5} />
        <text x={CX} y={CY - 2} textAnchor="middle" fontSize={14} fontWeight="700" fill="#0F0E17" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {compositeScore.toFixed(1)}
        </text>
        <text x={CX} y={CY + 11} textAnchor="middle" fontSize={8} fill="#6B7280" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          /5.0
        </text>
      </svg>

      {/* Hover tooltip */}
      {hovered !== null && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl text-xs font-medium shadow-lg pointer-events-none animate-fade-in"
          style={{
            bottom: 8,
            backgroundColor: 'var(--text-primary)',
            color: 'white',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: scoreColor(dimensions[hovered].score) }}>
            {dimensions[hovered].score.toFixed(1)}
          </span>
          {' · '}
          {dimensions[hovered].label}
          <span style={{ color: '#9CA3AF', marginLeft: 4 }}>({dimensions[hovered].weight})</span>
        </div>
      )}
    </div>
  )
}
