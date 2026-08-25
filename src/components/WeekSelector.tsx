import { Link } from "react-router-dom";

interface WeekSelectorProps {
  weeks: number[];
  currentWeek: number;
  selectedWeek: number;
}

export function WeekSelector({ weeks, currentWeek, selectedWeek }: WeekSelectorProps) {
  return (
    <div className="scroll-fade-x flex gap-2 overflow-x-auto pb-1">
      {weeks.map((week) => {
        const isSelected = week === selectedWeek;
        const isCurrent = week === currentWeek;
        return (
          <Link
            key={week}
            to={`/week/${week}`}
            className={`shrink-0 rounded-full border px-4 py-1.5 font-display text-sm tracking-wide transition ${
              isSelected
                ? "border-gold bg-gold/15 text-gold"
                : "border-hairline bg-card text-muted hover:border-faint hover:text-ink"
            }`}
          >
            WEEK {week}
            {isCurrent && <span className="ml-1.5 text-[10px] text-live">●</span>}
          </Link>
        );
      })}
    </div>
  );
}
