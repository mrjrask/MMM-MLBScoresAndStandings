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
    gamesPerPage:             16,
    logoType:                 "color",
    rotateIntervalScores:      10 * 1000,
    rotateIntervalEast:         7 * 1000,
    rotateIntervalCentral:     10 * 1000,
    rotateIntervalWest:        12 * 1000,
    timeZone:                "America/Chicago",
    highlightedTeams:       ["CUBS"]
  },

  getHeader() {
    return this.currentScreen < this.totalGamePages ? "MLB Scoreboard" : "MLB Standings";
  },

  getScripts() { return ["moment.js"]; },
  getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

  start() {
    this.games            = [];
    this.recordGroups     = [];
    this.loadedGames      = false;
    this.loadedStandings  = false;
    this.totalGamePages   = 1;
    this.totalStandPairs  = DIVISION_PAIRS.length;
    this.currentScreen    = 0;
    this.rotateTimer      = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config), this.config.updateIntervalScores);
    this._scheduleRotate();
  },

  _scheduleRotate() {
    const showingGames = this.currentScreen < this.totalGamePages;
    let delay;
    if (showingGames) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      switch (idx) {
        case 0: delay = this.config.rotateIntervalEast;    break;
        case 1: delay = this.config.rotateIntervalCentral; break;
        case 2: delay = this.config.rotateIntervalWest;    break;
        default: delay = this.config.rotateIntervalEast;
      }
    }
    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.rotateView();
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.loadedGames      = true;
      this.games            = payload;
      this.totalGamePages   = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings  = true;
      this.recordGroups     = payload;
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
    if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");
    return showingGames ? this._buildGames() : this._buildStandings();
  },

  _noData(msg) {
    const d = document.createElement("div");
    d.innerText = msg;
    return d;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const games = this.games.slice(start, start + this.config.gamesPerPage);
    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";
    const half = Math.ceil(games.length / 2);

    [
      games.slice(0, half),
      games.slice(half)
    ].forEach(column => {
      const colDiv = document.createElement("div");
      colDiv.className = "game-col";
      column.forEach(g => colDiv.appendChild(this.createGameBox(g)));
      wrapper.appendChild(colDiv);
    });

    return wrapper;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const pair = DIVISION_PAIRS[idx];
    const wrapper = document.createElement("div");
    wrapper.className = "standings-pair";
    [pair.nl, pair.al].forEach(id => {
      const grp = this.recordGroups.find(g => g.division.id === id);
      if (grp) {
        const div = document.createElement("div");
        div.className = "standings-division";
        const h3 = document.createElement("h3");
        h3.innerText = DIVISION_LABELS[id];
        h3.style.margin = "0 0 4px 0";
        div.appendChild(h3);
        div.appendChild(this.createStandingsTable(grp));
        wrapper.appendChild(div);
      }
    });
    return wrapper;
  },

  createGameBox(game) {
    const table = document.createElement("table");
    table.className = "game-boxscore";
    table.cellSpacing = 0;
    table.cellPadding = 0;

    const isFin = game.status.abstractGameState === "Final";
    const awayScore = game.teams.away.score;
    const homeScore = game.teams.home.score;

    let statusText;
    // [existing statusText logic here...]
    // omitted for brevity; assume unchanged

    // header row
    const trH = document.createElement("tr");
    const thS = document.createElement("th");
    thS.className = `status-cell ${isFin ? "normal" : "live"}`;
    thS.innerText = statusText;
    trH.appendChild(thS);
    ["R","H","E"].forEach(lbl => {
      const th = document.createElement("th"); th.className = "rhe-header"; th.innerText = lbl; trH.appendChild(th);
    });
    table.appendChild(trH);

    const lines = game.linescore?.teams || {};
    [game.teams.away, game.teams.home].forEach((t, i) => {
      const tr = document.createElement("tr");
      const abbr = ABBREVIATIONS[t.team.name] || "";

      const tdLogo = document.createElement("td");
      tdLogo.className = "team-cell";
      const img = document.createElement("img"); img.src = this.getLogoUrl(abbr); img.className = "logo-cell";
      tdLogo.appendChild(img);
      const span = document.createElement("span"); span.className = "abbr"; span.innerText = abbr;

      if (isFin) {
        const losing = (i === 0 && awayScore < homeScore) || (i === 1 && homeScore < awayScore);
        if (losing) span.classList.add("loser");
      }

      tdLogo.appendChild(span);
      tr.appendChild(tdLogo);

      const show = game.status.abstractGameState !== "Preview";
      const runVal = show ? t.score : "";
      const hitVal = show ? (i === 0 ? (lines.away?.hits || "") : (lines.home?.hits || "")) : "";
      const errVal = show ? (i === 0 ? (lines.away?.errors || "") : (lines.home?.errors || "")) : "";

      [runVal, hitVal, errVal].forEach(val => {
        const td = document.createElement("td");
        td.className = `rhe-cell ${!isFin ? "live" : "normal"}`;
        td.innerText = val;
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },

  createStandingsTable(group) {
    // [unchanged standings code]
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
