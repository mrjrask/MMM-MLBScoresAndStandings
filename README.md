# MMM-MLBScoresAndStandings

A sleek MLB scoreboard + standings module for [MagicMirror²](https://magicmirror.builders).  
It rotates between game scoreboards and standings (division pairs and wild cards), supports team highlighting, compact layouts, and highly tunable fonts/sizing via CSS variables.

> ✅ **Works great in `middle_center`** thanks to a width cap.  
> ✅ **Wild Card** tables auto-computed from division feeds.  
> ✅ **Statuses**: `Final`, `Final/11` (extras), `Postponed`, `Suspended`, `Warmup`, **Live** yellow R/ H/ E.  
> ✅ **Optional Home/Away** splits in standings.  
> ✅ **Times Square** font for a ballpark look — header stays in MagicMirror’s default font.

---

## Table of Contents

- [Features](#features)
- [Screens](#screens)
- [Installation](#installation)
- [Configuration](#configuration)
- [Logos & Fonts](#logos--fonts)
- [Styling & CSS Variables](#styling--css-variables)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Credits & License](#credits--license)

---

## Features

- **Scoreboard** in two balanced columns, `gamesPerPage` paginated.
- **Standings** cycle: NL/AL East, NL/AL Central, NL/AL West, NL Wild Card, AL Wild Card.
- **Wild Card**: division leaders are excluded; WCGB computed vs. the 3rd WC team.
- **“GB / WCGB / E#”**: `0` rendered as `--`; half-games show as `1/2` in smaller type.
- **Team highlighting**: show your favorites in accent color.
- **Width cap**: keep the module tidy in `middle_center`.
- **Optional splits**: show/hide `Home`/`Away` with a single flag.
- **Status text**: `Final` (or `Final/##`), `Warmup`, `Postponed`, `Suspended`, **live** innings with yellow R/H/E.
- **No external deps** required in `node_helper` (uses Node’s global `fetch`).

---

## Screens

1. **Scoreboard** (may span multiple pages if there are many games)
2. **Standings (pairs)**:  
   - NL East & AL East  
   - NL Central & AL Central  
   - NL West & AL West
3. **Wild Card (single)**:  
   - NL Wild Card  
   - AL Wild Card

Rotation timing for each screen is configurable.

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/yourname/MMM-MLBScoresAndStandings.git
cd MMM-MLBScoresAndStandings
# No npm install required (uses global.fetch from Node 18+)
```

> **Node Requirement:** Node **18+** (for built-in `fetch`). If you must run older Node, install `node-fetch@3` and adapt `node_helper.js` accordingly.

Place your team **logos** and the **Times Square** font as described below.

---

## Configuration

Add to your `config/config.js`:

```js
{
  module: "MMM-MLBScoresAndStandings",
  position: "middle_center", // or wherever you prefer
  config: {
    // Refresh
    updateIntervalScores: 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,

    // Scoreboard
    gamesPerPage: 8,
    logoType: "color",         // folder under ./logos/ e.g. logos/color/ATL.png
    rotateIntervalScores: 15 * 1000,

    // Standings rotation
    rotateIntervalEast: 7 * 1000,
    rotateIntervalCentral: 12 * 1000,
    rotateIntervalWest: 7 * 1000,

    // Behavior
    timeZone: "America/Chicago",
    highlightedTeams: ["CUBS"], // string or array of 3–5 letter abbrs
    showTitle: true,

    // NEW: standings Home/Away splits
    showHomeAwaySplits: true,   // set false to hide "Home" & "Away" columns

    // Width cap to keep module tidy in middle_center
    maxWidth: "720px"
  }
}
```

**Notes**
- **Header width** matches `maxWidth` and stays in the default MM font (Roboto Condensed).
- **Highlighted teams** accept a single string `"CUBS"` or an array like `["CUBS","NYY"]`.
- The rotation order is fixed as: *Scoreboard → (NL/AL East) → (NL/AL Central) → (NL/AL West) → NL WC → AL WC*.

---

## Logos & Fonts

```
MMM-MLBScoresAndStandings/
├─ MMM-MLBScoresAndStandings.js
├─ node_helper.js
├─ MMM-MLBScoresAndStandings.css
├─ fonts/
│  └─ TimesSquare-m105.ttf
└─ logos/
   └─ color/
      ├─ ATL.png
      ├─ CUBS.png
      ├─ LAD.png
      └─ ... one file per team abbr ...
```

- **Logos**: PNGs named by **abbr** (e.g., `CUBS.png`) under `logos/<logoType>/`.
- **Font**: `fonts/TimesSquare-m105.ttf` is loaded by `@font-face` inside the module CSS.

---

## Styling & CSS Variables

Most sizing is controlled by CSS variables in `MMM-MLBScoresAndStandings.css`.  
Here are the key variables you can tune:

```css
:root {
  /* Font sizes */
  --font-size-abbr: 1.4em;
  --font-size-status: 1.0em;
  --font-size-rhe-values: 1.7em;
  --font-size-rhe-headers: 1.2em;
  --font-size-standings-headers: 1.0em;
  --font-size-standings-values:  1.3em;
  --font-size-fraction: 0.6em; /* “1/2” next to whole numbers */

  /* Cell paddings */
  --pad-abbr: 0 6px;
  --pad-status: 0 6px;
  --pad-rhe: 0 6px;
  --pad-standings: 3px 5px;

  /* Row heights & widths */
  --height-row-game: 1.4em;
  --height-row-stand: 1.4em;

  --width-status: 3em;
  --width-rhe: 1.2em;
  --logo-size-game: 1.4em;
  --logo-size-stand: 1.2em;

  /* Standings column widths */
  --width-team-col-stand: 3.8em;   /* fits logo + “CUBS” */
  --width-record-col-stand: 3.2em; /* record/L10/Home/Away cells */
  --width-gb-col: 3.0em;           /* ensure GB and WCGB same width */
  --width-wcgb-col: 3.0em;
}
```

### Column width helpers (standings)
We apply classes to specific columns so you can target widths precisely:

```css
/* Team column (logo+abbr) */
.mlb-standings th.team-col,
.mlb-standings td.team-col { width: var(--width-team-col-stand); }

/* Record cells (W-L, L10, Home, Away) */
.mlb-standings th.rec-col,
.mlb-standings td.rec-col,
.mlb-standings th.l10-col,
.mlb-standings td.l10-col,
.mlb-standings th.home-col,
.mlb-standings td.home-col,
.mlb-standings th.away-col,
.mlb-standings td.away-col { width: var(--width-record-col-stand); }

/* GB and WCGB same width */
.mlb-standings th.gb-col,   .mlb-standings td.gb-col   { width: var(--width-gb-col); }
.mlb-standings th.wcgb-col, .mlb-standings td.wcgb-col { width: var(--width-wcgb-col); }

/* Thicker vertical separators (example) */
.mlb-standings th.sep-right,
.mlb-standings td.sep-right { border-right-width: 4px; }
```

The module also uses `.fraction` to shrink the “1/2” in GB/WCGB values:
```css
.mlb-standings .fraction { font-size: var(--font-size-fraction); vertical-align: baseline; }
```

> If you need the **module header** to use the default MM font:
```css
/* Keep the module title (header) in MagicMirror default font */
.module.MMM-MLBScoresAndStandings .module-header {
  font-family: var(--font-primary, "Roboto Condensed"), var(--font-secondary, "Roboto"), sans-serif !important;
}
```

---

## Troubleshooting

**Header font switched to Times Square**  
Remove any global rules like:
```css
.module.MMM-MLBScoresAndStandings * { font-family: 'Times Square' !important; }
```
and use the header override shown above.

**Font not loading**  
- Ensure `fonts/TimesSquare-m105.ttf` exists.
- The CSS `@font-face` uses a relative URL: `url('fonts/TimesSquare-m105.ttf')` since the CSS lives in the same module folder.

**Logos not showing**  
- Confirm file names match abbreviations (e.g., `CUBS.png`).
- The code hides broken images automatically (falls back to abbreviation).

**“Cannot find module 'node-fetch'”**  
- This module uses **global `fetch` from Node 18+**. Upgrade Node.  
  If you must use older Node, install `node-fetch@3` and adjust `node_helper.js` to `require('node-fetch')` and use it.

**MIME errors for `/css/custom.css`**  
- Don’t reference `css/custom.css` unless the file exists; otherwise MagicMirror serves a 404 as HTML which fails strict MIME checking.

**Standings row height won’t change**  
- Row height is constrained by line-height + logo size. Reduce `--logo-size-stand` or `--font-size-standings-values` if needed.

---

## FAQ

**Q: What’s the Wild Card calculation?**  
A: We exclude each division’s leader, sort the rest by win% (tie-break by wins), and compute WCGB relative to the **3rd** wild-card team:  
`WCGB = ((wins_3rd - wins_team) + (losses_team - losses_3rd)) / 2`.  
Values render as `--` for zero, `m<span class="fraction">1/2</span>` for halves.

**Q: Can I hide Home/Away splits?**  
A: Yes—set `showHomeAwaySplits: false` in the module config.

**Q: Does the scoreboard show extra innings?**  
A: Yes—`Final/11`, etc. Live games display R/H/E in yellow.

---

## Credits & License

- **MLB data**: [statsapi.mlb.com](https://statsapi.mlb.com/) (unofficial public API).
- **Font**: *Times Square* (you must have rights to use/distribute).
- **MagicMirror²**: © Michael Teeuw and contributors.  
- Module © You, released under the **MIT License** (see below).

```
MIT License

Copyright (c) 2025 <Your Name>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
