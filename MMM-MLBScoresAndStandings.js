/* MMM-MLBScoresAndStandings.js */
/* global Module */

const ABBREVIATIONS = {
  "Chicago Cubs": "CUBS", "Atlanta Braves": "ATL", "Miami Marlins": "MIA",
  "New York Mets": "NYM", "Philadelphia Phillies": "PHI", "Washington Nationals": "WAS",
  "Cincinnati Reds": "CIN", "Milwaukee Brewers": "MIL", "Pittsburgh Pirates": "PIT",
  "St. Louis Cardinals": "STL", "Arizona Diamondbacks": "ARI", "Colorado Rockies": "COL",
  "Los Angeles Dodgers": "LAD", "San Diego Padres": "SD", "San Francisco Giants": "SF",
  "Baltimore Orioles": "BAL", "Boston Red Sox": "BOS", "New York Yankees": "NYY",
  "Tampa Bay Rays": "TB", "Toronto Blue Jays": "TOR", "Chicago White Sox": "SOX",
  "Cleveland Guardians": "CLE", "Detroit Tigers": "DET", "Kansas City Royals": "KC",
  "Minnesota Twins": "MIN", "Houston Astros": "HOU", "Los Angeles Angels": "LAA",
  "Athletics": "ATH", "Seattle Mariners": "SEA", "Texas Rangers": "TEX"
};

const SINGLE_STAND_ORDER = [205, 202, 204, 201, 203, 200];
const PAIR_STAND_ORDER = [[205, 202], [204, 201], [203, 200]];
const DIVISION_LABELS = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores: 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,
    gamesPerPage: 8,
    logoType: "color",
    rotateIntervalScores: 15000,
    rotateIntervalEast: 7000,
    rotateIntervalCentral: 12000,
    rotateIntervalWest: 7000,
    standingsPerPage: 2,
    rotateIntervalStandingsSingle: 7000,
    timeZone: "America/Chicago",
    highlightedTeams: [],
    showTitle: true
  },

  getHeader() {
    if (!this.config.showTitle) return null;
    return this.currentScreen < this.totalGamePages ? "MLB Scoreboard" : "MLB Standings";
  },

  getScripts() {
    return ["https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"];
  },

  getStyles() {
    return ["MMM-MLBScoresAndStandings.css"];
  },

  start() {
    this.games = [];
    this.recordGroups = [];
    this.loadedGames = false;
    this.loadedStandings = false;
    this.totalGamePages = 1;
    this.totalStandPages = this.config.standingsPerPage === 2 ? PAIR_STAND_ORDER.length : SINGLE_STAND_ORDER.length;
    this.currentScreen = 0;
    this.rotateTimer = null;

    console.log("📺 MMM-MLBScoresAndStandings started");
    this.sendSocketNotification("INIT", this.config);

    setInterval(() => {
      this.sendSocketNotification("INIT", this.config);
    }, Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings));

    this._scheduleRotate();
  },

  _scheduleRotate() {
    const totalScreens = this.totalGamePages + this.totalStandPages;
    let delay;

    if (this.currentScreen < this.totalGamePages) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      delay = this.config.standingsPerPage === 1
        ? this.config.rotateIntervalStandingsSingle
        : [this.config.rotateIntervalCentral, this.config.rotateIntervalEast, this.config.rotateIntervalWest][idx] || this.config.rotateIntervalEast;
    }

    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % (this.totalGamePages + this.totalStandPages);
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

  getDom() {
    const wrapper = document.createElement("div");
    const showingGames = this.currentScreen < this.totalGamePages;
    wrapper.className = showingGames ? "scores-screen" : "standings-screen";

    if (showingGames && !this.loadedGames) {
      wrapper.innerText = "Loading games...";
      return wrapper;
    }
    if (!showingGames && !this.loadedStandings) {
      wrapper.innerText = "Loading standings...";
      return wrapper;
    }

    const content = showingGames ? this._buildGames() : this._buildStandings();
    wrapper.appendChild(content);
    return wrapper;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const games = this.games.slice(start, start + this.config.gamesPerPage);

    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";

    const half = Math.ceil(games.length / 2);
    const columns = [games.slice(0, half), games.slice(half)];

    columns.forEach(colGames => {
      const col = document.createElement("div");
      col.className = "game-col";
      colGames.forEach(game => col.appendChild(this.createGameBox(game)));
      wrapper.appendChild(col);
    });

    return wrapper;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const groupsToShow = this.config.standingsPerPage === 2 ? PAIR_STAND_ORDER[idx] || [] : [SINGLE_STAND_ORDER[idx]].filter(Boolean);

    const wrapper = document.createElement("div");
    wrapper.className = this.config.standingsPerPage === 1 ? "standings-single" : "standings-pair tighter-gap";

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
    const isDelayed = game.status.detailedState === "Delayed";

    const live = !isPrev && !isFin && !isPostp && !isWarmup && !isDelayed;
    const show = !isPrev && !isPostp;

    let statusText = "";
    if (isPostp) {
      statusText = "Postponed";
    } else if (isWarmup) {
      statusText = "Warmup";
    } else if (isPrev) {
      statusText = new Date(game.gameDate).toLocaleTimeString("en-US", {
        timeZone: this.config.timeZone,
        hour12: true,
        hour: "numeric",
        minute: "2-digit"
      });
    } else if (isFin) {
      statusText = "Final";
    } else if (isDelayed) {
      statusText = "Delayed";
    } else {
      const st = ls.inningState || "";
      const io = ls.currentInningOrdinal || "";
      statusText = `${st} ${io}`.trim();
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
      const errVal = show ? (t.errors != null ? t.errors : (i === 0 ? (lines.away?.errors ?? "") : (lines.home?.errors ?? ""))) : "";

      [runVal, hitVal, errVal].forEach(val => {
        const td = document.createElement("td");
        td.className = (live || isWarmup) ? "rhe-cell live" : "rhe-cell";
        td.innerText = val;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    return table;
  }
});
