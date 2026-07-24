<div align="center">

# Rothko Cal

**A visual planning toolkit for turning Google Calendar into an intentional, legible system.**

![Version](https://img.shields.io/badge/version-0.2.0-00D4C8)
![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white)
![HTML](https://img.shields.io/badge/-HTML-E34F26?logo=html5&logoColor=white)
![License](https://img.shields.io/badge/license-AGPLv3%20%2F%20Commercial-00D4C8.svg)

</div>

---

## What it does

Rothko Cal is a small personal planning toolkit for making Google Calendar more intentional and visual. It provides a dark, editorial-style weekly canvas for viewing time at a glance, a Python script for migrating historical events into cleaner category calendars, and a color-mapping reference for separating category and status visually. It's built for individuals who want their calendar to feel more legible and structurally durable.

## Features

- Weekly mood-board-style calendar canvas in a single standalone HTML file
- Google Calendar backfill script for reviewing and moving historical events into category-specific calendars
- Color-mapping documentation separating calendar-level categories from event-level statuses

## Tech Stack

| Layer | Choice |
|---|---|
| Canvas | Single-file HTML |
| Backfill script | Python |

## Project Structure

```
rothko-cal/
|-- calendar-canvas.html
|-- backfill_calendar_categories.py
|-- CALENDAR_COLORS.md
|-- COMMERCIAL-LICENSE.md
|-- LICENSE
`-- README.md
```

## Quick overview

This project is designed around two ideas:

1. Make time feel more legible through a visual weekly canvas.
2. Make calendar organization more durable by separating category and status into distinct layers.

## Versioning

This repository uses a simple major/minor version format:

- the first number increases for major milestones or structural changes
- the second number increases for minor feature updates, workflow improvements, or documentation refinements

## Status / Roadmap

**Done**

- [x] Standalone weekly calendar canvas (`calendar-canvas.html`)
- [x] Google Calendar backfill/migration script
- [x] Color-mapping reference for category vs status

**Planned / Suggestions**

- Move category rules out of hardcoded script values into a JSON or YAML config file
- Add a simple visual review UI for approving or rejecting backfill actions
- Add automated tests for the backfill logic and category matching rules
- No `.env.example` or config scaffolding present despite the script likely requiring Google Calendar credentials

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

## Changelog

### v0.2.0 — Documentation and workflow refinement
- Clarified the category and status color model
- Improved the project structure around the backfill workflow
- Added a repository README with changelog and roadmap guidance

### v0.1.0 — Initial release
- Added the calendar canvas experience in `calendar-canvas.html`
- Added the Google Calendar backfill script for moving historical events into category calendars
- Added color-mapping documentation for category vs status distinctions

## License

Dual licensed:

- **Community Edition** — [GNU Affero General Public License v3 (AGPLv3)](LICENSE). Free to use, modify, and self-host. If you distribute a modified version or run it as a network service, you must make the corresponding source available.
- **Commercial License** — for organisations wanting to embed or distribute without AGPLv3 obligations. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

<div align="center">
<sub>Built by <a href="https://github.com/TheBooleanJulian">@TheBooleanJulian</a></sub>
</div>
