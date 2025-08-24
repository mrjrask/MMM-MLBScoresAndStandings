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
const WILD_CARD_ORDER = ["NL", "AL"]; // one page each
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
    this.recordGroups    = []; // division objects from helper (AL+NL)
    this.loadedGames     = false;
    this.loadedStandings = false;
    this.totalGamePages  = 1;
    this.totalStandPages = DIV_PAIRS.length + WILD_CARD_ORDER.length; // 3 pairs + 2 WC
    this.currentScreen   = 0;
    this.rotateTimer     = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config),
      Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings));

    this._scheduleRotate();
  },

  _scheduleRotate() {
    const total = this.totalGamePages + this.totalStandPages;
    let delay;
    if (this.currentScreen < this.totalGamePages) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      const intervals = [
        this.config.rotateIntervalEast,    // pair 0 (East)
        this.config.rotateIntervalCentral, // pair 1 (Central)
        this.config.rotateIntervalWest     // pair 2 (West)
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
    if (notification === "GAMES") {
      this.loadedGames    = true;
      this.games          = payload;
      this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings = true;
      this.recordGroups    = payload; // array of division records from helper
      this.updateDom();
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

    if (showingGames && !this.loadedGames)       return this._noData("Loading games...");
    if (!showingGames && !this.loadedStandings)  return this._noData("Loading standings...");
    if (showingGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

    wrapper.appendChild(showingGames ? this._buildGames() : this._buildStandings());
    return wrapper;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const games = this.games.slice(start, start + this.config.gamesPerPage);
    const wrapper = document.createElement("div"); wrapper.className = "games-columns";
    const half = Math.ceil(games.length / 2);
    [games.slice(0, half), games.slice(half)].forEach(col => {
      const colDiv = document.createElement("div"); colDiv.className = "game-col";
      col.forEach(game => colDiv.appendChild(this.createGameBox(game)));
      wrapper.appendChild(colDiv);
    });
    return wrapper;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const wrapper = document.createElement("div");

    if (idx < DIV_PAIRS.length) {
      // Division screens (two per page)
      wrapper.className = "standings-pair";
      DIV_PAIRS[idx].forEach(divId => wrapper.appendChild(this._createDivisionBlock(divId)));
    } else {
      // Wild Card screens (one per page)
      wrapper.className = "standings-single";
      const wcIdx = idx - DIV_PAIRS.length;
      const league = WILD_CARD_ORDER[wcIdx]; // "NL" or "AL"
      wrapper.appendChild(this._createWildCardBlock(league));
    }
    return wrapper;
  },

  _createDivisionBlock(divId) {
    const block = document.createElement("div"); block.className = "standings-division";
    const title = document.createElement("h3");
    title.className = "division-title"; // styled in CSS to use Times Square
    title.innerText = DIVISION_LABELS[divId];
    title.style.margin = "0";
    block.appendChild(title);

    const group = this.recordGroups.find(g => g.division.id === divId);
    block.appendChild(this.createStandingsTable(group || { teamRecords: [] }, { isWildCard: false }));
    return block;
  },

  _createWildCardBlock(league) {
    const block = document.createElement("div"); block.className = "standings-division";
    const title = document.createElement("h3");
    title.className = "division-title";
    title.innerText = DIVISION_LABELS[league];
    title.style.margin = "0";
    block.appendChild(title);

    const wcGroup = this._buildWildCardGroup(league === "NL" ? NL_DIVS : AL_DIVS);
    block.appendChild(this.createStandingsTable(wcGroup, { isWildCard: true }));
    return block;
  },

  // ---------- Wild Card build helpers (division-ID driven) ----------

  _pct(rec) {
    const w = parseInt(rec.leagueRecord?.wins || 0, 10);
    const l = parseInt(rec.leagueRecord?.losses || 0, 10);
    return (w + l) ? (w / (w + l)) : 0;
  },

  _cmpPctDesc(a, b) {
    return this._pct(b) - this._pct(a);
  },

  _leadersByDivision() {
    // Map<divisionId, leaderTeamId> by best pct within that division
    const m = new Map();
    (this.recordGroups || []).forEach(gr => {
      const divId = gr?.division?.id;
      if (!divId || !(gr.teamRecords || []).length) return;
      const leader = [...gr.teamRecords].sort((a,b) => this._cmpPctDesc(a,b))[0];
      if (leader?.team?.id) m.set(divId, leader.team.id);
    });
    return m;
  },

  _buildWildCardGroup(leagueDivSet) {
    // Collect teams in the requested league by division id set
    const leagueGroups = (this.recordGroups || []).filter(gr => leagueDivSet.has(gr?.division?.id));
    if (!leagueGroups.length) return { teamRecords: [] };

    const leaders = this._leadersByDivision();
    const isLeader = (rec, divId) => leaders.get(divId) === rec.team?.id;

    // Pool of *non-leaders*
    const pool = [];
    leagueGroups.forEach(gr => {
      const divId = gr.division.id;
      (gr.teamRecords || []).forEach(tr => { if (!isLeader(tr, divId)) pool.push(tr); });
    });
    if (!pool.length) return { teamRecords: [] };

    // Sort by pct desc, then wins desc
    const sortedByPct = [...pool].sort((a,b) => {
      const pct = this._cmpPctDesc(a,b);
      if (pct !== 0) return pct;
      const aw = parseInt(a.leagueRecord?.wins || 0, 10);
      const bw = parseInt(b.leagueRecord?.wins || 0, 10);
      return bw - aw;
    });

    // Baseline = 3rd team (last WC slot)
    const base = sortedByPct[2] || sortedByPct[sortedByPct.length - 1];

    const wcgbNum = (r) => {
      if (!base) return 0;
      const bw = parseInt(base.leagueRecord?.wins || 0, 10);
      const bl = parseInt(base.leagueRecord?.losses || 0, 10);
      const rw = parseInt(r.leagueRecord?.wins || 0, 10);
      const rl = parseInt(r.leagueRecord?.losses || 0, 10);
      return Math.max(0, ((bw - rw) + (rl - bl)) / 2);
    };

    // Attach WCGB and sort by WCGB asc, pct desc, wins desc
    const withWCGB = sortedByPct.map(r => {
      const n = wcgbNum(r);
      return Object.assign({}, r, { _wcgbNum: n, _wcgbText: this._formatGB(n) });
    }).sort((a,b) => {
      if (a._wcgbNum !== b._wcgbNum) return a._wcgbNum - b._wcgbNum;
      const pct = this._cmpPctDesc(a,b);
      if (pct !== 0) return pct;
      const aw = parseInt(a.leagueRecord?.wins || 0, 10);
      const bw = parseInt(b.leagueRecord?.wins || 0, 10);
      return bw - aw;
    });

    return { teamRecords: withWCGB };
  },

  _formatGB(num) {
    // 0 becomes "--" per your request
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

  // ---------- Standings Table Render ----------

  createStandingsTable(group, opts = { isWildCard: false }) {
    const isWildCard = !!opts.isWildCard;
    const table = document.createElement("table"); table.className = "mlb-standings";

    // Headers: add WCGB column after GB for division pages
    const trH = document.createElement("tr");
    const headers = isWildCard
      ? ["", "W-L", "W%", "WCGB", "Streak", "L10", "Home", "Away"]
      : ["", "W-L", "W%", "GB", "WCGB", "Streak", "L10", "Home", "Away"];
    headers.forEach(txt => {
      const th = document.createElement("th"); th.innerText = txt; trH.appendChild(th);
    });
    table.appendChild(trH);

    (group?.teamRecords || []).forEach((rec, i) => {
      const tr = document.createElement("tr");
      if (isWildCard && i === 3) tr.style.borderTop = "2px solid #FFD242"; // separator after 3rd

      const ab = ABBREVIATIONS[rec.team?.name] || rec.team?.abbreviation || "";
      if (this._isHighlighted(ab)) tr.classList.add("team-highlight");

      // Team cell
      const tdT = document.createElement("td"); tdT.className = "team-cell";
      const img = document.createElement("img");
      img.src = this.getLogoUrl(ab); img.alt = ab;
      img.className = "logo-cell"; img.onerror = () => img.style.display = 'none';
      tdT.appendChild(img);
      const sp = document.createElement("span"); sp.className = "abbr"; sp.innerText = ab;
      tdT.appendChild(sp); tr.appendChild(tdT);

      // W-L and Pct
      const lr = rec.leagueRecord || {};
      const W  = parseInt(lr.wins)   || 0;
      const L  = parseInt(lr.losses) || 0;
      const pct = (W + L > 0) ? ((W/(W+L)).toFixed(3).replace(/^0/, "")) : "-";
      [`${W}-${L}`, pct].forEach(val => {
        const td = document.createElement("td"); td.innerText = val; tr.appendChild(td);
      });

      // GB (division) + WCGB display rules
      if (isWildCard) {
        // WC screen: only WCGB column (already in headers)
        const wcgbHTML = (typeof rec._wcgbText === "string") ? rec._wcgbText : "--";
        const tdWC = document.createElement("td"); tdWC.innerHTML = wcgbHTML; tr.appendChild(tdWC);
      } else {
        // Division screen: GB then WCGB (new)
        // GB:
        let gbHTML = "-";
        if (rec.divisionGamesBack != null && rec.divisionGamesBack !== "-") {
          const f = parseFloat(rec.divisionGamesBack);
          gbHTML = this._formatGB(isNaN(f) ? 0 : f);
        }
        const tdGB = document.createElement("td"); tdGB.innerHTML = gbHTML; tr.appendChild(tdGB);

        // WCGB (prefer field from API; else compute relative to wild-card baseline using wins/losses if needed)
        let wcgbHTML = "--";
        if (rec.wildCardGamesBack != null && rec.wildCardGamesBack !== "-") {
          const f = parseFloat(rec.wildCardGamesBack);
          wcgbHTML = this._formatGB(isNaN(f) ? 0 : f);
        }
        const tdWC = document.createElement("td"); tdWC.innerHTML = wcgbHTML; tr.appendChild(tdWC);
      }

      // Streak, L10, Home, Away
      const sr = rec.streak?.streakCode || "-";
      const s10 = rec.records?.splitRecords?.find(s => s.type?.toLowerCase() === "lastten");
      const l10 = s10 ? `${s10.wins}-${s10.losses}` : "-";
      const home = rec.records?.splitRecords?.find(s => s.type?.toLowerCase() === "home");
      const away = rec.records?.splitRecords?.find(s => s.type?.toLowerCase() === "away");

      [sr, l10,
        home ? `${home.wins}-${home.losses}` : "-",
        away ? `${away.wins}-${away.losses}` : "-"
      ].forEach(val => {
        const td = document.createElement("td"); td.innerText = val; tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },

  // ---------- Scoreboard ----------

  createGameBox(game) {
    const table = document.createElement("table");
    table.className   = "game-boxscore";
    table.cellSpacing = 0;
    table.cellPadding = 0;

    const awayScore = game.teams.away.score;
    const homeScore = game.teams.home.score;
    const ls        = game.linescore || {};
    const state     = game.status.abstractGameState || "";
    const det       = game.status.detailedState || "";
    const innings   = ls.innings || [];

    const isSuspended = det.includes("Suspended") || state === "Suspended";
    const isPost      = det.includes("Postponed");
    const isWarmup    = det === "Warmup";
    const isPrev      = state === "Preview";
    const isFin       = state === "Final";
    const live        = !isPrev && !isFin && !isPost && !isWarmup && !isSuspended;
    const show        = !isPrev && !isPost && !isSuspended;

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
      // Use Final and Final/X instead of F / F/X
      statusText = innings.length === 9 ? "Final" : `Final/${innings.length}`;
    } else {
      const st = ls.inningState || "";
      const io = ls.currentInningOrdinal || "";
      statusText = (st + " " + io).trim() || "In Progress";
    }

    // Header row
    const trH = document.createElement("tr");
    const thS = document.createElement("th");
    thS.className = "status-cell";
    thS.innerText = statusText;
    trH.appendChild(thS);
    ["R","H","E"].forEach(lbl => {
      const th = document.createElement("th");
      th.className = "rhe-header";
      th.innerText = lbl;
      trH.appendChild(th);
    });
    table.appendChild(trH);

    const lines = ls.teams || {};
    [game.teams.away, game.teams.home].forEach((t, i) => {
      const tr = document.createElement("tr");
      if (isFin) {
        const awayL = awayScore < homeScore;
        const homeL = homeScore < awayScore;
        if ((i===0 && awayL) || (i===1 && homeL)) tr.classList.add("loser");
      }

      const abbr = ABBREVIATIONS[t.team.name] || t.team.abbreviation || "";
      const tdT  = document.createElement("td");
      tdT.className = "team-cell";
      const img  = document.createElement("img");
      img.src      = this.getLogoUrl(abbr);
      img.alt      = abbr;
      img.className= "logo-cell";
      img.onerror  = () => img.style.display = 'none';
      tdT.appendChild(img);

      const sp    = document.createElement("span");
      sp.className = "abbr";
      sp.innerText = abbr;
      if (this._isHighlighted(abbr)) sp.classList.add("team-highlight");
      if (isFin) sp.classList.add("final");
      tdT.appendChild(sp);
      tr.appendChild(tdT);

      const runVal = show ? t.score : "";
      const hitVal = show
        ? (i===0 ? (lines.away?.hits ?? "") : (lines.home?.hits ?? ""))
        : "";
      const errVal = show
        ? (t.errors != null ? t.errors
            : (i===0 ? (lines.away?.errors ?? "") : (lines.home?.errors ?? "")))
        : "";

      [runVal, hitVal, errVal].forEach(val => {
        const td = document.createElement("td");
        td.className = live ? "rhe-cell live" : "rhe-cell";
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
