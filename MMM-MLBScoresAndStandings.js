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
    this.totalStandPages = this.config.standingsPerPage === 2
      ? PAIR_STAND_ORDER.length
      : SINGLE_STAND_ORDER.length;
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
        : [
            this.config.rotateIntervalCentral,
            this.config.rotateIntervalEast,
            this.config.rotateIntervalWest
          ][idx] || this.config.rotateIntervalEast;
    }

    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % totalScreens;
      this.updateDom(1000);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    console.log("⬅️  Received notification:", notification);

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

    wrapper.innerText = showingGames
      ? `Loaded ${this.games.length} games.`
      : `Loaded ${this.recordGroups.length} standings groups.`;

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
}
});
