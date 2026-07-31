import { useEffect, useRef, useState } from "react";
import "./styles/canvas.css";
import { api } from "./api";
import { addDays, startOfWeek, toISODate } from "./dateUtils";
import Login from "./components/Login";
import Masthead from "./components/Masthead";
import WeekCanvas from "./components/WeekCanvas";
import Legend from "./components/Legend";
import Shelf from "./components/Shelf";
import ExportBar from "./components/ExportBar";

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null });
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState(null);
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set());
  const weekExportRef = useRef(null);
  const shelfExportRef = useRef(null);

  const toggleCategory = (category) => {
    if (category === "Personal") return;
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const visibleEvents = events.filter(
    (ev) => ev.category === "Personal" || !hiddenCategories.has(ev.category)
  );

  useEffect(() => {
    api.me().then((data) => {
      if (data.unauthenticated || !data.authenticated) {
        setAuthState({ loading: false, authenticated: false, user: null });
      } else {
        setAuthState({ loading: false, authenticated: true, user: data });
      }
    });
  }, []);

  useEffect(() => {
    if (!authState.authenticated) return;
    let cancelled = false;
    setEventsError(null);
    api
      .events(toISODate(weekStart))
      .then((data) => {
        if (cancelled) return;
        if (data.unauthenticated) {
          setAuthState({ loading: false, authenticated: false, user: null });
        } else {
          setEvents(data.events);
        }
      })
      .catch((err) => !cancelled && setEventsError(err.message));
    return () => {
      cancelled = true;
    };
  }, [authState.authenticated, weekStart]);

  if (authState.loading) {
    return <div className="state-note">Loading…</div>;
  }

  if (!authState.authenticated) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <Masthead
        weekStart={weekStart}
        user={authState.user}
        onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
        onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
        onLogout={() => api.logout().then(() => setAuthState({ loading: false, authenticated: false, user: null }))}
      />

      {eventsError && <div className="state-note">Couldn't load events: {eventsError}</div>}

      <div ref={weekExportRef}>
        <WeekCanvas weekStart={weekStart} events={visibleEvents} />
        <Legend events={events} hiddenCategories={hiddenCategories} onToggle={toggleCategory} />
      </div>
      <ExportBar targetRef={weekExportRef} filenameBase={`rothko-cal-week-${toISODate(weekStart)}`} />

      <div ref={shelfExportRef}>
        <Shelf currentWeekStart={weekStart} />
      </div>
      <ExportBar targetRef={shelfExportRef} filenameBase={`rothko-cal-shelf-${toISODate(weekStart)}`} />
    </div>
  );
}
