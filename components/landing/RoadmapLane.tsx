/**
 * RoadmapLane — Kanban-style column. Lane header with status chip
 * + item count + caption, vertical accent stripe on the left, and
 * a stack of compact item cards. Used on the dedicated /roadmap
 * page.
 *
 * Accepts an `accent` color so each lane (Validating / Up next /
 * On the radar) can carry its own semantic hue. Cards themselves
 * sit on the app's bg-card token; hover state borrows the lane's
 * accent so the lanes feel cohesive without a hardcoded brand
 * accent on every card.
 */
export function RoadmapLane({
  label,
  count,
  accent,
  caption,
  items,
}: {
  label: string
  count: number
  accent: string
  caption: string
  items: { title: string; body: string }[]
}) {
  return (
    <div className="relative pl-5">
      <span
        aria-hidden
        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
        style={{ backgroundColor: accent }}
      />
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.18em] font-bold border"
            style={{ color: accent, borderColor: `${accent}55`, backgroundColor: `${accent}14` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
            {label}
          </span>
          <span className="text-[12px] font-semibold tracking-tight text-muted-foreground">
            {count} item{count !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-[12.5px] text-muted-foreground">{caption}</p>
      </div>
      <div className="space-y-3">
        {items.map(it => (
          <article
            key={it.title}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30 shadow-sm shadow-foreground/[0.03]"
            style={{ ['--lane-accent' as string]: accent }}
          >
            <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] mb-1.5 leading-[1.3] text-foreground">{it.title}</h3>
            <p className="text-[13px] text-muted-foreground leading-[1.55]">{it.body}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
