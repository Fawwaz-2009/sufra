import { useMemo } from "react"

import { cn } from "@/lib/utils"
import type { CaloriePeriod } from "../-search"

// Custom SVG bar chart. Each bar = one bucket (day for 7D/30D, week-avg for
// 90D, month-avg for 1Y). Color comes from the server (computed against the
// historical per-day Target via snapshotFor).

type Bucket = {
  bucketStart: string
  kcalAvg: number
  targetAvg: number
  color: "ok" | "warn" | "over" | null
  daysWithData: number
}

export function CaloriesChart({
  buckets,
  period,
}: {
  buckets: ReadonlyArray<Bucket>
  period: CaloriePeriod
}) {
  const dims = { width: 640, height: 200, padL: 36, padR: 12, padT: 12, padB: 28 }

  const ys = buckets.map((b) => b.kcalAvg)
  const targets = buckets.map((b) => b.targetAvg).filter((t) => t > 0)
  const baseMax = Math.max(...ys, ...targets, 0)
  // Round up to the nearest 600 so y-ticks are clean (matches the mockup's
  // 600 / 1200 / 1800 / 2400 ladder).
  const yMax = Math.max(600, Math.ceil(baseMax / 600) * 600)

  const yTicks = useMemo(() => {
    const step = yMax / 4
    return [0, step, step * 2, step * 3, step * 4]
  }, [yMax])

  const plotW = dims.width - dims.padL - dims.padR
  const plotH = dims.height - dims.padT - dims.padB

  if (buckets.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
        No meals logged in this period.
      </div>
    )
  }

  const slot = plotW / buckets.length
  const barW = Math.min(slot * 0.7, 32)
  const barOffset = (slot - barW) / 2

  return (
    <svg viewBox={`0 0 ${dims.width} ${dims.height}`} className="h-[200px] w-full">
      {yTicks.map((t, i) => (
        <g key={`y-${i}`}>
          <line
            x1={dims.padL}
            x2={dims.width - dims.padR}
            y1={yFor(t)}
            y2={yFor(t)}
            className="stroke-foreground/10"
            strokeDasharray="2,3"
          />
          <text
            x={0}
            y={yFor(t) + 4}
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {t}
          </text>
        </g>
      ))}

      {buckets.map((b, i) => {
        const x = dims.padL + slot * i + barOffset
        const h = b.kcalAvg > 0 ? (b.kcalAvg / yMax) * plotH : 0
        const y = dims.padT + (plotH - h)
        const colorClass =
          b.color === "ok"
            ? "fill-primary/80"
            : b.color === "warn"
              ? "fill-amber-500/80"
              : b.color === "over"
                ? "fill-destructive/80"
                : "fill-foreground/10"
        return (
          <g key={b.bucketStart}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              className={cn("transition-all", colorClass)}
            />
            {/* X-axis label — render only every Nth bar for dense periods */}
            {shouldLabel(period, i, buckets.length) && (
              <text
                x={x + barW / 2}
                y={dims.height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {formatBucketLabel(b.bucketStart, period)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )

  function yFor(t: number) {
    return dims.padT + (1 - t / yMax) * plotH
  }
}

function shouldLabel(period: CaloriePeriod, i: number, n: number): boolean {
  if (period === "7D") return true
  if (period === "30D") return i % 5 === 0 || i === n - 1
  if (period === "90D") return i % 2 === 0 || i === n - 1
  return true // 1Y: 12 month buckets, label them all
}

function formatBucketLabel(bucketStart: string, period: CaloriePeriod): string {
  const p = bucketStart.split("-")
  const date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  if (period === "7D") {
    return date.toLocaleDateString(undefined, { weekday: "short" })
  }
  if (period === "1Y") {
    return date.toLocaleDateString(undefined, { month: "short" })
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
