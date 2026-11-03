// node --test worker/test   normalize.js (ported from backend/tests/test_normalize.py) and the Worker's routes.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildWeekEvents, bucketEventsIntoWeeks, dayIndex, decimalHour, parseEventDateTime, realCategoryConfig, zonedMidnight } from '../normalize.js';

const CALENDAR_LIST = [
  { id: 'cal-market', summary: 'Event/Market', colorId: '7', backgroundColor: '#2f6f6b' },
  { id: 'cal-tut', summary: 'Tutoring', colorId: '6' }
];
const COLORS = {
  calendar: { 7: { background: '#0b8043' }, 6: { background: '#f4511e' } },
  event: { 11: { background: '#dc2127' } }
};
const CATEGORY_CONFIG = realCategoryConfig({ 'cal-market': { label: 'market', order: 0 }, 'cal-tut': { label: 'tut', order: 1 }, _comment: 'ignored' });
const WEEK_START = '2026-07-19'; // Sunday

test('realCategoryConfig strips underscore keys', () => {
  assert.deepEqual(Object.keys(CATEGORY_CONFIG).sort(), ['cal-market', 'cal-tut']);
});

test('decimalHour and dayIndex', () => {
  assert.equal(decimalHour(parseEventDateTime({ dateTime: '2026-07-20T14:30:00+08:00' })), 14.5);
  assert.equal(dayIndex('2026-07-19', WEEK_START), 0);
  assert.equal(dayIndex('2026-07-25', WEEK_START), 6);
});

test('buildWeekEvents maps category and status color', () => {
  const events = buildWeekEvents({
    'cal-market': [{ summary: 'Farmers market', start: { dateTime: '2026-07-19T11:00:00+08:00' }, end: { dateTime: '2026-07-19T19:00:00+08:00' }, colorId: '11' }],
    'cal-tut': [{ summary: 'Tuition session', start: { dateTime: '2026-07-20T14:30:00+08:00' }, end: { dateTime: '2026-07-20T16:00:00+08:00' } }]
  }, CALENDAR_LIST, CATEGORY_CONFIG, COLORS, WEEK_START);
  assert.equal(events.length, 2);
  const market = events.find((e) => e.category === 'market');
  assert.equal(market.day, 0);
  assert.equal(market.start, 11);
  assert.equal(market.end, 19);
  assert.equal(market.categoryColor, '#2f6f6b'); // calendar's own backgroundColor wins over the colorId lookup
  assert.equal(market.statusColor, '#dc2127');
  const tut = events.find((e) => e.category === 'tut');
  assert.equal(tut.day, 1);
  assert.equal(tut.start, 14.5);
  assert.equal(tut.categoryColor, '#f4511e');
  assert.equal(tut.statusColor, null);
});

test('buildWeekEvents skips all-day events and falls back for unconfigured calendars', () => {
  const events = buildWeekEvents({
    'cal-market': [{ summary: 'All day thing', start: { date: '2026-07-19' }, end: { date: '2026-07-20' } }],
    'cal-unknown': [{ summary: 'x', start: { dateTime: '2026-07-19T10:00:00+08:00' }, end: { dateTime: '2026-07-19T11:00:00+08:00' } }]
  }, CALENDAR_LIST, CATEGORY_CONFIG, COLORS, WEEK_START);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, 'Calendar');
  assert.equal(events[0].categoryColor, '#5b6270');
});

test('bucketEventsIntoWeeks groups by week offset', () => {
  const weeks = bucketEventsIntoWeeks({
    'cal-market': [
      { start: { dateTime: '2026-07-19T11:00:00+08:00' }, end: { dateTime: '2026-07-19T19:00:00+08:00' } },
      { start: { dateTime: '2026-07-27T09:00:00+08:00' }, end: { dateTime: '2026-07-27T10:00:00+08:00' } }
    ]
  }, CALENDAR_LIST, COLORS, WEEK_START, 3);
  assert.equal(weeks.length, 3);
  assert.equal(weeks[0].weekStart, '2026-07-19');
  assert.equal(weeks[0].blocks.length, 1);
  assert.equal(weeks[1].weekStart, '2026-07-26');
  assert.equal(weeks[1].blocks.length, 1);
  assert.deepEqual(weeks[2].blocks, []);
});

test('zonedMidnight gives the UTC instant of local midnight, across DST', () => {
  assert.equal(zonedMidnight('2026-07-19', 'Asia/Singapore'), '2026-07-18T16:00:00.000Z');
  assert.equal(zonedMidnight('2026-07-19', 'UTC'), '2026-07-19T00:00:00.000Z');
  assert.equal(zonedMidnight('2026-03-08', 'America/New_York'), '2026-03-08T05:00:00.000Z'); // DST starts 02:00 that day
  assert.equal(zonedMidnight('2026-03-09', 'America/New_York'), '2026-03-09T04:00:00.000Z');
});

// ── Worker routes ────────────────────────────────────────────────────────────────────────────────────────────
const { default: worker, readSession, sessionCookie } = await import('../index.js');

const ENV = {
  GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret', SESSION_SECRET: 'x'.repeat(40),
  GOOGLE_REDIRECT_URI: 'https://rothko-cal-backend.thebooleanjulian.dev/auth/callback',
  FRONTEND_ORIGIN: 'https://rothko-cal.thebooleanjulian.dev',
  ASSETS: { fetch: async () => new Response('spa') }
};
const B = 'https://rothko-cal-backend.thebooleanjulian.dev';
const get = (path, cookie, origin) => worker.fetch(new Request(B + path, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) } }), ENV);
const cookieOf = (res) => res.headers.get('Set-Cookie').split(';')[0];

let realFetch, google;
beforeEach(() => {
  realFetch = globalThis.fetch;
  google = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    google.push({ url: u, init });
    if (u.hostname === 'oauth2.googleapis.com') {
      const body = new URLSearchParams(init.body);
      if (body.get('code') === 'bad') return Response.json({ error: 'invalid_grant' }, { status: 400 });
      return Response.json({ access_token: body.get('grant_type') === 'refresh_token' ? 'fresh' : 'at', refresh_token: 'rt', expires_in: 3600 });
    }
    if (u.hostname === 'openidconnect.googleapis.com') return Response.json({ email: 'j@example.com', name: 'Julian' });
    if (u.pathname.endsWith('/users/me/calendarList')) return Response.json({ items: CALENDAR_LIST });
    if (u.pathname.endsWith('/colors')) return Response.json(COLORS);
    if (u.pathname.includes('/events')) return Response.json({ items: [{ summary: 'e', start: { dateTime: '2026-07-20T09:00:00+08:00' }, end: { dateTime: '2026-07-20T10:00:00+08:00' } }] });
    return new Response('?', { status: 404 });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

async function loggedIn() {
  const login = await get('/auth/login');
  const state = new URL(login.headers.get('Location')).searchParams.get('state');
  const cb = await get(`/auth/callback?code=ok&state=${state}`, cookieOf(login));
  return cookieOf(cb);
}

test('login redirects to Google with the same parameters as authlib', async () => {
  const res = await get('/auth/login');
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('Location'));
  assert.equal(loc.hostname, 'accounts.google.com');
  for (const [k, v] of Object.entries({ client_id: 'cid', redirect_uri: ENV.GOOGLE_REDIRECT_URI, access_type: 'offline', prompt: 'consent', response_type: 'code' })) {
    assert.equal(loc.searchParams.get(k), v);
  }
  assert.match(loc.searchParams.get('scope'), /calendar\.readonly/);
  assert.match(res.headers.get('Set-Cookie'), /HttpOnly; SameSite=None; Secure/);
});

test('callback with a matching state stores the user; /auth/me reports them', async () => {
  const cookie = await loggedIn();
  const me = await (await get('/auth/me', cookie)).json();
  assert.deepEqual(me, { authenticated: true, email: 'j@example.com', name: 'Julian' });
  const session = await readSession(new Request(B, { headers: { Cookie: cookie } }), ENV);
  assert.equal(session.token.refresh_token, 'rt');
});

test('callback failures redirect to the frontend with auth_error=1', async () => {
  const login = await get('/auth/login');
  const state = new URL(login.headers.get('Location')).searchParams.get('state');
  for (const q of [`code=ok&state=wrong`, `error=access_denied&state=${state}`, `code=bad&state=${state}`]) {
    const res = await get(`/auth/callback?${q}`, cookieOf(login));
    assert.equal(res.headers.get('Location'), ENV.FRONTEND_ORIGIN + '?auth_error=1');
  }
});

test('API needs a session; with one it returns events in the frontend shape, with CORS for the frontend', async () => {
  assert.equal((await get('/api/events?weekStart=2026-07-19&tz=Asia/Singapore')).status, 401);
  const cookie = await loggedIn();
  const res = await get('/api/events?weekStart=2026-07-19&tz=Asia/Singapore', cookie, ENV.FRONTEND_ORIGIN);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ENV.FRONTEND_ORIGIN);
  assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
  const body = await res.json();
  assert.equal(body.weekStart, '2026-07-19');
  assert.equal(body.events.length, 2); // one event per calendar
  const eventsCall = google.find((c) => c.url.pathname.includes('/events'));
  assert.equal(eventsCall.url.searchParams.get('timeMin'), '2026-07-18T16:00:00.000Z');
  assert.equal(eventsCall.url.searchParams.get('timeMax'), '2026-07-25T16:00:00.000Z');
  const summary = await (await get('/api/weeks-summary?end=2026-07-26&count=2&tz=UTC', cookie)).json();
  assert.equal(summary.weeks.length, 2);
  assert.equal((await get('/api/events?weekStart=nope', cookie)).status, 422);
});

test('an expired access token is refreshed and the new session cookie is sent back', async () => {
  const expired = await sessionCookie(ENV, { token: { access_token: 'old', refresh_token: 'rt', expires_at: Date.now() - 1 }, user: {} });
  const res = await get('/api/calendars', expired.split(';')[0]);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('Set-Cookie'));
  const calCall = google.find((c) => c.url.pathname.endsWith('/calendarList'));
  assert.equal(calCall.init.headers.Authorization, 'Bearer fresh');
});

test('tampered cookies count as logged out; logout clears the cookie; other paths serve the SPA', async () => {
  assert.deepEqual(await (await get('/auth/me', 'session=garbage')).json(), { authenticated: false });
  assert.match((await get('/auth/logout')).headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(await (await get('/some/page')).text(), 'spa');
});
