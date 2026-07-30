import { useRef, useState } from "react";
import { DAY_NAMES, fmtHour, weekDays } from "../dateUtils";

const HOURS_START = 7;
const HOURS_END = 23;
const TRACK_H = 820;

function laneEvents(dayEvents) {
  // simple overlap-lane assignment: events overlapping in time get split into 2 lanes
  return dayEvents.map((ev, i) => {
    const overlaps = dayEvents.some((other, j) => j !== i && other.start < ev.end && ev.start < other.end);
    const lane = overlaps && dayEvents.findIndex((o) => o === ev) % 2 === 1 ? 1 : 0;
    return { ...ev, lane, lanes: overlaps ? 2 : 1 };
  });
}

export default function WeekCanvas({ weekStart, events }) {
  const [tooltip, setTooltip] = useState(null);
  const tooltipRef = useRef(null);

  const days = weekDays(weekStart);
  const eventsByDay = Array.from({ length: 7 }, (_, i) => events.filter((e) => e.day === i));

  const ticks = [];
  for (let h = HOURS_START; h <= HOURS_END; h += 2) {
    ticks.push(h);
  }

  function topFor(hour) {
    return ((hour - HOURS_START) / (HOURS_END - HOURS_START)) * TRACK_H;
  }
  function heightFor(start, end) {
    return Math.max(((end - start) / (HOURS_END - HOURS_START)) * TRACK_H, 3);
  }

  return (
    <>
      <div className="canvas-wrap">
        <div className="hour-axis">
          {ticks.map((h) => (
            <div key={h} className="hour-tick" style={{ top: `${topFor(h)}px` }}>
              {String(h).padStart(2, "0")}
            </div>
          ))}
        </div>

        {eventsByDay.map((dayEvents, dayIdx) => {
          const laned = laneEvents(dayEvents);
          const moodColor = dayEvents[0]?.categoryColor || "var(--line)";
          return (
            <div className="day-col" key={dayIdx}>
              <div className="mood-strip" style={{ background: moodColor }} />
              <div className="track">
                {laned.map((ev, i) => {
                  const laneW = 100 / ev.lanes;
                  return (
                    <div
                      key={i}
                      className="block"
                      style={{
                        top: `${topFor(ev.start)}px`,
                        height: `${heightFor(ev.start, ev.end)}px`,
                        left: `${ev.lane * laneW}%`,
                        width: `${laneW - 3}%`,
                        background: ev.statusColor || ev.categoryColor,
                      }}
                      onMouseMove={(e) => {
                        setTooltip({
                          x: e.clientX + 14,
                          y: e.clientY + 14,
                          text: `${DAY_NAMES[dayIdx]} ${days[dayIdx].getDate()} · ${fmtHour(ev.start)}–${fmtHour(ev.end)} · ${ev.title}`,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="day-labels">
        <div />
        {days.map((d, i) => (
          <div className="day-label" key={i}>
            {DAY_NAMES[i]} {d.getDate()}
          </div>
        ))}
      </div>

      <div
        ref={tooltipRef}
        className={`tooltip${tooltip ? " show" : ""}`}
        style={tooltip ? { left: `${tooltip.x}px`, top: `${tooltip.y}px` } : undefined}
      >
        {tooltip?.text}
      </div>
    </>
  );
}
