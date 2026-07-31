const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (res.status === 401) {
    return { unauthenticated: true };
  }
  if (!res.ok) {
    throw new Error(`${path} failed with ${res.status}`);
  }
  return res.json();
}

export const api = {
  loginUrl: `${API_URL}/auth/login`,
  me: () => apiGet("/auth/me"),
  logout: () => fetch(`${API_URL}/auth/logout`, { credentials: "include" }),
  events: (weekStart) => apiGet(`/api/events?weekStart=${weekStart}&tz=${encodeURIComponent(TZ)}`),
  weeksSummary: (end, count = 5) =>
    apiGet(`/api/weeks-summary?end=${end}&count=${count}&tz=${encodeURIComponent(TZ)}`),
};
