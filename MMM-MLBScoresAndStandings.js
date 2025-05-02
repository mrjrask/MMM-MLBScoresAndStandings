// MagicMirror Module: MMM-MLBScoresAndStandings

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

if (typeof Module !== "undefined" && Module.register) {
  Module.register("MMM-MLBScoresAndStandings", {
    defaults: { updateIntervalScores:120000, updateIntervalStandings:900000, rotateInterval:5000, gamesPerPage:8, logoType:"color", position:"top_right" },
    getScripts() { return ["moment.js"]; },
    getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

    start() {
      this.games = [];
      this.recordGroups = [];
      this.totalGamePages = 1;
      this.totalStandingsPages = 0;
      this.currentScreen = 0;
      this.sendSocketNotification("INIT", this.config);
      setInterval(() => this.rotateView(), this.config.rotateInterval);
    },

    socketNotificationReceived(notification, payload) {
      if (notification === "GAMES") {
        this.games = payload;
        this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
        this.updateDom();
      }
      if (notification === "STANDINGS") {
        this.recordGroups = payload;
        this.totalStandingsPages = payload.length;
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
      wrapper.classList.add(inGames? 'scores-screen':'standings-screen');

      // Module title
      const header = document.createElement("h2");
      header.className = "module-header";
      header.innerText = inGames ? "MLB Scores" : "MLB Standings";
      wrapper.appendChild(header);

      // On scores screens only, draw hr
      if (inGames) wrapper.appendChild(document.createElement("hr"));

      // No-data fallback
      if (inGames && !this.games.length) return this._noData("No games to display.");
      if (!inGames && !this.totalStandingsPages) return this._noData("Standings unavailable.");

      if (inGames) {
        // two columns of games
        const page = this.currentScreen;
        const start = page * this.config.gamesPerPage;
        const slice = this.games.slice(start, start + this.config.gamesPerPage);
        const grid = document.createElement("div");
        grid.className = "games-columns";
        const perCol = this.config.gamesPerPage / 2;
        for (let i = 0; i < 2; i++) {
          const col = document.createElement("div"); col.className = "game-col";
          slice.slice(i*perCol,(i+1)*perCol).forEach(gm => col.appendChild(this.createGameBox(gm)));
          grid.appendChild(col);
        }
        wrapper.appendChild(grid);
      } else {
        const idx = this.currentScreen - this.totalGamePages;
        wrapper.appendChild(this.createStandingsTable(this.recordGroups[idx]));
      }
      return wrapper;
    },

    _noData(msg) {
      const div = document.createElement("div"); div.innerText = msg; return div;
    },

    createGameBox(game) {
      /* your existing boxscore implementation */
    },

    createStandingsTable(group) {
      // Division title
      const container = document.createElement("div");
      const title = document.createElement("h3");
      title.innerText = group.division.name;
      container.appendChild(title);

      // Table
      const table = document.createElement("table");
      table.className = "mlb-standings";
      // header row
      const hdr = ["","W-L","GB","Streak","L10","Home","Away"];
      const trHdr = document.createElement("tr");
      hdr.forEach(txt => { const th = document.createElement("th"); th.innerText = txt; trHdr.appendChild(th); });
      table.appendChild(trHdr);

      // data rows
      group.teamRecords.forEach(rec => {
        const tr = document.createElement("tr");
        // team cell
        const abbr = ABBREVIATIONS[rec.team.name] || "";
        const tdTeam = document.createElement("td"); tdTeam.className = "team-cell";
        const logo = document.createElement("img"); logo.src = this.getLogoUrl(abbr); logo.className = "logo-cell";
        tdTeam.appendChild(logo);
        const span = document.createElement("span"); span.className = "abbr"; span.innerText = abbr;
        tdTeam.appendChild(span); tr.appendChild(tdTeam);
        // then W-L, GB, etc. as before
        /* ... */
        table.appendChild(tr);
      });

      container.appendChild(table);
      return container;
    },

    getLogoUrl(abbr) {
      return this.file(`logos/${this.config.logoType}/${abbr}.png`);
    }
  });
}
