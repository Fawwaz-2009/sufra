import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

// Custom SVG line chart — one Weight per dot, line connects in time order.
// Tap a dot to open a delete-confirmation popover (ADR 0007: weight_log rows
// are user-correctable via delete; profile_log is never touched here).
//
// No aggregation by period — a weigh-in IS the data point. Long periods just
// show more dots. If there are 0 or 1 points, we render an axis with the
// single dot (if any) and no connecting line.

type Point = { id: number; weightKg: number; loggedAt: string }

export function WeightChart({ weights }: { weights: Point[] }) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.api.weights[":id"].$delete({
        param: { id: String(id) },
      })
      if (!res.ok) throw new Error("delete_failed")
      return res.json()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["weights"] })
      setActiveId(null)
      toast.success("Deleted")
    },
    onError: () => toast.error("Couldn't delete. Try again."),
  })

  const dims = { width: 640, height: 180, padL: 32, padR: 12, padT: 12, padB: 24 }

  const sorted = useMemo(
    () => [...weights].sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1)),
    [weights]
  )

  if (sorted.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
        No weights logged in this period.
      </div>
    )
  }

  const ys = sorted.map((p) => p.weightKg)
  const xs = sorted.map((p) => Date.parse(p.loggedAt))

  // 1-kg padding so a flat series doesn't degenerate to a horizontal line at
  // the top/bottom of the chart.
  const yMin = Math.floor(Math.min(...ys) - 1)
  const yMax = Math.ceil(Math.max(...ys) + 1)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)

  const plotW = dims.width - dims.padL - dims.padR
  const plotH = dims.height - dims.padT - dims.padB

  const xFor = (x: number) =>
    xs.length === 1
      ? dims.padL + plotW / 2
      : dims.padL + ((x - xMin) / (xMax - xMin || 1)) * plotW
  const yFor = (y: number) =>
    dims.padT + (1 - (y - yMin) / (yMax - yMin || 1)) * plotH

  const path = sorted
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xFor(Date.parse(p.loggedAt)).toFixed(2)},${yFor(p.weightKg).toFixed(2)}`
    )
    .join(" ")

  // Y-axis: 3 ticks (min, mid, max).
  const yTicks = [yMin, Math.round((yMin + yMax) / 2), yMax]

  // X-axis: 3 evenly-spaced date labels.
  const xLabels = xLabelTicks(xs)

  const active = activeId === null ? null : sorted.find((p) => p.id === activeId)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        className="h-[180px] w-full"
      >
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
        {xLabels.map((t, i) => (
          <text
            key={`x-${i}`}
            x={xFor(t.x)}
            y={dims.height - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {t.label}
          </text>
        ))}
        {sorted.length > 1 && (
          <path
            d={path}
            fill="none"
            strokeWidth={2}
            className="stroke-foreground/50"
          />
        )}
        {sorted.map((p) => {
          const cx = xFor(Date.parse(p.loggedAt))
          const cy = yFor(p.weightKg)
          const isActive = p.id === activeId
          return (
            <g key={p.id}>
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? 6 : 4}
                className={cn(
                  "cursor-pointer transition-all",
                  isActive ? "fill-foreground" : "fill-foreground/70"
                )}
                onClick={() => setActiveId(p.id)}
              />
              <circle
                cx={cx}
                cy={cy}
                r={12}
                className="fill-transparent"
                onClick={() => setActiveId(p.id)}
              />
            </g>
          )
        })}
      </svg>

      {active && (
        <div
          role="dialog"
          className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-md bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10"
        >
          <span className="tabular-nums">
            {active.weightKg.toFixed(1)} kg · {shortDate(active.loggedAt)}
          </span>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(active.id)}
            disabled={deleteMutation.isPending}
            className="rounded-md bg-destructive px-2 py-1 text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            {deleteMutation.isPending ? "…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setActiveId(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function xLabelTicks(xs: number[]): { x: number; label: string }[] {
  if (xs.length === 0) return []
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  if (min === max) return [{ x: min, label: shortDate(new Date(min).toISOString()) }]
  const mid = (min + max) / 2
  return [min, mid, max].map((x) => ({
    x,
    label: shortDate(new Date(x).toISOString()),
  }))
}
