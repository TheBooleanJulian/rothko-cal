import { useEffect, useState } from "react";
import "./styles/canvas.css";
import { api } from "./api";
import { addDays, startOfWeek, toISODate } from "./dateUtils";
import Login from "./components/Login";
import Masthead from "./components/Masthead";
import WeekCanvas from "./components/WeekCanvas";
import Legend from "./components/Legend";
import Shelf from "./components/Shelf";

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null });
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState(null);

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

      <WeekCanvas weekStart={weekStart} events={events} />
      <Legend events={events} />
      <Shelf currentWeekStart={weekStart} />
    </div>
  );
}
