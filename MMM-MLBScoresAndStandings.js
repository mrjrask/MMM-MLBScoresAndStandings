/* MMM-MLBScoresAndStandings.js */
/* global Module */

const ABBREVIATIONS = {
  "Chicago Cubs": "CUBS","Atlanta Braves": "ATL","Miami Marlins": "MIA",
  "New York Mets": "NYM","Philadelphia Phillies": "PHI","Washington Nationals": "WAS",
  "Cincinnati Reds": "CIN","Milwaukee Brewers": "MIL","Pittsburgh Pirates": "PIT",
  "St. Louis Cardinals": "STL","Arizona Diamondbacks": "ARI","Colorado Rockies": "COL",
  "Los Angeles Dodgers": "LAD","San Diego Padres": "SD","San Francisco Giants": "SF",
  "Baltimore Orioles": "BAL","Boston Red Sox": "BOS","New York Yankees": "NYY",
  "Tampa Bay Rays": "TB","Toronto Blue Jays": "TOR","Chicago White Sox": "SOX",
  "Cleveland Guardians": "CLE","Detroit Tigers": "DET","Kansas City Royals": "KC",
  "Minnesota Twins": "MIN","Houston Astros": "HOU","Los Angeles Angels": "LAA",
  "Athletics": "ATH","Seattle Mariners": "SEA","Texas Rangers": "TEX"
};

// Division pairs (2 per page) followed by Wild Card screens (1 per page)
const DIV_PAIRS = [
  [204, 201], // NL East & AL East
  [205, 202], // NL Central & AL Central
  [203, 200]  // NL West & AL West
];
const WILD_CARD_ORDER = ["NL", "AL"];
const NL_DIVS = new Set([203, 204, 205]);
const AL_DIVS = new Set([200, 201, 202]);

const DIVISION_LABELS = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West",
  "NL": "NL Wild Card", "AL": "AL Wild Card"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:          1   * 60 * 1000,
    updateIntervalStandings:     15   * 60 * 1000,
    gamesPerPage:                    8,
    logoType:                    "color",
    rotateIntervalScores:           15  * 1000,
    rotateIntervalEast:             7   * 1000,
    rotateIntervalCentral:         12   * 1000,
    rotateIntervalWest:             7   * 1000,
    standingsPerPage:                2,
    rotateIntervalStandingsSingle:   7   * 1000,
    timeZone:                   "America/Chicago",
    highlightedTeams:               [],
    showTitle:                     true
  },

  getHeader() {
    if (!this.config.showTitle) return null;
    return this.currentScreen < this.totalGamePages ? "MLB Scoreboard" : "MLB Standings";
  },

  getScripts() { return ["https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"]; },
  getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

  start() {
    this.games           = [];
    this.recordGroups    = [];
    this.loadedGames     = false;
    this.loadedStandings = false;
    this.totalGamePages  = 1;
    this.totalStandPages = DIV_PAIRS.length + WILD_CARD_ORDER.length;
    this.currentScreen   = 0;
    this.rotateTimer     = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config),
      Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings));

    this._scheduleRotate();
  },

  _scheduleRotate() {
    const total = this.totalGamePages + this.totalStandPages;
    clearTimeout(this.rotateTimer);
    let delay = this.config.rotateIntervalScores;
    if (this.currentScreen >= this.totalGamePages) {
      const idx = this.currentScreen - this.totalGamePages;
      const intervals = [
        this.config.rotateIntervalEast,
        this.config.rotateIntervalCentral,
        this.config.rotateIntervalWest
      ];
      delay = intervals[idx] || this.config.rotateIntervalEast;
    }
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % total;
      this.updateDom(300);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.loadedGames    = true;
      this.games          = payload;
      this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings = true;
      this.recordGroups    = payload;
      this.updateDom();
    }
  },

  _formatGB(num) {
    if (num == null) return "-";
    if (Math.abs(num) < 1e-6) return "--";
    const m = Math.floor(num + 1e-9);
    const r = num - m;
    if (Math.abs(r - 0.5) < 1e-6) {
      return m === 0 ? '<span class="fraction">1/2</span>' : `${m}<span class="fraction">1/2</span>`;
    }
    if (Math.abs(r) < 1e-6) return `${m}`;
    return num.toFixed(1).replace(/\.0$/, "");
  },

  _formatENum(val) {
    if (val == null) return "-";
    if (val === "-" || val === "--") return val;
    const n = parseInt(val, 10);
    if (!isNaN(n)) return n === 0 ? "--" : String(n);
    return String(val);
  },

  createStandingsTable(group, opts = { isWildCard: false }) {
    const isWildCard = !!opts.isWildCard;
    const table = document.createElement("table"); table.className = "mlb-standings";

    const headers = isWildCard
      ? ["", "W-L", "W%", "WCGB", "E#", "Streak", "L10", "Home", "Away"]
      : ["", "W-L", "W%", "GB", "E#", "WCGB", "WC E#", "Streak", "L10", "Home", "Away"];
    const trH = document.createElement("tr");
    headers.forEach(txt => {
      const th = document.createElement("th"); th.innerText = txt; trH.appendChild(th);
    });
    table.appendChild(trH);

    (group?.teamRecords || []).forEach((rec, i) => {
      const tr = document.createElement("tr");
      if (isWildCard && i === 3) tr.style.borderTop = "2px solid #FFD242";

      const ab = ABBREVIATIONS[rec.team?.name] || rec.team?.abbreviation || "";
      const tdT = document.createElement("td"); tdT.className = "team-cell";
      const img = document.createElement("img"); img.src = this.getLogoUrl(ab); img.alt = ab;
      img.className = "logo-cell"; img.onerror = () => img.style.display = "none";
      tdT.appendChild(img);
      const sp = document.createElement("span"); sp.className = "abbr"; sp.innerText = ab;
      tdT.appendChild(sp); tr.appendChild(tdT);

      const lr = rec.leagueRecord || {};
      const W  = parseInt(lr.wins)   || 0;
      const L  = parseInt(lr.losses) || 0;
      const pct = (W + L > 0) ? ((W/(W+L)).toFixed(3).replace(/^0/, "")) : "-";
      [`${W}-${L}`, pct].forEach(val => {
        const td = document.createElement("td"); td.innerText = val; tr.appendChild(td);
      });

      if (isWildCard) {
        const wcgb = this._formatGB(parseFloat(rec._wcgbNum || rec.wildCardGamesBack || 0));
        const tdWC = document.createElement("td"); tdWC.innerHTML = wcgb; tr.appendChild(tdWC);
        const eWC = this._formatENum(rec.wildCardEliminationNumber);
        const tdE = document.createElement("td"); tdE.innerText = eWC; tr.appendChild(tdE);
      } else {
        const gb = this._formatGB(parseFloat(rec.divisionGamesBack || 0));
        const tdGB = document.createElement("td"); tdGB.innerHTML = gb; tr.appendChild(tdGB);
        const eDiv = this._formatENum(rec.eliminationNumber);
        const tdED = document.createElement("td"); tdED.innerText = eDiv; tr.appendChild(tdED);
        const wcgb = this._formatGB(parseFloat(rec.wildCardGamesBack || 0));
        const tdWC = document.createElement("td"); tdWC.innerHTML = wcgb; tr.appendChild(tdWC);
        const eWC = this._formatENum(rec.wildCardEliminationNumber);
        const tdEWC = document.createElement("td"); tdEWC.innerText = eWC; tr.appendChild(tdEWC);
      }

      [rec.streak?.streakCode || "-",
       (rec.records?.splitRecords?.find(s => s.type?.toLowerCase() === "lastten")?.wins || "-") + "-" +
       (rec.records?.splitRecords?.find(s => s.type?.toLowerCase() === "lastten")?.losses || "-"),
       rec.records?.splitRecords?.find(s => s.type?.toLowerCase() === "home") ?
         `${rec.records.splitRecords.find(s => s.type.toLowerCase()==="home").wins}-${rec.records.splitRecords.find(s => s.type.toLowerCase()==="home").losses}` : "-",
       rec.records?.splitRecords?.find(s => s.type?.toLowerCase() === "away") ?
         `${rec.records.splitRecords.find(s => s.type.toLowerCase()==="away").wins}-${rec.records.splitRecords.find(s => s.type.toLowerCase()==="away").losses}` : "-"
      ].forEach(val => {
        const td = document.createElement("td"); td.innerText = val; tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
