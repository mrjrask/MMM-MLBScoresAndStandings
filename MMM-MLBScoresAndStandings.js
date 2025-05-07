/* MMM-MLBScoresAndStandings.js */
/* global Module, moment */

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

const DIVISION_LABELS = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West"
};

const DIVISION_PAIRS = [
  { nl: 204, al: 201 },
  { nl: 205, al: 202 },
  { nl: 203, al: 200 }
];

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:      2 * 60 * 1000,
    updateIntervalStandings:  15 * 60 * 1000,
    rotateIntervalScores:     10 * 1000,
    rotateIntervalStandings:   7 * 1000,
    gamesPerPage:                  16,
    logoType:                  "color"
  },

  getHeader() {
    return this.currentScreen < this.totalGamePages
      ? "MLB Scoreboard"
      : "MLB Standings";
  },

  getScripts() { return ["moment.js"]; },
  getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

  start() {
    this.games           = [];
    this.recordGroups    = [];
    this.loadedGames     = false;
    this.loadedStandings = false;
    this.totalGamePages  = 1;
    this.totalStandPairs = DIVISION_PAIRS.length;
    this.currentScreen   = 0;
    this.rotateTimer     = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config), this.config.updateIntervalScores);
    this._scheduleRotate();
  },

  _scheduleRotate() {
    const showingGames = this.currentScreen < this.totalGamePages;
    const delay = showingGames
      ? this.config.rotateIntervalScores
      : this.config.rotateIntervalStandings;

    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.rotateView();
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

  rotateView() {
    const total = this.totalGamePages + this.totalStandPairs;
    this.currentScreen = (this.currentScreen + 1) % total;
    this.updateDom(1000);
  },

  getDom() {
    const showingGames = this.currentScreen < this.totalGamePages;
    if (showingGames && !this.loadedGames)      return this._noData("Loading...");
    if (!showingGames && !this.loadedStandings) return this._noData("Loading...");
    if (showingGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.recordGroups.length === 0)
      return this._noData("Standings unavailable.");

    return showingGames ? this._buildGames() : this._buildStandings();
  },

  _noData(msg) {
    const div = document.createElement("div");
    div.innerText = msg;
    return div;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const slice = this.games.slice(start, start + this.config.gamesPerPage);
    const grid  = document.createElement("div");
    grid.className = "games-columns";
    const half = this.config.gamesPerPage / 2;

    for (let i = 0; i < 2; i++) {
      const col = document.createElement("div");
      col.className = "game-col";
      slice.slice(i * half, (i + 1) * half)
           .forEach(g => col.appendChild(this.createGameBox(g)));
      grid.appendChild(col);
    }
    return grid;
  },

  _buildStandings() {
    const idx  = this.currentScreen - this.totalGamePages;
    const pair = DIVISION_PAIRS[idx];
    const container = document.createElement("div");
    container.className = "standings-pair";

    [pair.nl, pair.al].forEach(id => {
      const group = this.recordGroups.find(g => g.division.id === id);
      if (group) {
        const div   = document.createElement("div");
        div.className = "standings-division";
        const h3    = document.createElement("h3");
        h3.innerText   = DIVISION_LABELS[id];
        h3.style.margin = "0 0 4px 0";
        div.appendChild(h3);
        div.appendChild(this.createStandingsTable(group));
        container.appendChild(div);
      }
    });

    return container;
  },

  createGameBox(game) {
    const table = document.createElement("table");
    table.className   = "game-boxscore";
    table.cellSpacing = 0;
    table.cellPadding = 0;

    const detailed = game.status.detailedState;
    const isPostp  = detailed.includes("Postponed");
    const isDelay  = detailed.includes("Delay") || detailed.includes("Delayed");
    const isWarmup = detailed === "Warmup";
    const isPrev   = game.status.abstractGameState === "Preview";
    const isFin    = game.status.abstractGameState === "Final";
    const show     = !isPrev && !isPostp && !isDelay && !isWarmup;
    const live     = show && !isFin;
    const cls      = live ? "live" : "normal";

    // status text
    let statusText;
    if (isPostp) {
      statusText = "Postponed";
    } else if (isDelay) {
      statusText = "Delayed";
    } else if (isWarmup) {
      statusText = "Warmup";
    } else if (isPrev) {
      statusText = moment(game.gameDate).local().format("h:mm A");
    } else if (isFin) {
      const inn = (game.linescore?.innings || []).length;
      statusText = inn === 9 ? "F" : `F/${inn}`;
    } else {
      const st   = game.linescore?.inningState          || "";
      const io   = game.linescore?.currentInningOrdinal || "";
      const combo = (st + " " + io).trim();
      statusText = combo.length ? combo : "In Progress";
    }

    // header
    const trH = document.createElement("tr");
    const thS = document.createElement("th");
    thS.className = `status-cell ${cls}`;
    thS.innerText = statusText;
    trH.appendChild(thS);
    ["R","H","E"].forEach(lbl => {
      const th = document.createElement("th");
      th.className = "rhe-header";
      th.innerText = lbl;
      trH.appendChild(th);
    });
    table.appendChild(trH);

    // data rows
    const lines = game.linescore?.teams || {};
    [game.teams.away, game.teams.home].forEach((t, i) => {
      const tr   = document.createElement("tr");
      const abbr = ABBREVIATIONS[t.team.name] || "";

      // team cell
      const tdT = document.createElement("td");
      tdT.className = "team-cell";
      const img = document.createElement("img");
      img.src       = this.getLogoUrl(abbr);
      img.alt       = abbr;
      img.className = "logo-cell";
      tdT.appendChild(img);
      const sp = document.createElement("span");
      sp.className  = "abbr";
      sp.innerText  = abbr;
      tdT.appendChild(sp);
      tr.appendChild(tdT);

      // R/H/E values
      const runs = show ? t.score : "";
      const hits = show
        ? (i === 0 
            ? (lines.away?.hits   ?? "") 
            : (lines.home?.hits   ?? ""))
        : "";
      const errs = show
        ? (i === 0 
            ? (lines.away?.errors ?? "") 
            : (lines.home?.errors ?? ""))
        : "";
      [runs, hits, errs].forEach(v => {
        const td = document.createElement("td");
        td.className = `rhe-cell ${cls}`;
        td.innerText = v;
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },

  createStandingsTable(group) {
    const table = document.createElement("table");
    table.className = "mlb-standings";

    const hdrs = ["","W-L","W%","GB","Streak","L10","Home","Away"];
    const trH  = document.createElement("tr");
    hdrs.forEach(txt => {
      const th = document.createElement("th");
      th.innerText = txt;
      trH.appendChild(th);
    });
    table.appendChild(trH);

    group.teamRecords.forEach(rec => {
      const tr = document.createElement("tr");
      if (rec.team.name === "Chicago Cubs") tr.classList.add("cubs-highlight");

      // team cell
      const tdTeam = document.createElement("td");
      tdTeam.className = "team-cell";
      const ab = ABBREVIATIONS[rec.team.name] || "";
      const img2 = document.createElement("img");
      img2.src       = this.getLogoUrl(ab);
      img2.alt       = ab;
      img2.className = "logo-cell";
      tdTeam.appendChild(img2);
      const sp2 = document.createElement("span");
      sp2.className = "abbr";
      sp2.innerText = ab;
      tdTeam.appendChild(sp2);
      tr.appendChild(tdTeam);

      // W-L & W%
      const lr  = rec.leagueRecord || {};
      const W   = parseInt(lr.wins)   || 0;
      const L   = parseInt(lr.losses) || 0;
      const pct = (W+L>0) ? ((W/(W+L)).toFixed(3).replace(/^0/,"")) : "-";
      [`${W}-${L}`, pct].forEach(val => {
        const td = document.createElement("td");
        td.innerText = val;
        tr.appendChild(td);
      });

      // GB
      let gb = rec.divisionGamesBack;
      if (gb != null && gb !== "-") {
        const f = parseFloat(gb), m = Math.floor(f), r = f-m;
        if      (Math.abs(r)<1e-6) gb = `${m}`;
        else if (r===0.5)          gb = m===0 ? "½" : `${m}½`;
        else                       gb = f.toString();
      }
      const tdGB = document.createElement("td");
      tdGB.innerText = gb;
      tr.appendChild(tdGB);

      // Streak
      const tdSt = document.createElement("td");
      tdSt.innerText = rec.streak?.streakCode || "-";
      tr.appendChild(tdSt);

      // L10 / Home / Away splits
      let l10 = "-";
      const splits = rec.records?.splitRecords || [];
      const s10    = splits.find(s=>s.type.toLowerCase()==="lastten");
      if (s10) l10 = `${s10.wins}-${s10.losses}`;
      const td10 = document.createElement("td");
      td10.innerText = l10; tr.appendChild(td10);

      let hr = "-";
      const sH = splits.find(s=>s.type.toLowerCase()==="home");
      if (sH) hr = `${sH.wins}-${sH.losses}`;
      const tdH = document.createElement("td");
      tdH.innerText = hr; tr.appendChild(tdH);

      let ar = "-";
      const sA = splits.find(s=>s.type.toLowerCase()==="away");
      if (sA) ar = `${sA.wins}-${sA.losses}`;
      const tdA = document.createElement("td");
      tdA.innerText = ar; tr.appendChild(tdA);

      table.appendChild(tr);
    });

    return table;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
