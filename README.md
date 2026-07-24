# Rothko Cal

Rothko Cal is a small personal planning toolkit for turning a Google Calendar into a more intentional, visual system. It combines:

- a dark, editorial-style calendar canvas for viewing weeks at a glance
- a Python workflow for backfilling historical events into clearer category calendars
- a color-mapping reference for separating category and status visually

## What’s in this project

- `calendar-canvas.html` — a standalone HTML calendar visualization with a weekly, mood-board-like layout.
- `backfill_calendar_categories.py` — a Google Calendar migration helper that reviews and moves historical events into category-specific calendars.
- `CALENDAR_COLORS.md` — documentation for how calendar-level categories and event-level statuses are mapped to colors.

## Quick overview

This project is designed around two ideas:

1. Make time feel more legible through a visual weekly canvas.
2. Make calendar organization more durable by separating category and status into distinct layers.

## Versioning

This repository uses a simple major/minor version format:

- the first number increases for major milestones or structural changes
- the second number increases for minor feature updates, workflow improvements, or documentation refinements

## Changelog

### v0.1.0 — Initial release
- Added the calendar canvas experience in `calendar-canvas.html`
- Added the Google Calendar backfill script for moving historical events into category calendars
- Added color-mapping documentation for category vs status distinctions

### v0.2.0 — Documentation and workflow refinement
- Clarified the category and status color model
- Improved the project structure around the backfill workflow
- Added a repository README with changelog and roadmap guidance

## Future roadmap

### Near-term ideas
- Add a configuration file for category rules instead of relying on hardcoded values in the Python script
- Add an export/import workflow for saved category mappings and review decisions
- Add a simple review dashboard for approving or rejecting backfill actions visually

### Medium-term ideas
- Add support for recurring-event handling and smarter batch review
- Add richer calendar insights, such as workload summaries, travel patterns, and focus-block tracking
- Add automated testing for the backfill logic and category matching rules

### Longer-term ideas
- Turn the canvas into a more interactive planner with filters, toggles, and custom themes
- Add a lightweight web app for managing calendars, categories, and review queues
- Add sync support for additional calendar providers or local export formats

## Suggested next steps

If you want to keep momentum, the best next move would be:

1. move category rules into a JSON or YAML config file
2. add a simple review UI for the backfill workflow
3. introduce a more polished weekly view with better filtering and event metadata

## License

This project is dual licensed.

- **Community Edition** — [GNU Affero General Public License v3 (AGPLv3)](LICENSE). Free to use, modify, and self-host. If you distribute a modified version or run it as a network service, you must make the corresponding source available.
- **Commercial License** — for organisations that want to embed, modify, or distribute this software without AGPLv3's obligations. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

<div align="center">
<sub>Built by <a href="https://github.com/TheBooleanJulian">@TheBooleanJulian</a></sub>
</div>
