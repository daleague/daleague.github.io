import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type LeagueContext = {
  league: {
    completedWeeks?: number[];
    currentWeek?: number;
  };
};

const markdownComponents: import("react-markdown").Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-3xl font-semibold tracking-wide text-ink">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 border-b border-hairline pb-2 font-display text-xl font-semibold tracking-wide text-ink">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-7 font-display text-lg font-semibold tracking-wide text-ink">{children}</h3>
  ),
  p: ({ children }) => <p className="mt-4 leading-7 text-muted">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic text-ink/90">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-gold underline underline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-5 border-l-2 border-gold/50 pl-4 font-display text-sm italic leading-6 text-ink/80 [&>p]:mt-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-hairline" />,
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-hairline text-ink">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-hairline px-3 py-2 text-muted">{children}</td>,
  code: ({ children, className }) => (
    <code className={className ?? "rounded bg-base px-1.5 py-0.5 font-mono text-[0.9em] text-ink"}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-xl bg-base p-4 text-sm">{children}</pre>
  ),
};

function Markdown({ markdown }: { markdown: string }) {
  return (
    <div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function Newsletter() {
  const { league } = useOutletContext<LeagueContext>();
  const maxWeek = useMemo(
    () => Math.max(0, ...(league.completedWeeks ?? [])),
    [league.completedWeeks],
  );
  const weeks = useMemo(
    () => Array.from({ length: maxWeek }, (_, index) => index + 1),
    [maxWeek],
  );
  const [week, setWeek] = useState<number | null>(maxWeek || null);
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (maxWeek && (!week || week > maxWeek)) {
      setWeek(maxWeek);
    }
  }, [maxWeek, week]);

  useEffect(() => {
    if (!week) return;
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    setMarkdown("");

    fetch(`${import.meta.env.BASE_URL}newsletter/output/week-${week}.md`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Newsletter not found");
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setMarkdown(text);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [week]);

  return (
    <section>
      <div className="mb-8 border-b border-hairline pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">The League Press</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-wide text-ink">Weekly Newsletter</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The league's weekly recap and preview, written after Monday Night Football.
          </p>
        </div>

        {weeks.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-mono uppercase tracking-wide text-muted">Week</span>
            {weeks.map((value) => {
              const selected = value === week;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWeek(value)}
                  className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-mono transition-colors ${
                    selected
                      ? "border-gold bg-gold text-base"
                      : "border-hairline bg-base text-muted hover:border-gold/60 hover:text-ink"
                  }`}
                  aria-pressed={selected}
                  aria-label={`Load Week ${value} newsletter`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading && <p className="py-16 text-center font-display text-sm tracking-wide text-muted">Loading newsletter…</p>}

      {!loading && missing && (
        <div className="rounded-2xl border border-hairline bg-base/60 p-8 text-center">
          <p className="font-display text-lg text-ink">Week {week} has not been published yet.</p>
          <p className="mt-2 text-sm text-muted">Once the newsletter job generates it, it will appear here.</p>
        </div>
      )}

      {!loading && !missing && markdown && (
        <article className="mx-auto max-w-4xl rounded-2xl border border-hairline bg-base/70 px-5 py-7 sm:px-10 sm:py-10">
          <Markdown markdown={markdown} />
          <div className="mt-10 border-t border-hairline pt-5 text-xs text-faint">
            <Link to="/" className="text-gold hover:underline">Back to this week</Link>
          </div>
        </article>
      )}
    </section>
  );
}
