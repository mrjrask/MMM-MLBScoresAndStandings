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
  { nl: 204, al: 201 },  // East
  { nl: 205, al: 202 },  // Central
  { nl: 203, al: 200 }   // West
];

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:     1 * 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,
    gamesPerPage:            8,
    logoType:                "color",
    rotateIntervalScores:    15 * 1000,
    rotateIntervalEast:       7 * 1000,
    rotateIntervalCentral:   12 * 1000,
    rotateIntervalWest:      7 * 1000,
    timeZone:               "America/Chicago",
    highlightedTeams:       ["CUBS"]
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

    // Initial fetch
    this.sendSocketNotification("INIT", this.config);
    // Schedule game fetch
    setInterval(
      () => this.sendSocketNotification("INIT", this.config),
      this.config.updateIntervalScores
    );
    // Schedule standings fetch
    setInterval(
      () => this.sendSocketNotification("INIT", this.config),
      this.config.updateIntervalStandings
    );

    // Kick off rotation
    this._scheduleRotate();
  },

  _scheduleRotate() {
    const total = this.totalGamePages + this.totalStandPairs;
    const showingGames = this.currentScreen < this.totalGamePages;
    let delay;
    if (showingGames) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      const intervals = [
        this.config.rotateIntervalEast,
        this.config.rotateIntervalCentral,
        this.config.rotateIntervalWest
      ];
      delay = intervals[idx] || this.config.rotateIntervalScores;
    }

    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % total;
      this.updateDom(1000);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.loadedGames    = true;
      this.games          = payload;
      this.totalGamePages = Math.max(
        1,
        Math.ceil(this.games.length / this.config.gamesPerPage)
      );
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings = true;
      this.recordGroups    = payload;
      this.updateDom();
    }
  },

  getDom() {
    const wrapper = document.createElement("div");
    const showingGames = this.currentScreen < this.totalGamePages;
    wrapper.className = showingGames ? "scores-screen" : "standings-screen";

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
    const games = this.games.slice(start, start + this.config.gamesPerPage);
    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";

    const half = Math.ceil(games.length / 2);
    [ games.slice(0, half), games.slice(half) ].forEach(colGames => {
      const colDiv = document.createElement("div");
      colDiv.className = "game-col";
      colGames.forEach(game => colDiv.appendChild(this.createGameBox(game)));
      wrapper.appendChild(colDiv);
    });

    return wrapper;
  },

  _buildStandings() {
    const idx  = this.currentScreen - this.totalGamePages;
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
    /* existing createGameBox implementation unchanged */
  },

  createStandingsTable(group) {
    /* existing createStandingsTable implementation unchanged */
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
