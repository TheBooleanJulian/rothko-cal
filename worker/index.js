// Rothko Cal on Cloudflare Workers: port of the FastAPI backend (backend/app) plus the Vite frontend as static assets.
//
// One Worker answers on both hostnames, so nothing changes for Google or the browser:
//   rothko-cal.thebooleanjulian.dev           the frontend (frontend/dist)
//   rothko-cal-backend.thebooleanjulian.dev   /auth/* and /api/* (the OAuth redirect URI registered with Google)
//
//   GET /auth/login | /auth/callback | /auth/logout | /auth/me
//   GET /api/calendars | /api/colors | /api/events?weekStart&tz | /api/weeks-summary?end&count&tz
//   GET /healthz
//
// Session: the same cookie the backend used ("session", 14 days, HttpOnly, SameSite=None + Secure on https), holding
// the Google access/refresh token and the user's name/email. Starlette only signed it; here it is AES-GCM encrypted
// with a key derived from SESSION_SECRET, so the tokens are not readable from the cookie.
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET. Vars: GOOGLE_REDIRECT_URI, FRONTEND_ORIGIN.
import categoryConfigFile from '../backend/category_config.json' with { type: 'json' };
import { buildWeekEvents, bucketEventsIntoWeeks, realCategoryConfig, addDays, zonedMidnight } from './normalize.js';

const COOKIE = 'session';
const MAX_AGE = 14 * 24 * 3600;
const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar.readonly'];
const CAL = 'https://www.googleapis.com/calendar/v3';

class HttpError extends Error {
  constructor(status, detail) { super(detail); this.status = status; }
}

// ── session cookie ───────────────────────────────────────────────────────────────────────────────────────────
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function sessionKey(env) {
  if (!env.SESSION_SECRET) throw new HttpError(500, 'SESSION_SECRET is not set');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.SESSION_SECRET));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function readSession(request, env) {
  const raw = (request.headers.get('Cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return {};
  try {
    const bytes = unb64url(raw.slice(COOKIE.length + 1));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await sessionKey(env), bytes.slice(12));
    const data = JSON.parse(new TextDecoder().decode(plain));
    return data.exp > Date.now() ? data.s : {};
  } catch {
    return {}; // tampered, old Starlette cookie, or rotated secret: treat as logged out
  }
}

export async function sessionCookie(env, session) {
  const https = String(env.GOOGLE_REDIRECT_URI || '').startsWith('https://');
  const attrs = `Path=/; Max-Age=${MAX_AGE}; HttpOnly; ${https ? 'SameSite=None; Secure' : 'SameSite=Lax'}`;
  if (!session || !Object.keys(session).length) return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; ${https ? 'SameSite=None; Secure' : 'SameSite=Lax'}`;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify({ s: session, exp: Date.now() + MAX_AGE * 1000 }));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sessionKey(env), plain));
  const out = new Uint8Array(12 + sealed.length);
  out.set(iv); out.set(sealed, 12);
  return `${COOKIE}=${b64url(out)}; ${attrs}`;
}

// ── responses ────────────────────────────────────────────────────────────────────────────────────────────────
function cors(request, env, headers) {
  const origin = request.headers.get('Origin');
  if (origin && origin === env.FRONTEND_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  headers.append('Vary', 'Origin');
  return headers;
}

function json(request, env, body, status = 200, cookie) {
  const headers = cors(request, env, new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }));
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location, cookie) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

// ── Google OAuth ─────────────────────────────────────────────────────────────────────────────────────────────
async function tokenRequest(env, params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new HttpError(401, `token endpoint ${res.status} ${data.error || ''}`.trim());
  return data;
}

async function login(request, env, session) {
  const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
    nonce,
    access_type: 'offline',
    prompt: 'consent'
  });
  return redirect(url.toString(), await sessionCookie(env, { ...session, oauth_state: state }));
}

async function callback(request, env, session) {
  const params = new URL(request.url).searchParams;
  const failed = `${env.FRONTEND_ORIGIN}?auth_error=1`;
  if (params.get('error') || !params.get('code') || !session.oauth_state || params.get('state') !== session.oauth_state) {
    return redirect(failed);
  }
  try {
    const token = await tokenRequest(env, { grant_type: 'authorization_code', code: params.get('code'), redirect_uri: env.GOOGLE_REDIRECT_URI });
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } })
      .then((r) => (r.ok ? r.json() : {}));
    const next = {
      token: { access_token: token.access_token, refresh_token: token.refresh_token || null, expires_at: Date.now() + (token.expires_in || 3600) * 1000 },
      user: { email: info.email || null, name: info.name || null }
    };
    return redirect(env.FRONTEND_ORIGIN, await sessionCookie(env, next));
  } catch {
    return redirect(failed);
  }
}

// The session's access token, refreshed when within a minute of expiry. Returns [token, updatedSession | null].
async function accessToken(env, session) {
  const token = session.token;
  if (!token || !token.access_token) throw new HttpError(401, 'Not authenticated');
  if (token.expires_at && Date.now() > token.expires_at - 60000 && token.refresh_token) {
    const fresh = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: token.refresh_token });
    const next = { ...session, token: { ...token, access_token: fresh.access_token, expires_at: Date.now() + (fresh.expires_in || 3600) * 1000 } };
    return [fresh.access_token, next];
  }
  return [token.access_token, null];
}

// ── Google Calendar ──────────────────────────────────────────────────────────────────────────────────────────
async function gcal(token, path, query = {}) {
  const url = new URL(CAL + path);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new HttpError(401, 'Not authenticated');
  if (!res.ok) throw new HttpError(502, `Google Calendar ${res.status}`);
  return res.json();
}

async function paged(token, path, query) {
  const items = [];
  let pageToken;
  do {
    const resp = await gcal(token, path, { ...query, pageToken });
    items.push(...(resp.items || []));
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return items;
}

const listCalendars = (token) => paged(token, '/users/me/calendarList', {});
const getColors = (token) => gcal(token, '/colors');

async function eventsForCalendars(token, calendarIds, timeMin, timeMax) {
  const lists = await Promise.all(calendarIds.map((id) =>
    paged(token, `/calendars/${encodeURIComponent(id)}/events`, { timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' })));
  return Object.fromEntries(calendarIds.map((id, i) => [id, lists[i]]));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function validTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

async function api(path, params, token) {
  if (path === '/api/calendars') return listCalendars(token);
  if (path === '/api/colors') return getColors(token);

  const tz = params.get('tz') || 'UTC';
  if (!validTz(tz)) throw new HttpError(422, 'invalid tz');
  const categoryConfig = realCategoryConfig(categoryConfigFile);

  if (path === '/api/events') {
    const weekStart = params.get('weekStart');
    if (!ISO_DATE.test(weekStart || '')) throw new HttpError(422, 'weekStart must be YYYY-MM-DD');
    const [calendars, colors] = await Promise.all([listCalendars(token), getColors(token)]);
    const byCal = await eventsForCalendars(token, calendars.map((c) => c.id), zonedMidnight(weekStart, tz), zonedMidnight(addDays(weekStart, 7), tz));
    return { weekStart, events: buildWeekEvents(byCal, calendars, categoryConfig, colors, weekStart) };
  }

  if (path === '/api/weeks-summary') {
    const end = params.get('end');
    const count = Number(params.get('count') || 5);
    if (!ISO_DATE.test(end || '')) throw new HttpError(422, 'end must be YYYY-MM-DD');
    if (!Number.isInteger(count) || count < 1 || count > 52) throw new HttpError(422, 'count must be 1-52');
    const rangeStart = addDays(end, -7 * (count - 1));
    const [calendars, colors] = await Promise.all([listCalendars(token), getColors(token)]);
    const byCal = await eventsForCalendars(token, calendars.map((c) => c.id), zonedMidnight(rangeStart, tz), zonedMidnight(addDays(end, 7), tz));
    return { weeks: bucketEventsIntoWeeks(byCal, calendars, colors, rangeStart, count) };
  }
  throw new HttpError(404, 'Not Found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/healthz') {
      const configured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET);
      return json(request, env, { status: configured ? 'pass' : 'warn', secrets: configured ? 'set' : 'missing' });
    }
    if (!path.startsWith('/auth/') && !path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') {
      const headers = cors(request, env, new Headers({ 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*', 'Access-Control-Max-Age': '600' }));
      return new Response(null, { status: 200, headers });
    }
    if (request.method !== 'GET') return json(request, env, { detail: 'Method Not Allowed' }, 405);

    try {
      const session = await readSession(request, env);
      if (path === '/auth/login') return await login(request, env, session);
      if (path === '/auth/callback') return await callback(request, env, session);
      if (path === '/auth/logout') return json(request, env, { ok: true }, 200, await sessionCookie(env, {}));
      if (path === '/auth/me') {
        return json(request, env, session.user ? { authenticated: true, ...session.user } : { authenticated: false });
      }
      if (path.startsWith('/api/')) {
        const [token, updated] = await accessToken(env, session);
        const body = await api(path, url.searchParams, token);
        return json(request, env, body, 200, updated ? await sessionCookie(env, updated) : undefined);
      }
      return json(request, env, { detail: 'Not Found' }, 404);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.log(JSON.stringify({ svc: 'rothko-cal', path, error: String(err && err.message) }));
      return json(request, env, { detail: status === 500 ? 'Internal Server Error' : err.message }, status);
    }
  }
};
