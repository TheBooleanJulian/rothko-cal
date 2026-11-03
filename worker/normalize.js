// Pure functions turning raw Google Calendar API payloads into the shapes the frontend canvas renders.
// Port of backend/app/normalize.py: no network calls here, so it is unit-testable against fixture JSON.
//
// Event times keep their own UTC offset, like Python's datetime.fromisoformat: "2026-07-19T11:00:00+08:00" is
// hour 11 on 2026-07-19 whatever timezone the Worker runs in. Dates are handled as "YYYY-MM-DD" strings.

const DAY_MS = 86400000;

export function realCategoryConfig(raw) {
  // Strip comment/meta keys (leading underscore) from category_config.json.
  return Object.fromEntries(Object.entries(raw || {}).filter(([k]) => !k.startsWith('_')));
}

// Look up the configured category, or fall back to the calendar's own Google name (other users' calendars).
export function resolveCategory(calendarId, calendarEntry, categoryConfig) {
  if (calendarId in categoryConfig) return categoryConfig[calendarId];
  return { label: calendarEntry.summary || 'Calendar', order: 999 };
}

// {dateTime: iso} or {date: iso} (all-day) → wall-clock parts in the value's own offset.
export function parseEventDateTime(value) {
  const s = value.dateTime || value.date;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s || '');
  if (!m) throw new Error(`bad event time: ${s}`);
  return { date: m[1], hour: Number(m[2] || 0), minute: Number(m[3] || 0), second: Number(m[4] || 0) };
}

export const decimalHour = (t) => t.hour + t.minute / 60 + t.second / 3600;

const dayNumber = (isoDate) => Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10)) / DAY_MS;
export const dayIndex = (isoDate, weekStart) => dayNumber(isoDate) - dayNumber(weekStart);
export const addDays = (isoDate, days) => new Date((dayNumber(isoDate) + days) * DAY_MS).toISOString().slice(0, 10);

// calendarListEntry.backgroundColor is what Google Calendar actually renders and wins; the colorId lookup in
// colors().get() is only a fallback (its palette index can drift from backgroundColor after custom-color edits).
export function resolveCategoryColor(calendarColors, calendarListEntry) {
  if (calendarListEntry.backgroundColor) return calendarListEntry.backgroundColor;
  const colorId = calendarListEntry.colorId;
  if (colorId && calendarColors[colorId]) return calendarColors[colorId].background;
  return '#5b6270';
}

export function resolveStatusColor(event, eventColors) {
  const colorId = event.colorId;
  return colorId && eventColors[colorId] ? eventColors[colorId].background : null;
}

export function normalizeEvent(event, calendarId, categoryLabel, categoryColor, eventColors, weekStart) {
  const startVal = event.start || {};
  if (!startVal.dateTime) return null; // skip all-day events on the hourly canvas
  const start = parseEventDateTime(startVal);
  const end = parseEventDateTime(event.end || {});
  return {
    day: dayIndex(start.date, weekStart),
    start: decimalHour(start),
    end: decimalHour(end),
    title: event.summary || '(no title)',
    category: categoryLabel,
    categoryColor,
    statusColor: resolveStatusColor(event, eventColors),
    calendarId
  };
}

export function buildWeekEvents(eventsByCalendar, calendarList, categoryConfig, colors, weekStart) {
  const entries = Object.fromEntries(calendarList.map((c) => [c.id, c]));
  const calendarColors = colors.calendar || {};
  const eventColors = colors.event || {};
  const out = [];
  for (const [calendarId, events] of Object.entries(eventsByCalendar)) {
    const entry = entries[calendarId] || {};
    const cfg = resolveCategory(calendarId, entry, categoryConfig);
    const categoryColor = resolveCategoryColor(calendarColors, entry);
    for (const event of events) {
      const item = normalizeEvent(event, calendarId, cfg.label, categoryColor, eventColors, weekStart);
      if (item && item.day >= 0 && item.day <= 6) out.push(item);
    }
  }
  return out;
}

// Buckets a wide date-range query into weekCount weeks starting at rangeStart → [{weekStart, blocks}].
export function bucketEventsIntoWeeks(eventsByCalendar, calendarList, colors, rangeStart, weekCount) {
  const entries = Object.fromEntries(calendarList.map((c) => [c.id, c]));
  const calendarColors = colors.calendar || {};
  const weeks = Array.from({ length: weekCount }, (_, i) => ({ weekStart: addDays(rangeStart, 7 * i), blocks: [] }));
  for (const [calendarId, events] of Object.entries(eventsByCalendar)) {
    const color = resolveCategoryColor(calendarColors, entries[calendarId] || {});
    for (const event of events) {
      if (!(event.start || {}).dateTime) continue;
      const start = parseEventDateTime(event.start);
      const end = parseEventDateTime(event.end || {});
      const offset = Math.floor(dayIndex(start.date, rangeStart) / 7);
      if (offset < 0 || offset >= weekCount) continue;
      weeks[offset].blocks.push({ start: decimalHour(start), end: decimalHour(end), color });
    }
  }
  return weeks;
}

// Midnight of isoDate in IANA zone tz, as an RFC 3339 UTC instant (what Python's
// datetime.combine(d, time.min, tzinfo=ZoneInfo(tz)).isoformat() meant, written in UTC).
export function zonedMidnight(isoDate, tz) {
  const guess = dayNumber(isoDate) * DAY_MS;
  let instant = guess - offsetMs(guess, tz);
  instant = guess - offsetMs(instant, tz); // second pass settles DST transitions
  return new Date(instant).toISOString();
}

function offsetMs(instant, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(instant)).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}
