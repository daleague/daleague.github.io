export function PowerRankings() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">COMING IN PHASE 2</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Power Rankings</h1>
      </div>
      <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-8 text-center">
        <p className="mx-auto max-w-md text-sm text-muted">
          Power ratings need at least a couple of weeks of results to blend record, points, recent form, and
          strength of schedule into something meaningful. This page lights up once that calculation layer and
          multi-week history are wired in.
        </p>
      </div>
    </div>
  );
}
