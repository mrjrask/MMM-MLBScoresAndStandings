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
      updateIntervalScores:    1 * 60 * 1000,
      updateIntervalStandings: 15 * 60 * 1000,
      rotateInterval:          7 * 1000,
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
      console.log("[MMM-MLBScoresAndStandings] start");
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
        this.recordGroups = payload;
        this.totalStandingsPages = payload.length;
        this.updateDom();
      }
    },

    rotateView() {
      const total = this.totalGamePages + this.totalStandingsPages;
      this.currentScreen = (this.currentScreen + 1) % total;
      this.updateDom(1000);
    },

    getDom() {
      const inGames = this.currentScreen < this.totalGamePages;
      const wrapper = document.createElement("div");
      wrapper.classList.add(inGames ? 'scores-screen' : 'standings-screen');

      // Header
      const header = document.createElement("h2");
      header.className = "module-header";
      header.innerText = inGames ? "MLB Scores" : "MLB Standings";
      wrapper.appendChild(header);
      const hr = document.createElement("hr");
      wrapper.appendChild(hr);

      // No-data
      if (inGames && !this.games.length) {
        return this._noData("No games to display.");
      }
      if (!inGames && !this.totalStandingsPages) {
        return this._noData("Standings unavailable.");
      }

      if (inGames) {
        // Games grid: 2 cols, 4 per
        const page = this.currentScreen;
        const start = page * this.config.gamesPerPage;
        const slice = this.games.slice(start, start + this.config.gamesPerPage);
        const grid = document.createElement("div");
        grid.className = "games-columns";
        const perCol = this.config.gamesPerPage / 2;
        for (let i = 0; i < 2; i++) {
          const col = document.createElement("div"); col.className = "game-col";
          slice.slice(i * perCol, (i + 1) * perCol).forEach(gm => col.appendChild(this.createGameBox(gm)));
          grid.appendChild(col);
        }
        wrapper.appendChild(grid);
      } else {
        // Standings screen
        const idx = this.currentScreen - this.totalGamePages;
        wrapper.appendChild(this.createStandingsTable(this.recordGroups[idx]));
      }
      return wrapper;
    },

    _noData(msg) {
      const div = document.createElement("div");
      div.innerText = msg;
      return div;
    },

    createGameBox(game) {
      const table = document.createElement("table");
      table.className   = "game-boxscore";
      table.cellSpacing = 0;
      table.cellPadding = 0;

      // Status row
      const state = game.status.abstractGameState;
      let status = "";
      if (state === "Preview") {
        status = moment(game.gameDate).local().format("h:mm A");
      } else if (state === "Final") {
        const parts = game.status.detailedState.split("/");
        status = parts[1] ? `F/${parts[1]}` : "F";
      } else {
        status = game.status.currentInningOrdinal;
      }
      const trH = document.createElement("tr");
      const thStatus = document.createElement("th");
      thStatus.className = "status-cell";
      thStatus.innerText = status;
      trH.appendChild(thStatus);
      ["R","H","E"].forEach(lbl => {
        const th = document.createElement("th");
        th.className = "rhe-header";
        th.innerText = lbl;
        trH.appendChild(th);
      });
      table.appendChild(trH);

      // Away & Home rows
      const lines = game.linescore?.teams || {};
      [game.teams.away, game.teams.home].forEach((teamData, idx) => {
        const tr = document.createElement("tr");
        // Team cell
        const abbr = ABBREVIATIONS[teamData.team.name] || "";
        const tdTeam = document.createElement("td"); tdTeam.className = "team-cell";
        const logo = document.createElement("img");
        logo.src = this.getLogoUrl(abbr); logo.alt = abbr; logo.className = "logo-cell";
        tdTeam.appendChild(logo);
        const span = document.createElement("span"); span.className = "abbr"; span.innerText = abbr;
        tdTeam.appendChild(span);
        tr.appendChild(tdTeam);
        // R, H, E values
        const isAway = idx === 0;
        const vals = [
          state !== "Preview" ? teamData.score : "",
          isAway ? lines.away?.hits || "" : lines.home?.hits || "",
          isAway ? lines.away?.errors || "" : lines.home?.errors || ""
        ];
        vals.forEach(val => {
          const td = document.createElement("td");
          td.className = "rhe-cell";
          td.innerText = val;
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      return table;
    },

    createStandingsTable(group) {
      console.log("Rendering standings for division:", group.division.name);
      const container = document.createElement("div");
      const title = document.createElement("h3");
      title.innerText = group.division.name;
      container.appendChild(title);

      const table = document.createElement("table");
      table.className = "mlb-standings";

      // Header
      const headers = ["","W-L","GB","Streak","L10","Home","Away"];
      const trHdr = document.createElement("tr");
      headers.forEach(txt => {
        const th = document.createElement("th"); th.innerText = txt;
        trHdr.appendChild(th);
      });
      table.appendChild(trHdr);

      // Rows
      group.teamRecords.forEach(rec => {
        const tr = document.createElement("tr");
        // Team & logo
        const abbr = ABBREVIATIONS[rec.team.name] || "";
        const tdTeam = document.createElement("td"); tdTeam.className = "team-cell";
        const logo = document.createElement("img"); logo.src = this.getLogoUrl(abbr);
        logo.alt = abbr; logo.className = "logo-cell";
        tdTeam.appendChild(logo);
        const sp = document.createElement("span"); sp.className = "abbr"; sp.innerText = abbr;
        tdTeam.appendChild(sp); tr.appendChild(tdTeam);
        // W-L
        const lr = rec.leagueRecord || {};
        const tdWL = document.createElement("td"); tdWL.innerText = `${lr.wins||"-"}-${lr.losses||"-"}`;
        tr.appendChild(tdWL);
        // GB
        let gb = rec.divisionGamesBack;
        if (gb != null && gb !== "-") {
          const f = parseFloat(gb), whole = Math.floor(f), frac = f - whole;
          if (Math.abs(frac) < 1e-6) gb = `${whole}`;
          else if (Math.abs(frac - 0.5) < 1e-6) gb = `${whole}½`;
          else gb = f.toString();
        }
        const tdGB = document.createElement("td"); tdGB.innerText = gb; tr.appendChild(tdGB);
        // Streak
        const tdSt = document.createElement("td"); tdSt.innerText = rec.streak?.streakCode || "-";
        tr.appendChild(tdSt);
        // L10
        let l10 = "-";
        const splits = rec.records?.splitRecords || [];
        const spL10 = splits.find(s => s.type.toLowerCase() === "lastten");
        if (spL10) l10 = `${spL10.wins}-${spL10.losses}`;
        const tdL10 = document.createElement("td"); tdL10.innerText = l10; tr.appendChild(tdL10);
        // Home
        let homeRec = "-";
        const spHome = splits.find(s => s.type.toLowerCase() === "home");
        if (spHome) homeRec = `${spHome.wins}-${spHome.losses}`;
        const tdHome = document.createElement("td"); tdHome.innerText = homeRec;
        tr.appendChild(tdHome);
        // Away
        let awayRec = "-";
        const spAway = splits.find(s => s.type.toLowerCase() === "away");
        if (spAway) awayRec = `${spAway.wins}-${spAway.losses}`;
        const tdAway = document.createElement("td"); tdAway.innerText = awayRec;
        tr.appendChild(tdAway);

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
