const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  events: (weekStart) => apiGet(`/api/events?weekStart=${weekStart}`),
  weeksSummary: (end, count = 13) => apiGet(`/api/weeks-summary?end=${end}&count=${count}`),
};
