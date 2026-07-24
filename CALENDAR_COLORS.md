# Calendar Color Mapping

Two-layer system on Google Calendar: **calendar-level color = category**, **event `colorId` override = status**. Categories live on separate calendars (24-color palette); status flags apply on top of any calendar via the 11-color event palette.

## Layer 1 — Category (calendar-level, 24-color palette)

One dedicated Google Calendar per row. Set via `colorId` on the `calendarListEntry`, or arbitrary hex with `colorRgbFormat=true`.

| Category | Color | colorId |
|---|---|---|
| BNI & 121 | Cobalt | 15 |
| Accurova (paid) | Tangerine | 4 |
| Accurova (free) | Mango | 6 |
| Educare4u | Basil | 8 |
| UpTeach | Pistachio | 9 |
| Other paid gigs | Pumpkin | 5 |
| Other networking / meetups | Amethyst | 24 |
| External events / Luma | Eucalyptus | 7 |
| Courses / lessons / webinars | Cherry Blossom | 22 |
| Travel / public transport | Birch | 20 |
| F1 | Beetroot | 21 |
| Moon phase | Wisteria | 18 |
| Shared family calendar | Flamingo | 2 |

## Layer 2 — Status (event-level override, 11-color palette)

Applied via `colorId` on the individual `event` resource. Overrides the calendar's category color visually, layers on top of *any* calendar above.

| Status | Color | colorId |
|---|---|---|
| Highly compulsory | Tomato | 11 |
| Upcoming clash / to be deconflicted | Grape | 3 |
| Didn't attend / postponed / cancelled | Graphite | 8 |
| Tentative | Lavender | 1 |
| Default / genuinely uncategorized | Peacock | 7 |
| — unassigned (spare) | Banana | 5 |

## Notes

- `colorId` values for **calendars** and **events** are separate palettes — a `colorId` of `4` means Flamingo on a calendar but Tangerine on an event. Always fetch both from `colors().get()` rather than hardcoding.
- Graphite is exclusive to "cancelled/postponed" status. F1 previously shared this color at the category level — moved to its own calendar (Beetroot) to remove the ambiguity.
- Banana is freed from its old cross-cutting "paid" meaning now that Accurova (paid)/(free), Educare4u, UpTeach, and Other paid gigs each carry their own category color. Left unassigned for future use.
- Accurova's old dark-blue-calendar → cyan-dupe-on-main workflow is a candidate for retirement now that Accurova (paid)/(free) are real categories in their own right — pending confirmation.

## Migration (past events)

Historical events don't inherit new colors automatically. Backfilling requires a script using `events.move()` to reassign each past event to its correct destination calendar, matched by title/location/attendee keyword rules per category above.
