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
    defaults: {
      updateIntervalScores:    2 * 60 * 1000,
      updateIntervalStandings: 15 * 60 * 1000,
      rotateInterval:          5 * 1000,
      gamesPerPage:            8,
      logoType:                "color",
      position:                "top_right"
    },

    getScripts() { return ["moment.js"]; },
    getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

    start() {
      this.games               = [];
      this.recordGroups        = [];
      this.totalGamePages      = 1;
      this.totalStandingsPages = 0;
      this.currentScreen       = 0;
      this.sendSocketNotification("INIT", this.config);
      setInterval(() => this.rotateView(), this.config.rotateInterval);
    },

    socketNotificationReceived(notification, payload) {
      console.log("[MMM-MLBScoresAndStandings] socketNotificationReceived:", notification, payload);
      if (notification === "GAMES") {
        this.games = payload;
        this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
        this.updateDom();
      }
      if (notification === "STANDINGS") {
        this.recordGroups        = payload;
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
      const wrapper = document.createElement("div");
      const header  = document.createElement("h2");
      const inGames = this.currentScreen < this.totalGamePages;
      header.className = "module-header";
      header.innerText = inGames ? "MLB Scores" : "MLB Standings";
      wrapper.appendChild(header);
      wrapper.appendChild(document.createElement("hr"));

      if (inGames && this.games.length === 0) {
        return this._noData("No games to display.");
      }
      if (!inGames && this.totalStandingsPages === 0) {
        return this._noData("Standings unavailable.");
      }

      if (inGames) {
        const page  = this.currentScreen;
        const start = page * this.config.gamesPerPage;
        const slice = this.games.slice(start, start + this.config.gamesPerPage);
        const cols  = document.createElement("div"); cols.className = "games-columns";
        const perCol = this.config.gamesPerPage / 2;
        for (let i = 0; i < 2; i++) {
          const col = document.createElement("div"); col.className = "game-col";
          slice.slice(i * perCol, (i + 1) * perCol).forEach(gm => col.appendChild(this.createGameBox(gm)));
          cols.appendChild(col);
        }
        wrapper.appendChild(cols);
      } else {
        const idx   = this.currentScreen - this.totalGamePages;
        const group = this.recordGroups[idx];
        wrapper.appendChild(this.createStandingsTable(group));
      }
      return wrapper;
    },

    _noData(msg) {
      const div = document.createElement("div"); div.innerText = msg; return div;
    },

    createGameBox(game) {
      /* unchanged boxscore code */
    },

    createStandingsTable(group) {
      console.log("Rendering standings for division:", group.division.name);
      const container = document.createElement("div");
      const header    = document.createElement("h3");
      header.innerText = group.division.name;
      container.appendChild(header);

      const table = document.createElement("table"); table.className = "mlb-standings";
      // Header row
      const trHdr = document.createElement("tr");
      ["","W-L","GB","Streak","L10","Home","Away"].forEach(text => {
        const th = document.createElement("th"); th.innerText = text; trHdr.appendChild(th);
      });
      table.appendChild(trHdr);
      // Data rows
      group.teamRecords.forEach(rec => {
        const tr = document.createElement("tr");
        // Team & logo
        const abbr   = ABBREVIATIONS[rec.team.name] || "";
        const tdTeam = document.createElement("td"); tdTeam.className = "team-cell";
        const img    = document.createElement("img"); img.src = this.getLogoUrl(abbr); img.alt = abbr; img.className = "logo-cell";
        tdTeam.appendChild(img);
        const sp     = document.createElement("span"); sp.className = "abbr"; sp.innerText = abbr;
        tdTeam.appendChild(sp); tr.appendChild(tdTeam);

        // W-L
        const lr  = rec.leagueRecord || {};
        const tdWL = document.createElement("td"); tdWL.innerText = `${lr.wins||"-"}-${lr.losses||"-"}`; tr.appendChild(tdWL);
        // GB
        let gb = rec.divisionGamesBack;
        if (gb != null && gb !== "-") {
          const f = parseFloat(gb), whole = Math.floor(f), frac = f - whole;
          if (Math.abs(frac)<1e-6) gb = `${whole}`;
          else if (Math.abs(frac-0.5)<1e-6) gb = `${whole}½`;
          else gb = f.toString();
        }
        const tdGB = document.createElement("td"); tdGB.innerText = gb; tr.appendChild(tdGB);

        // Streak
        const tdSt = document.createElement("td"); tdSt.innerText = rec.streak?.streakCode||"-"; tr.appendChild(tdSt);
        // L10
        let l10 = "-";
        const splits = rec.records?.splitRecords||[];
        const spL10 = splits.find(s=>s.type.toLowerCase()==="lastten");
        if (spL10) l10 = `${spL10.wins}-${spL10.losses}`;
        const tdL10 = document.createElement("td"); tdL10.innerText = l10; tr.appendChild(tdL10);
        // Home
        let homeRec = "-";
        const spHome = splits.find(s=>s.type.toLowerCase()==="home");
        if (spHome) homeRec = `${spHome.wins}-${spHome.losses}`;
        const tdHome = document.createElement("td"); tdHome.innerText = homeRec; tr.appendChild(tdHome);
        // Away
        let awayRec = "-";
        const spAway = splits.find(s=>s.type.toLowerCase()==="away");
        if (spAway) awayRec = `${spAway.wins}-${spAway.losses}`;
        const tdAway = document.createElement("td"); tdAway.innerText = awayRec; tr.appendChild(tdAway);

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
