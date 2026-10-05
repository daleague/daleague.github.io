import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

type LeagueContext = {
  league: {
    completedWeeks?: number[];
    currentWeek?: number;
  };
};

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="text-gold underline underline-offset-2">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

function Markdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: JSX.Element[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push(
        <p key={blocks.length} className="mt-4 leading-7 text-muted">
          {inline(paragraph.join(" "))}
        </p>,
      );
      paragraph = [];
    }
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="mt-4 list-disc space-y-2 pl-6 text-muted">
          {list.map((item, i) => <li key={i}>{inline(item)}</li>)}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((line, index) => {
    if (!line.trim()) {
      flush();
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      const className = level === 1
        ? "font-display text-3xl font-semibold tracking-wide text-ink"
        : level === 2
          ? "mt-10 border-b border-hairline pb-2 font-display text-xl font-semibold tracking-wide text-ink"
          : "mt-7 font-display text-lg font-semibold tracking-wide text-ink";
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      blocks.push(<Tag key={index} className={className}>{inline(heading[2])}</Tag>);
      return;
    }

    if (line.startsWith("> ")) {
      flush();
      blocks.push(
        <blockquote key={index} className="mt-5 border-l-2 border-gold/50 pl-4 font-display text-sm italic leading-6 text-ink/80">
          {inline(line.slice(2))}
        </blockquote>,
      );
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (paragraph.length) flush();
      list.push(bullet[1]);
      return;
    }

    if (/^---+$/.test(line.trim())) {
      flush();
      blocks.push(<hr key={index} className="my-8 border-hairline" />);
      return;
    }

    paragraph.push(line);
  });

  flush();
  return <div>{blocks}</div>;
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
