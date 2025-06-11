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

// Single and paired division ordering (IDs)
const SINGLE_STAND_ORDER = [205, 202, 204, 201, 203, 200];   // NL Central, AL Central, NL East, AL East, NL West, AL West
const PAIR_STAND_ORDER   = [ [205,202], [204,201], [203,200] ]; // [NL&AL Central], [NL&AL East], [NL&AL West]
const DIVISION_LABELS = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West"
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
    standingsPerPage:                2,          // 1 or 2 divisions per page
    rotateIntervalStandingsSingle:   7   * 1000, // when standingsPerPage = 1
    timeZone:                   "America/Chicago",
    highlightedTeams:               [],
    showTitle:                     true      // set false to hide header
  },

  getHeader() {
    if (!this.config.showTitle) return null;
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
    this.totalStandPages = this.config.standingsPerPage === 2
      ? PAIR_STAND_ORDER.length
      : SINGLE_STAND_ORDER.length;
    this.currentScreen   = 0;
    this.rotateTimer     = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(
      () => this.sendSocketNotification("INIT", this.config),
      Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings)
    );
    this._scheduleRotate();
  },

  _scheduleRotate() {
    const totalScreens = this.totalGamePages + this.totalStandPages;
    let delay;

    if (this.currentScreen < this.totalGamePages) {
      delay = this.config.rotateIntervalScores;
    } else {
      // standings
      const idx = this.currentScreen - this.totalGamePages;
      if (this.config.standingsPerPage === 1) {
        delay = this.config.rotateIntervalStandingsSingle;
      } else {
        // pair order: central, east, west
        const intervals = [
          this.config.rotateIntervalCentral,
          this.config.rotateIntervalEast,
          this.config.rotateIntervalWest
        ];
        delay = intervals[idx] || this.config.rotateIntervalEast;
      }
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
    let groupsToShow = [];

    if (this.config.standingsPerPage === 2) {
      const pair = PAIR_STAND_ORDER[idx] || [];
      groupsToShow = pair;
    } else {
      const singleId = SINGLE_STAND_ORDER[idx];
      groupsToShow = singleId !== undefined ? [singleId] : [];
    }

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

  // ... createGameBox, createStandingsTable, getLogoUrl stay unchanged ...
  createGameBox(game) {
    // existing implementation unchanged
    const table = document.createElement("table");
    // [rest of the code unchanged]
    // (copy from original)
    return table;
  },

  createStandingsTable(group) {
    // existing implementation unchanged
    const table = document.createElement("table");
    // [rest of the code unchanged]
    return table;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
