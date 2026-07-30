import { useEffect, useState } from "react";
import { api } from "../api";
import { toISODate, weekNumber, addDays } from "../dateUtils";

const DAY_HOURS = 24;
const LANES = 3;

export default function Shelf({ currentWeekStart }) {
  const [weeks, setWeeks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .weeksSummary(toISODate(currentWeekStart), 13)
      .then((data) => {
        if (cancelled) return;
        if (data.unauthenticated) {
          setError("unauthenticated");
        } else {
          setWeeks(data.weeks);
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [currentWeekStart]);

  if (error) return null;
  if (!weeks) return null;

  return (
    <>
      <div className="shelf-heading">
        <h2>The shelf</h2>
        <span>{weeks.length} pages / quarter</span>
      </div>
      <div className="shelf">
        {weeks.map((week, i) => {
          const isCurrent = week.weekStart === toISODate(currentWeekStart);
          return (
            <div className="page-item" key={week.weekStart}>
              <div className={`page${isCurrent ? " current" : ""}`}>
                {week.blocks.map((b, bi) => (
                  <div
                    key={bi}
                    className="p-block"
                    style={{
                      top: `${(b.start / DAY_HOURS) * 100}%`,
                      height: `${Math.max(((b.end - b.start) / DAY_HOURS) * 100, 2)}%`,
                      left: `${(bi % LANES) * (100 / LANES)}%`,
                      width: `${100 / LANES - 3}%`,
                      background: b.color,
                    }}
                  />
                ))}
              </div>
              <div className="page-num">W{weekNumber(addDays(new Date(week.weekStart), 3))}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
