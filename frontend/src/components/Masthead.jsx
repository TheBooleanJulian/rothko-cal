import { MONTH_NAMES, addDays, weekDays, weekNumber } from "../dateUtils";

export default function Masthead({ weekStart, onPrevWeek, onNextWeek, user, onLogout }) {
  const days = weekDays(weekStart);
  const first = days[0];
  const last = days[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const monthLabel = sameMonth
    ? MONTH_NAMES[first.getMonth()]
    : `${MONTH_NAMES[first.getMonth()].slice(0, 3)} / ${MONTH_NAMES[last.getMonth()].slice(0, 3)}`;
  const rangeLabel = `${MONTH_NAMES[first.getMonth()].slice(0, 3)} ${first.getDate()} — ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getDate()}`;

  return (
    <>
      <div className="masthead">
        <div className="masthead-left">
          <div className="year">{first.getFullYear()}</div>
          <div className="month">{monthLabel}</div>
        </div>
        <div className="masthead-right">
          <div className="week-nav">
            <button onClick={onPrevWeek} aria-label="Previous week">&larr;</button>
            <button onClick={onNextWeek} aria-label="Next week">&rarr;</button>
          </div>
          <div className="weeknum">W{weekNumber(addDays(first, 3))}</div>
        </div>
      </div>
      <div className="datefmt" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{rangeLabel}</span>
        {user && (
          <button className="logout-link" onClick={onLogout}>
            {user.email} · sign out
          </button>
        )}
      </div>
    </>
  );
}
