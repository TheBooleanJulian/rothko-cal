import { MONTH_NAMES, addDays, weekDays, weekNumber } from "../dateUtils";

export default function ExportHeader({ weekStart }) {
  const days = weekDays(weekStart);
  const first = days[0];
  const last = days[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const monthLabel = sameMonth
    ? MONTH_NAMES[first.getMonth()]
    : `${MONTH_NAMES[first.getMonth()].slice(0, 3)} / ${MONTH_NAMES[last.getMonth()].slice(0, 3)}`;
  const rangeLabel = `${MONTH_NAMES[first.getMonth()].slice(0, 3)} ${first.getDate()} — ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getDate()}`;

  return (
    <div className="export-header">
      <div className="export-header-left">
        <div className="masthead-left">
          <div className="year">{first.getFullYear()}</div>
          <div className="month">{monthLabel}</div>
        </div>
        <div className="datefmt">{rangeLabel}</div>
      </div>
      <div className="weeknum">W{weekNumber(addDays(first, 3))}</div>
    </div>
  );
}
