// MMM-MLBScoresAndStandings.js

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

if (typeof Module !== "undefined" && Module.register) {
  Module.register("MMM-MLBScoresAndStandings", {
    defaults: {
      updateIntervalScores:    2 * 60 * 1000,
      updateIntervalStandings: 15 * 60 * 1000,
      rotateInterval:          7 * 1000,
      gamesPerPage:            8,
      logoType:                "color",
      showWildCardGamesBack:   false,
      position:                "top_right"
    },

    getScripts() { return ["moment.js"]; },
    getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

    start() {
      this.games               = [];
      this.recordGroups        = [];
      this.loadedGames         = false;
      this.loadedStandings     = false;
      this.totalGamePages      = 1;
      this.totalStandingsPages = 0;
      this.currentScreen       = 0;
      this.sendSocketNotification("INIT", this.config);
      // retry fetching games every updateIntervalScores even if failed
      setInterval(() => this.sendSocketNotification("INIT", this.config), this.config.updateIntervalScores);
      setInterval(() => this.rotateView(), this.config.rotateInterval);
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
        this.recordGroups        = payload;
        this.totalStandingsPages = Math.ceil(this.recordGroups.length / 2);
        this.updateDom();
      }
    },

    rotateView() {
      const totalScreens = this.totalGamePages + this.totalStandingsPages;
      this.currentScreen = (this.currentScreen + 1) % totalScreens;
      this.updateDom(1000);
    },

    getDom() {
      const inGames = this.currentScreen < this.totalGamePages;
      const wrapper = document.createElement("div");
      wrapper.classList.add(inGames ? "scores-screen" : "standings-screen");

      // Header
      const header = document.createElement("h2");
      header.className = "module-header";
      header.innerText = inGames ? "MLB Scores" : "MLB Standings";
      wrapper.appendChild(header);
      if (inGames) wrapper.appendChild(document.createElement("hr"));

      // Loading state
      if (inGames && !this.loadedGames) {
        return this._noData("Loading...");
      }
      if (!inGames && !this.loadedStandings) {
        return this._noData("Loading...");
      }
      
      // No data after load
      if (inGames && this.loadedGames && this.games.length === 0) {
        return this._noData("No games to display.");
      }
      if (!inGames && this.loadedStandings && this.recordGroups.length === 0) {
        return this._noData("Standings unavailable.");
      }

      if (inGames) {
        const page  = this.currentScreen;
        const start = page * this.config.gamesPerPage;
        const slice = this.games.slice(start, start + this.config.gamesPerPage);
        const grid  = document.createElement("div"); grid.className = "games-columns";
        const perCol = this.config.gamesPerPage / 2;
        for (let i = 0; i < 2; i++) {
          const col = document.createElement("div"); col.className = "game-col";
          slice.slice(i * perCol, (i + 1) * perCol)
               .forEach(gm => col.appendChild(this.createGameBox(gm)));
          grid.appendChild(col);
        }
        wrapper.appendChild(grid);
      } else {
        const idx = this.currentScreen - this.totalGamePages;
        const firstIndex  = idx;
        const secondIndex = idx + this.totalStandingsPages;
        const pair = document.createElement("div"); pair.className = "standings-pair";
        pair.appendChild(this.createStandingsTable(this.recordGroups[firstIndex]));
        pair.appendChild(this.createStandingsTable(this.recordGroups[secondIndex]));
        wrapper.appendChild(pair);
      }
      return wrapper;
    },

    _noData(msg) {
      const div = document.createElement("div");
      div.innerText = msg;
      return div;
    },

    createGameBox(game) {
      // existing createGameBox code unchanged...
    },

    createStandingsTable(group) {
      // existing createStandingsTable code unchanged...
    },

    getLogoUrl(abbr) {
      return this.file(`logos/${this.config.logoType}/${abbr}.png`);
    }
  });
}
