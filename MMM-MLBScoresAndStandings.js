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

// Division pairs (2 per page) then Wild Card pages (1 per page)
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
    updateIntervalScores:          60 * 1000,
    updateIntervalStandings:     15 * 60 * 1000,
    gamesPerPage:                    8,
    logoType:                    "color",
    rotateIntervalScores:           15 * 1000,
    rotateIntervalEast:              7 * 1000,
    rotateIntervalCentral:          12 * 1000,
    rotateIntervalWest:              7 * 1000,
    standingsPerPage:                2,
    rotateIntervalStandingsSingle:   7 * 1000,
    timeZone:               "America/Chicago",
    highlightedTeams:               [],
    showTitle:                      true
  },

  getHeader() {
    if (!this.config.showTitle) return null;
    return this.currentScreen < this.totalGamePages ? "MLB Scoreboard" : "MLB Standings";
  },

  getScripts() { return ["https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"]; },
  getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

  start() {
    this.games           = [];
    this.recordGroups    = []; // six division objects from helper
    this.loadedGames     = false;
    this.loadedStandings = false;

    this.totalGamePages  = 1;
    this.totalStandPages = DIV_PAIRS.length + WILD_CARD_ORDER.length; // 3 + 2
    this.currentScreen   = 0;
    this.rotateTimer     = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config),
      Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings));

    this._scheduleRotate();
  },

  _scheduleRotate() {
    const total = this.totalGamePages + this.totalStandPages;
    let delay = this.config.rotateIntervalScores;

    if (this.currentScreen >= this.totalGamePages) {
      const idx = this.currentScreen - this.totalGamePages;
      const intervals = [
        this.config.rotateIntervalEast,    // pair 0
        this.config.rotateIntervalCentral, // pair 1
        this.config.rotateIntervalWest     // pair 2
      ];
      delay = intervals[idx] || this.config.rotateIntervalEast;
    }

    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % total;
      this.updateDom(300);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    try {
      if (notification === "GAMES") {
        this.loadedGames    = true;
        this.games          = Array.isArray(payload) ? payload : [];
        this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
        this.updateDom();
      }
      if (notification === "STANDINGS") {
        this.loadedStandings = true;
        this.recordGroups    = Array.isArray(payload) ? payload : [];
        this.updateDom();
      }
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: socket handler error", e);
    }
  },

  _noData(msg) {
    const div = document.createElement("div");
    div.className = "small dimmed";
    div.innerText = msg;
    return div;
  },

  getDom() {
    const wrapper = document.createElement("div");
    const showingGames = this.currentScreen < this.totalGamePages;
    wrapper.className = showingGames ? "scores-screen" : "standings-screen";

    if (showingGames && !this.loadedGames)      return this._noData("Loading games...");
    if (!showingGames && !this.loadedStandings) return this._noData("Loading standings...");
    if (showingGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

    try {
      wrapper.appendChild(showingGames ? this._buildGames() : this._buildStandings());
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: getDom build error", e);
      return this._noData("Error building view.");
    }
    return wrapper;
  },

  // ----------------- SCOREBOARD -----------------

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const games = this.games.slice(start, start + this.config.gamesPerPage);

    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";

    const half = Math.ceil(games.length / 2);
    [games.slice(0, half), games.slice(half)].forEach(col => {
      const colDiv = document.createElement("div");
      colDiv.className = "game-col";
      col.forEach(g => colDiv.appendChild(this.createGameBox(g)));
      wrapper.appendChild(colDiv);
    });

    return wrapper;
  },

  createGameBox(game) {
    const table = document.createElement("table");
    table.className   = "game-boxscore";
    table.cellSpacing = 0;
    table.cellPadding = 0;

    const awayScore = game?.teams?.away?.score;
    const homeScore = game?.teams?.home?.score;
    const ls        = game?.linescore || {};
    const state     = game?.status?.abstractGameState || "";
    const det       = game?.status?.detailedState || "";
    const innings   = ls?.innings || [];

    const isSuspended = /Suspended/i.test(det) || state === "Suspended";
    const isPost      = /Postponed/i.test(det);
    const isWarmup    = det === "Warmup";
    const isPrev      = state === "Preview";
    const isFin       = state === "Final";
    const live        = !isPrev && !isFin && !isPost && !isWarmup && !isSuspended;
    const showVals    = !isPrev && !isPost && !isSuspended;

    let statusText;
    if (isSuspended) statusText = "Suspended";
    else if (isPost) statusText = "Postponed";
    else if (isWarmup) statusText = "Warmup";
    else if (isPrev) {
      statusText = new Date(game.gameDate).toLocaleTimeString("en-US", {
        timeZone: this.config.timeZone,
        hour12: true,
        hour: "numeric",
        minute: "2-digit"
      });
    } else if (isFin) {
      statusText = (innings.length === 9) ? "Final" : `Final/${innings.length}`;
    } else {
      const st = ls?.inningState || "";
      const io = ls?.currentInningOrdinal || "";
      statusText = (st + " " + io).trim() || "In Progress";
    }

    // Header row
    const trH = document.createElement("tr");
    const thS = document.createElement("th");
    thS.className = "status-cell" + (live ? " live" : "");
    thS.innerText = statusText;
    trH.appendChild(thS);
    ["R","H","E"].forEach(lbl => {
      const th = document.createElement("th");
      th.className = "rhe-header";
      th.innerText = lbl;
      trH.appendChild(th);
    });
    table.appendChild(trH);

    const lines = ls?.teams || {};

    [game?.teams?.away, game?.teams?.home].forEach((t, i) => {
      if (!t || !t.team) return;
      const tr = document.createElement("tr");
      if (isFin) {
        const awayL = awayScore < homeScore;
        const homeL = homeScore < awayScore;
        if ((i === 0 && awayL) || (i === 1 && homeL)) tr.classList.add("loser");
      }

      const abbr = ABBREVIATIONS[t.team.name] || t.team.abbreviation || "";
      const tdT  = document.createElement("td");
      tdT.className = "team-cell";

      const img  = document.createElement("img");
      img.src      = this.getLogoUrl(abbr);
      img.alt      = abbr;
      img.className= "logo-cell";
      img.onerror  = () => img.style.display = "none";
      tdT.appendChild(img);

      const sp    = document.createElement("span");
      sp.className = "abbr";
      sp.innerText = abbr;
      if (this._isHighlighted(abbr)) sp.classList.add("team-highlight");
      if (isFin) sp.classList.add("final");
      tdT.appendChild(sp);
      tr.appendChild(tdT);

      const runVal = showVals ? (t.score ?? "") : "";
      const hitVal = showVals
        ? (i === 0 ? (lines.away?.hits ?? "") : (lines.home?.hits ?? ""))
        : "";
      const errVal = showVals
        ? (t.errors != null ? t.errors
            : (i === 0 ? (lines.away?.errors ?? "") : (lines.home?.errors ?? "")))
        : "";

      [runVal, hitVal, errVal].forEach(val => {
        const td = document.createElement("td");
        td.className = "rhe-cell" + (live ? " live" : "");
        td.innerText = (val == null ? "" : val);
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },

  // ----------------- STANDINGS -----------------

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const wrapper = document.createElement("div");

    if (idx < DIV_PAIRS.length) {
      wrapper.className = "standings-pair";
      DIV_PAIRS[idx].forEach(divId => wrapper.appendChild(this._createDivisionBlock(divId)));
    } else {
      wrapper.className = "standings-single";
      const wcIdx = idx - DIV_PAIRS.length;
      const league = WILD_CARD_ORDER[wcIdx]; // "NL" or "AL"
      wrapper.appendChild(this._createWildCardBlock(league));
    }
    return wrapper;
  },

  _createDivisionBlock(divId) {
    const block = document.createElement("div");
    block.className = "standings-division";

    const title = document.createElement("h3");
    title.className = "division-title";
    title.innerText = DIVISION_LABELS[divId];
    title.style.margin = "0";
    block.appendChild(title);

    const group = this.recordGroups.find(g => g?.division?.id === divId) || { teamRecords: [] };
    block.appendChild(this.createStandingsTable(group, { isWildCard: false }));
    return block;
  },

  _createWildCardBlock(league) {
    const block = document.createElement("div");
    block.className = "standings-division";

    const title = document.createElement("h3");
    title.className = "division-title";
    title.innerText = DIVISION_LABELS[league];
    title.style.margin = "0";
    block.appendChild(title);

    const wcGroup = this._buildWildCardGroup(league === "NL" ? NL_DIVS : AL_DIVS);
    block.appendChild(this.createStandingsTable(wcGroup, { isWildCard: true }));
    return block;
  },

  _pct(rec) {
    const w = parseInt(rec?.leagueRecord?.wins || 0, 10);
    const l = parseInt(rec?.leagueRecord?.losses || 0, 10);
    return (w + l) ? (w / (w + l)) : 0;
  },

  _cmpPctDesc(a, b) { return this._pct(b) - this._pct(a); },

  _leadersByDivision() {
    const m = new Map();
    (this.recordGroups || []).forEach(gr => {
      const divId = gr?.division?.id;
      const trs = gr?.teamRecords || [];
      if (!divId || !trs.length) return;
      const leader = [...trs].sort((a,b) => this._cmpPctDesc(a,b))[0];
      if (leader?.team?.id != null) m.set(divId, leader.team.id);
    });
    return m;
  },

  _buildWildCardGroup(leagueDivSet) {
    const leagueGroups = (this.recordGroups || []).filter(gr => leagueDivSet.has(gr?.division?.id));
    if (!leagueGroups.length) return { teamRecords: [] };

    const leaders = this._leadersByDivision();
    const isLeader = (rec, divId) => leaders.get(divId) === rec?.team?.id;

    const pool = [];
    leagueGroups.forEach(gr => {
      const divId = gr?.division?.id;
      (gr?.teamRecords || []).forEach(tr => { if (!isLeader(tr, divId)) pool.push(tr); });
    });
    if (!pool.length) return { teamRecords: [] };

    const sortedByPct = [...pool].sort((a,b) => {
      const pct = this._cmpPctDesc(a,b);
      if (pct !== 0) return pct;
      const aw = parseInt(a?.leagueRecord?.wins || 0, 10);
      const bw = parseInt(b?.leagueRecord?.wins || 0, 10);
      return bw - aw;
    });

    const base = sortedByPct[2] || sortedByPct[sortedByPct.length - 1];

    const wcgbNum = (r) => {
      if (!base) return 0;
      const bw = parseInt(base?.leagueRecord?.wins || 0, 10);
      const bl = parseInt(base?.leagueRecord?.losses || 0, 10);
      const rw = parseInt(r?.leagueRecord?.wins || 0, 10);
      const rl = parseInt(r?.leagueRecord?.losses || 0, 10);
      return Math.max(0, ((bw - rw) + (rl - bl)) / 2);
    };

    const withWCGB = sortedByPct.map(r => {
      const n = wcgbNum(r);
      return Object.assign({}, r, { _wcgbNum: n, _wcgbText: this._formatGB(n) });
    }).sort((a,b) => {
      if (a._wcgbNum !== b._wcgbNum) return a._wcgbNum - b._wcgbNum;
      const pct = this._cmpPctDesc(a,b);
      if (pct !== 0) return pct;
      const aw = parseInt(a?.leagueRecord?.wins || 0, 10);
      const bw = parseInt(b?.leagueRecord?.wins || 0, 10);
      return bw - aw;
    });

    return { teamRecords: withWCGB };
  },

_formatGB(num) {
  if (num == null) return "-";
  if (typeof num === "string") {
    if (num === "-" || num.trim() === "") return "-";
    const f = parseFloat(num);
    if (!isNaN(f)) num = f; else return "-";
  }
  if (Math.abs(num) < 1e-6) return "--";

  const m = Math.floor(num + 1e-9);
  const r = num - m;

  if (Math.abs(r - 0.5) < 1e-6) {
    // Wrap 1/2 in <span class="fraction">
    if (m === 0) return `<span class="fraction">1/2</span>`;
    return `${m}<span class="fraction">1/2</span>`;
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
    const table = document.createElement("table");
    table.className = "mlb-standings";

    // Division: ["", "W-L", "W%", "GB", "E#", "WCGB", "E#", "Streak", "L10", "Home", "Away"]
    // WildCard: ["", "W-L", "W%", "WCGB", "E#", "Streak", "L10", "Home", "Away"]
    const headers = isWildCard
      ? ["", "W-L", "W%", "WCGB", "E#", "Streak", "L10", "Home", "Away"]
      : ["", "W-L", "W%", "GB", "E#", "WCGB", "E#", "Streak", "L10", "Home", "Away"];

    const trH = document.createElement("tr");
    headers.forEach(txt => {
      const th = document.createElement("th");
      th.innerText = txt;
      trH.appendChild(th);
    });
    table.appendChild(trH);

    (group?.teamRecords || []).forEach((rec, i) => {
      const tr = document.createElement("tr");
      if (isWildCard && i === 3) tr.style.borderTop = "2px solid #FFD242";

      const ab = ABBREVIATIONS[rec?.team?.name] || rec?.team?.abbreviation || "";
      if (this._isHighlighted(ab)) tr.classList.add("team-highlight");

      // Team cell
      const tdT = document.createElement("td");
      tdT.className = "team-cell";
      const img = document.createElement("img");
      img.src = this.getLogoUrl(ab);
      img.alt = ab;
      img.className = "logo-cell";
      img.onerror = () => img.style.display = "none";
      tdT.appendChild(img);

      const sp = document.createElement("span");
      sp.className = "abbr";
      sp.innerText = ab;
      tdT.appendChild(sp);
      tr.appendChild(tdT);

      // W-L, Pct
      const lr = rec?.leagueRecord || {};
      const W  = parseInt(lr?.wins)   || 0;
      const L  = parseInt(lr?.losses) || 0;
      const pct = (W + L > 0) ? ((W / (W + L)).toFixed(3).replace(/^0/, "")) : "-";
      [`${W}-${L}`, pct].forEach(val => {
        const td = document.createElement("td");
        td.innerText = val;
        tr.appendChild(td);
      });

      if (isWildCard) {
        // WCGB, E#(WC)
        const wcgbHTML = typeof rec._wcgbText === "string"
          ? rec._wcgbText
          : this._formatGB(rec?.wildCardGamesBack ?? "-");
        const tdWC = document.createElement("td");
        tdWC.innerHTML = wcgbHTML;
        tr.appendChild(tdWC);

        const eWC = this._formatENum(rec?.wildCardEliminationNumber);
        const tdE = document.createElement("td");
        tdE.innerText = eWC;
        tr.appendChild(tdE);
      } else {
        // GB, E# (division)
        const tdGB = document.createElement("td");
        tdGB.innerHTML = this._formatGB(rec?.divisionGamesBack ?? "-");
        tr.appendChild(tdGB);

        const tdEDiv = document.createElement("td");
        tdEDiv.innerText = this._formatENum(rec?.eliminationNumber);
        tr.appendChild(tdEDiv);

        // WCGB, E# (wild card, label is just "E#" per request)
        const tdWC = document.createElement("td");
        tdWC.innerHTML = this._formatGB(rec?.wildCardGamesBack ?? "-");
        tr.appendChild(tdWC);

        const tdEWC = document.createElement("td");
        tdEWC.innerText = this._formatENum(rec?.wildCardEliminationNumber);
        tr.appendChild(tdEWC);
      }

      // Streak, L10, Home, Away
      const s10 = (rec?.records?.splitRecords || []).find(s => (s?.type || "").toLowerCase() === "lastten");
      const home = (rec?.records?.splitRecords || []).find(s => (s?.type || "").toLowerCase() === "home");
      const away = (rec?.records?.splitRecords || []).find(s => (s?.type || "").toLowerCase() === "away");

      [
        rec?.streak?.streakCode || "-",
        s10 ? `${s10.wins}-${s10.losses}` : "-",
        home ? `${home.wins}-${home.losses}` : "-",
        away ? `${away.wins}-${away.losses}` : "-"
      ].forEach(val => {
        const td = document.createElement("td");
        td.innerText = val;
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },

  _isHighlighted(abbr) {
    const h = this.config.highlightedTeams;
    if (Array.isArray(h)) return h.includes(abbr);
    if (typeof h === "string") return h.toUpperCase() === abbr.toUpperCase();
    return false;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
