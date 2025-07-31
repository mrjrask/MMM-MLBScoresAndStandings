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

const SINGLE_STAND_ORDER = [205, 202, 204, 201, 203, 200];
const PAIR_STAND_ORDER = [ [205,202], [204,201], [203,200] ];
const DIVISION_LABELS = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores: 1 * 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,
    gamesPerPage: 8,
    logoType: "color",
    rotateIntervalScores: 15 * 1000,
    rotateIntervalEast: 7 * 1000,
    rotateIntervalCentral: 12 * 1000,
    rotateIntervalWest: 7 * 1000,
    standingsPerPage: 2,
    rotateIntervalStandingsSingle: 7 * 1000,
    timeZone: "America/Chicago",
    highlightedTeams: [],
    showTitle: true
  },

  getHeader() {
    if (!this.config.showTitle) return null;
    return this.currentScreen < this.totalGamePages ? "MLB Scoreboard" : "MLB Standings";
  },

  getScripts() { return ["moment.js"]; },
  getStyles() { return ["MMM-MLBScoresAndStandings.css"]; },

  start() {
    this.games = [];
    this.recordGroups = [];
    this.loadedGames = false;
    this.loadedStandings = false;
    this.totalGamePages = 1;
    this.totalStandPages = this.config.standingsPerPage === 2
      ? PAIR_STAND_ORDER.length
      : SINGLE_STAND_ORDER.length;
    this.currentScreen = 0;
    this.rotateTimer = null;
    this._cubsLogoToggle = Date.now();

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config),
      Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings));
    this._scheduleRotate();
  },

  _scheduleRotate() {
    const totalScreens = this.totalGamePages + this.totalStandPages;
    let delay = this.config.rotateIntervalScores;
    if (this.currentScreen >= this.totalGamePages) {
      const idx = this.currentScreen - this.totalGamePages;
      delay = this.config.standingsPerPage === 1
        ? this.config.rotateIntervalStandingsSingle
        : [this.config.rotateIntervalCentral, this.config.rotateIntervalEast, this.config.rotateIntervalWest][idx] || this.config.rotateIntervalEast;
    }
    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % totalScreens;
      this.updateDom(1000);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.loadedGames = true;
      this.games = payload;
      this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings = true;
      this.recordGroups = payload;
      this.updateDom();
    }
  },

  _noData(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "small dimmed";
    wrapper.innerText = msg;
    return wrapper;
  },

  getDom() {
    const wrapper = document.createElement("div");
    const showingGames = this.currentScreen < this.totalGamePages;
    wrapper.className = showingGames ? "scores-screen" : "standings-screen";
    if (showingGames && !this.loadedGames) return this._noData("Loading...");
    if (!showingGames && !this.loadedStandings) return this._noData("Loading...");
    if (showingGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");
    const content = showingGames ? this._buildGames() : this._buildStandings();
    if (this.data.position === "fullscreen_above") {
      const container = document.createElement("div");
      container.className = "mlb-fullscreen-center";
      container.appendChild(content);
      wrapper.appendChild(container);
    } else {
      wrapper.appendChild(content);
    }
    return wrapper;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const games = this.games.slice(start, start + this.config.gamesPerPage);
    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";
    const half = Math.ceil(games.length / 2);
    [games.slice(0, half), games.slice(half)].forEach(col => {
      const colDiv = document.createElement("div");
      colDiv.className = "game-col";
      col.forEach(game => colDiv.appendChild(this.createGameBox(game)));
      wrapper.appendChild(colDiv);
    });
    return wrapper;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const groupsToShow = this.config.standingsPerPage === 2
      ? PAIR_STAND_ORDER[idx] || []
      : [SINGLE_STAND_ORDER[idx]].filter(Boolean);
    const wrapper = document.createElement("div");
    wrapper.className = this.config.standingsPerPage === 1 ? "standings-single" : "standings-pair";
    groupsToShow.forEach(divId => {
      const group = this.recordGroups.find(g => g.division.id === divId);
      if (group) {
        const div = document.createElement("div");
        div.className = "standings-division";
        const h3 = document.createElement("h3");
        h3.innerText = DIVISION_LABELS[divId];
        h3.style.margin = "0 0 4px 0";
        div.appendChild(h3);
        div.appendChild(this.createStandingsTable(group));
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
    const awayScore = game.teams.away.score;
    const homeScore = game.teams.home.score;
    const ls = game.linescore || {};
    const isPrev = game.status.abstractGameState === "Preview";
    const isFin = game.status.abstractGameState === "Final";
    const isPostp = game.status.detailedState.includes("Postponed");
    const isWarmup = game.status.detailedState === "Warmup";
    const live = !isPrev && !isFin && !isPostp && !isWarmup;
    const show = !isPrev && !isPostp;

    let statusText = "In Progress";
    if (isPostp) statusText = "Postponed";
    else if (isWarmup) statusText = "Warmup";
    else if (isPrev) {
      statusText = new Date(game.gameDate).toLocaleTimeString("en-US", {
        timeZone: this.config.timeZone,
        hour12: true,
        hour: "numeric",
        minute: "2-digit"
      });
    } else if (isFin) {
      const innings = (ls.innings || []).length;
      statusText = innings === 9 ? "F" : `F/${innings}`;
    } else {
      const st = ls.inningState || "";
      const io = ls.currentInningOrdinal || "";
      if ((st + " " + io).trim()) statusText = (st + " " + io).trim();
    }

    const trH = document.createElement("tr");
    const thS = document.createElement("th");
    thS.className = "status-cell";
    thS.innerText = statusText;
    trH.appendChild(thS);
    ["R", "H", "E"].forEach(lbl => {
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
        if ((i === 0 && awayL) || (i === 1 && homeL)) tr.classList.add("loser");
      }
      const abbr = ABBREVIATIONS[t.team.name] || "";
      const tdT = document.createElement("td");
      tdT.className = "team-cell";
      const img = document.createElement("img");
      img.src = this.getLogoUrl(abbr, game);
      img.alt = abbr;
      img.className = "logo-cell";
      tdT.appendChild(img);
      const sp = document.createElement("span");
      sp.className = "abbr";
      sp.innerText = abbr;
      if (this.config.highlightedTeams.includes(abbr)) sp.classList.add("team-highlight");
      if (isFin) sp.classList.add("final");
      tdT.appendChild(sp);
      tr.appendChild(tdT);

      const runVal = show ? t.score : "";
      const hitVal = show ? (i === 0 ? (lines.away?.hits ?? "") : (lines.home?.hits ?? "")) : "";
      const errVal = show
        ? (t.errors != null ? t.errors : (i === 0 ? (lines.away?.errors ?? "") : (lines.home?.errors ?? "")))
        : "";

      [runVal, hitVal, errVal].forEach(val => {
        const td = document.createElement("td");
        td.className = (live || isWarmup) ? "rhe-cell live" : "rhe-cell";
        td.innerText = val;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    return table;
  },

  getLogoUrl(abbr, game = null) {
    if (abbr === "CUBS" && game && game.status.abstractGameState === "Final" &&
        this.config.highlightedTeams.length === 1 &&
        this.config.highlightedTeams[0] === "CUBS") {
      const isCubsHome = game.teams.home.team.name === "Chicago Cubs";
      const cubsScore = isCubsHome ? game.teams.home.score : game.teams.away.score;
      const oppScore = isCubsHome ? game.teams.away.score : game.teams.home.score;
      const isWin = cubsScore > oppScore;
      const flag = isWin ? "W_flag" : "L_flag";
      const toggle = Math.floor((Date.now() - this._cubsLogoToggle) / 2000) % 2 === 1;
      const file = toggle ? flag : "CUBS";
      return this.file(`logos/${this.config.logoType}/${file}.png`);
    }
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
