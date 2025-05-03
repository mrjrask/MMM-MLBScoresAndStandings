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
      wrapper.classList.add(inGames ? 'scores-screen' : 'standings-screen');

      // Header
      const header = document.createElement("h2");
      header.className = "module-header";
      header.innerText = inGames ? "MLB Scores" : "MLB Standings";
      wrapper.appendChild(header);
      if (inGames) {
        wrapper.appendChild(document.createElement("hr"));
      }

      // No-data
      if (inGames && !this.games.length) {
        return this._noData("No games to display.");
      }
      if (!inGames && !this.totalStandingsPages) {
        return this._noData("Standings unavailable.");
      }

      if (inGames) {
        const page  = this.currentScreen;
        const start = page * this.config.gamesPerPage;
        const slice = this.games.slice(start, start + this.config.gamesPerPage);
        const grid  = document.createElement("div");
        grid.className = "games-columns";
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
        // Show two divisions per screen
        const firstIndex  = idx * 2;
        const secondIndex = firstIndex + 1;
        const pair = document.createElement("div");
        pair.className = "standings-pair";
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
        const ls = game.linescore || {};
        status = ((ls.inningState ? ls.inningState + " " : "") +
                  (ls.currentInningOrdinal || "")).trim() || "In Progress";
      }

      const trH = document.createElement("tr");
      const thS = document.createElement("th"); thS.className = "status-cell"; thS.innerText = status;
      trH.appendChild(thS);
      ["R","H","E"].forEach(lbl => {
        const th = document.createElement("th"); th.className = "rhe-header"; th.innerText = lbl;
        trH.appendChild(th);
      });
      table.appendChild(trH);

      // Data rows: away, home
      const lsTeams = (game.linescore || {}).teams || {};
      [game.teams.away, game.teams.home].forEach((teamData, idx) => {
        const tr = document.createElement("tr");
        // Team cell
        const abbr = ABBREVIATIONS[teamData.team.name] || "";
        const tdT  = document.createElement("td"); tdT.className = "team-cell";
        const img  = document.createElement("img"); img.src = this.getLogoUrl(abbr); img.alt = abbr; img.className = "logo-cell";
        tdT.appendChild(img);
        const sp   = document.createElement("span"); sp.className = "abbr"; sp.innerText = abbr;
        tdT.appendChild(sp);
        tr.appendChild(tdT);

        const isAway = idx === 0;
        const runs   = state !== "Preview" ? teamData.score : "";
        const hits   = state !== "Preview" ? (isAway ? lsTeams.away.hits : lsTeams.home.hits) : "";
        const errs   = state !== "Preview" ? (isAway ? lsTeams.away.errors : lsTeams.home.errors) : "";

        [runs, hits, errs].forEach(val => {
          const td = document.createElement("td"); td.className = "rhe-cell";
          td.innerText = (val != null ? val : ""); tr.appendChild(td);
        });

        table.appendChild(tr);
      });
      return table;
    },

    createStandingsTable(group) {
      console.log("Rendering standings for division:", group.division.name);
      const container = document.createElement("div");
      const title     = document.createElement("h3");
      title.innerText = group.division.name;
      container.appendChild(title);

      const table = document.createElement("table"); table.className = "mlb-standings";
      // Header: blank, W-L, GB, WCGB, Streak, L10, Home, Away
      const headers = ["","W-L","GB","WCGB","Streak","L10","Home","Away"];
      const trHdr = document.createElement("tr");
      headers.forEach(txt => {
        const th = document.createElement("th"); th.innerText = txt; trHdr.appendChild(th);
      });
      table.appendChild(trHdr);

      // Rows
      group.teamRecords.forEach(rec => {
        const tr = document.createElement("tr");
        // Team
        const abbr = ABBREVIATIONS[rec.team.name] || "";
        const tdTeam = document.createElement("td"); tdTeam.className = "team-cell";
        const img    = document.createElement("img"); img.src = this.getLogoUrl(abbr); img.alt = abbr; img.className = "logo-cell";
        tdTeam.appendChild(img);
        const spn = document.createElement("span"); spn.className = "abbr"; spn.innerText = abbr;
        tdTeam.appendChild(spn); tr.appendChild(tdTeam);

        // W-L
        const lr = rec.leagueRecord || {};
        const tdWL = document.createElement("td"); tdWL.innerText = `${lr.wins||"-"}-${lr.losses||"-"}`; tr.appendChild(tdWL);

        // GB
        let gb = rec.divisionGamesBack;
        if (gb != null && gb !== "-") {
          const f1 = parseFloat(gb), w1 = Math.floor(f1), r1 = f1 - w1;
          gb = Math.abs(r1)<1e-6 ? `${w1}` : Math.abs(r1-0.5)<1e-6 ? `${w1}½` : f1.toString();
        }
        const tdGB = document.createElement("td"); tdGB.innerText = gb; tr.appendChild(tdGB);

        // WCGB
        let wc = rec.wildCardGamesBack;
        if (wc != null && wc !== "-") {
          const f2 = parseFloat(wc), w2 = Math.floor(f2), r2 = f2 - w2;
          wc = Math.abs(r2)<1e-6 ? `${w2}` : Math.abs(r2-0.5)<1e-6 ? `${w2}½` : f2.toString();
        }
        const tdWC = document.createElement("td"); tdWC.innerText = wc; tr.appendChild(tdWC);

        // Streak
        const tdSt = document.createElement("td"); tdSt.innerText = rec.streak?.streakCode||"-"; tr.appendChild(tdSt);

        // L10
        let l10 = "-";
        const splits = rec.records?.splitRecords || [];
        const sL10 = splits.find(s=>s.type.toLowerCase()==="lastten"); if(sL10) l10 = `${sL10.wins}-${sL10.losses}`;
        const tdL10 = document.createElement("td"); tdL10.innerText = l10; tr.appendChild(tdL10);

        // Home
        let hRec = "-";
        const sHome = splits.find(s=>s.type.toLowerCase()==="home"); if(sHome) hRec = `${sHome.wins}-${sHome.losses}`;
        const tdH = document.createElement("td"); tdH.innerText = hRec; tr.appendChild(tdH);

        // Away
        let aRec = "-";
        const sAway = splits.find(s=>s.type.toLowerCase()==="away"); if(sAway) aRec = `${sAway.wins}-${sAway.losses}`;
        const tdA = document.createElement("td"); tdA.innerText = aRec; tr.appendChild(tdA);

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
