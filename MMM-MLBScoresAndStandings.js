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
    updateIntervalScores:    2 * 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,
    rotateInterval:          7 * 1000,
    gamesPerPage:            8,
    logoType:                "color"
  },

  getScripts() {
    return ["moment.js"];
  },

  getStyles() {
    return ["MMM-MLBScoresAndStandings.css"];
  },

  start() {
    this.games               = [];
    this.recordGroups        = [];
    this.loadedGames         = false;
    this.loadedStandings     = false;
    this.totalGamePages      = 1;
    this.totalStandingsPages = DIVISION_PAIRS.length;
    this.currentScreen       = 0;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config), this.config.updateIntervalScores);
    setInterval(() => this.rotateView(), this.config.rotateInterval);
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
    const total = this.totalGamePages + this.totalStandingsPages;
    this.currentScreen = (this.currentScreen + 1) % total;
    this.updateDom(1000);
  },

  getDom() {
    const showingGames = this.currentScreen < this.totalGamePages;
    const wrapper = document.createElement("div");
    wrapper.classList.add(showingGames ? "scores-screen" : "standings-screen");

    // Title bar
    const header = document.createElement("h2");
    header.className = "module-header";
    header.innerText = showingGames ? "MLB Scoreboard" : "MLB Standings";
    wrapper.appendChild(header);
    wrapper.appendChild(document.createElement("hr"));

    // Loading / No data
    if (showingGames && !this.loadedGames) return this._noData("Loading...");
    if (!showingGames && !this.loadedStandings) return this._noData("Loading...");
    if (showingGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

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
      slice.slice(i * half, (i + 1) * half).forEach(g => col.appendChild(this.createGameBox(g)));
      grid.appendChild(col);
    }
    return grid;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const pair = DIVISION_PAIRS[idx];
    const container = document.createElement("div");
    container.className = "standings-pair";

    [pair.nl, pair.al].forEach(id => {
      const group = this.recordGroups.find(g => g.division.id === id);
      if (group) {
        const div = document.createElement("div");
        div.className = "standings-division";
        const title = document.createElement("h3");
        title.innerText = DIVISION_LABELS[id] || group.division.name || "";
        div.appendChild(title);
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

    const s     = game.status.abstractGameState;
    const postp = s === "Postponed" || game.status.detailedState.includes("Postponed");
    const prevw = s === "Preview";
    const finn  = s === "Final";
    const show  = !prevw && !postp;
    const live  = show && !finn;
    const cls   = live ? "live" : "normal";

    let statusText = "";
    if (postp) {
      statusText = "Ppd";
    } else if (prevw) {
      statusText = moment(game.gameDate).local().format("h:mm A");
    } else if (finn) {
      const innings = (game.linescore?.innings || []).length;
      statusText = innings === 9 ? "F" : `F/${innings}`;
    } else {
      statusText = (
        (game.linescore?.inningState ? game.linescore.inningState + " " : "") +
        (game.linescore?.currentInningOrdinal || "")
      ).trim() || "In Progress";
    }

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

    const lines = game.linescore?.teams || {};
    [game.teams.away, game.teams.home].forEach((t, i) => {
      const tr = document.createElement("tr");
      const abbr = ABBREVIATIONS[t.team.name] || "";
      const tdT  = document.createElement("td");
      tdT.className = "team-cell";
      const img  = document.createElement("img");
      img.src       = this.getLogoUrl(abbr);
      img.alt       = abbr;
      img.className = "logo-cell";
      tdT.appendChild(img);
      const sp      = document.createElement("span");
      sp.className  = "abbr";
      sp.innerText  = abbr;
      tdT.appendChild(sp);
      tr.appendChild(tdT);

      const runs = show ? t.score : "";
      const hits = show ? (i === 0 ? lines.away.hits : lines.home.hits) : "";
      const errs = show ? (i === 0 ? lines.away.errors : lines.home.errors) : "";
      [runs, hits, errs].forEach(v => {
        const td = document.createElement("td");
        td.className = `rhe-cell ${cls}`;
        td.innerText = v != null ? v : "";
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },

  createStandingsTable(group) {
    const table = document.createElement("table");
    table.className = "mlb-standings";
    const headers = ["","W-L","W%","GB","Streak","L10","Home","Away"];
    const trHd = document.createElement("tr");
    headers.forEach(txt => {
      const th = document.createElement("th");
      th.innerText = txt;
      trHd.appendChild(th);
    });
    table.appendChild(trHd);

    group.teamRecords.forEach(rec => {
      const tr = document.createElement("tr");
      if (rec.team.name === "Chicago Cubs") tr.classList.add("cubs-highlight");

      const tdTeam = document.createElement("td");
      tdTeam.className = "team-cell";
      const ab = ABBREVIATIONS[rec.team.name] || "";
      const img = document.createElement("img");
      img.src       = this.getLogoUrl(ab);
      img.alt       = ab;
      img.className = "logo-cell";
      tdTeam.appendChild(img);
      const span = document.createElement("span");
      span.className = "abbr";
      span.innerText = ab;
      tdTeam.appendChild(span);
      tr.appendChild(tdTeam);

      const lr  = rec.leagueRecord || {};
      const w   = parseInt(lr.wins) || 0;
      const l   = parseInt(lr.losses) || 0;
      const pct = (w + l > 0) ? ((w/(w+l)).toFixed(3).replace(/^0/,"")) : "-";
      [ `${w}-${l}`, pct ].forEach(val => {
        const td = document.createElement("td");
        td.innerText = val;
        tr.appendChild(td);
      });

      let gb = rec.divisionGamesBack;
      if (gb != null && gb !== "-") {
        const f = parseFloat(gb), m = Math.floor(f), r = f - m;
        gb = Math.abs(r) < 1e-6 ? `${m}` : r === 0.5 ? `${m}½` : f.toString();
      }
      const tdGB = document.createElement("td");
      tdGB.innerText = gb;
      tr.appendChild(tdGB);

      const tdSt = document.createElement("td");
      tdSt.innerText = rec.streak?.streakCode || "-";
      tr.appendChild(tdSt);

      let l10 = "-";
      const splits = rec.records?.splitRecords || [];
      const s10    = splits.find(s => s.type.toLowerCase() === "lastten");
      if (s10) l10 = `${s10.wins}-${s10.losses}`;
      const tdL10 = document.createElement("td");
      tdL10.innerText = l10;
      tr.appendChild(tdL10);

      let hr = "-";
      const sH = splits.find(s => s.type.toLowerCase() === "home");
      if (sH) hr = `${sH.wins}-${sH.losses}`;
      const tdHome = document.createElement("td");
      tdHome.innerText = hr;
      tr.appendChild(tdHome);

      let ar = "-";
      const sA = splits.find(s => s.type.toLowerCase() === "away");
      if (sA) ar = `${sA.wins}-${sA.losses}`;
      const tdAway = document.createElement("td");
      tdAway.innerText = ar;
      tr.appendChild(tdAway);

      table.appendChild(tr);
    });

    return table;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
