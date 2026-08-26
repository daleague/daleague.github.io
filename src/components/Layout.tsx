import { NavLink, Outlet } from "react-router-dom";
import { useLeagueData } from "@/hooks/useLeagueData";

const NAV_ITEMS = [
  { to: "/", label: "This Week" },
  { to: "/standings", label: "Standings" },
  { to: "/teams", label: "Teams" },
  { to: "/power-rankings", label: "Power Rankings" },
  { to: "/records", label: "Record Book" },
];

export function Layout() {
  const { data, loading, error } = useLeagueData();

  return (
    <div className="min-h-screen bg-field-fade">
      <header className="sticky top-0 z-20 border-b border-hairline bg-base/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <NavLink to="/" className="font-display text-lg font-semibold tracking-wide text-ink">
            {data?.league.name.split(" ")[0]?.toUpperCase() ?? "THE"}{" "}
            <span className="text-gold">{data ? data.league.name.split(" ").slice(1).join(" ").toUpperCase() || "LEAGUE" : "LEAGUE"}</span>
          </NavLink>
          <nav className="hidden gap-6 sm:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `font-display text-sm tracking-wide transition ${isActive ? "text-gold" : "text-muted hover:text-ink"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <nav className="scroll-fade-x flex gap-5 overflow-x-auto border-t border-hairline/60 px-4 py-2.5 sm:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `shrink-0 font-display text-xs tracking-wide transition ${isActive ? "text-gold" : "text-muted"}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {data?.league.isMockData && (
        <div className="border-b border-gold/20 bg-gold/10 px-4 py-1.5 text-center font-mono text-[11px] tracking-wide text-gold sm:px-6">
          MOCK DATA — this league hasn't been connected to Yahoo yet
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="font-display text-sm tracking-wide text-muted">Loading the league…</p>
          </div>
        )}

        {!loading && error && (
          <div className="mx-auto max-w-md rounded-2xl border border-live/30 bg-live/10 p-6 text-center">
            <p className="font-display text-sm font-semibold tracking-wide text-live">Couldn't load league data</p>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </div>
        )}

        {!loading && !error && data && <Outlet context={data} />}
      </main>

      <footer className="border-t border-hairline px-4 py-8 text-center text-xs text-faint">
        Built for the league, by the league.
      </footer>
    </div>
  );
}
