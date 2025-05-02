// MagicMirror Module: MMM-MLBScoresAndStandings
const ABBREVIATIONS = {
  "Chicago Cubs": "CUBS",      "Atlanta Braves": "ATL",
  "Miami Marlins": "MIA",       "New York Mets": "NYM",
  "Philadelphia Phillies": "PHI","Washington Nationals": "WAS",
  "Cincinnati Reds": "CIN",     "Milwaukee Brewers": "MIL",
  "Pittsburgh Pirates": "PIT",  "St. Louis Cardinals": "STL",
  "Arizona Diamondbacks": "ARI","Colorado Rockies": "COL",
  "Los Angeles Dodgers": "LAD","San Diego Padres": "SD",
  "San Francisco Giants": "SF", "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS",      "New York Yankees": "NYY",
  "Tampa Bay Rays": "TB",       "Toronto Blue Jays": "TOR",
  "Chicago White Sox": "SOX",   "Cleveland Guardians": "CLE",
  "Detroit Tigers": "DET",      "Kansas City Royals": "KC",
  "Minnesota Twins": "MIN",     "Houston Astros": "HOU",
  "Los Angeles Angels": "LAA",  "Athletics": "ATH",
  "Seattle Mariners": "SEA",    "Texas Rangers": "TEX"
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

    getScripts() {
      return ["moment.js"];
    },

    getStyles() {
      return ["MMM-MLBScoresAndStandings.css"];
    },

    start() {
      this.games        = [];
      this.recordGroups = [];
      this.divisions    = [];
      this.gamePage     = 0;
      this.divisionPage = 0;
      this.rotationMode = "games";
      this.sendSocketNotification("INIT");
      setInterval(() => this.rotateView(), this.config.rotateInterval);
    },

    socketNotificationReceived(notification, payload) {
      console.log(
        "[MMM-MLBScoresAndStandings] received",
        notification,
        "payload length:",
        Array.isArray(payload) ? payload.length : payload
      );
      if (notification === "GAMES") {
        this.games        = payload;
        this.gamePage     = 0;
        this.rotationMode = "games";
        this.updateDom();
      }
      if (notification === "STANDINGS") {
        this.recordGroups  = payload;
        this.divisions     = payload.map(r => r.division.name);
        this.divisionPage  = 0;
        this.rotationMode  = this.games.length ? "games" : "standings";
        this.updateDom();
      }
    },

    rotateView() {
      if (
        this.rotationMode === "games" &&
        this.games.length > this.config.gamesPerPage
      ) {
        this.gamePage = (this.gamePage + 1) % Math.ceil(
          this.games.length / this.config.gamesPerPage
        );
        this.updateDom(1000);
        if (this.gamePage === 0) {
          this.rotationMode  = "standings";
          this.divisionPage  = 0;
        }
      } else if (
        this.rotationMode === "standings" &&
        this.divisions.length
      ) {
        this.divisionPage = (this.divisionPage + 1) % this.divisions.length;
        this.updateDom(1000);
        if (this.divisionPage === 0) {
          this.rotationMode =
            this.games.length ? "games" : "standings";
        }
      }
    },

    getDom() {
      console.log(
        "[MMM-MLBScoresAndStandings] getDom – mode:",
        this.rotationMode,
        "games:",
        this.games.length,
        "divisions:",
        this.divisions.length
      );

      const wrapper = document.createElement("div");
      const header  = document.createElement("h2");
      header.className = "module-header";
      header.innerText =
        this.rotationMode === "games"
          ? "MLB Scores"
          : "MLB Standings";
      wrapper.appendChild(header);
      wrapper.appendChild(document.createElement("hr"));

      // No-data fallbacks
      if (
        this.rotationMode === "games" &&
        this.games.length === 0
      ) {
        const msg = document.createElement("div");
        msg.innerText = "No games to display.";
        wrapper.appendChild(msg);
        return wrapper;
      }
      if (
        this.rotationMode === "standings" &&
        this.divisions.length === 0
      ) {
        const msg = document.createElement("div");
        msg.innerText = "Standings unavailable.";
        wrapper.appendChild(msg);
        return wrapper;
      }

      if (this.rotationMode === "games") {
        const start     = this.gamePage * this.config.gamesPerPage;
        const slice     = this.games.slice(
          start,
          start + this.config.gamesPerPage
        );
        const colWrapper = document.createElement("div");
        colWrapper.className = "games-columns";
        const perCol = this.config.gamesPerPage / 2;
        for (let i = 0; i < 2; i++) {
          const col = document.createElement("div");
          col.className = "game-col";
          slice
            .slice(i * perCol, (i + 1) * perCol)
            .forEach(gm => col.appendChild(this.createGameBox(gm)));
          colWrapper.appendChild(col);
        }
        wrapper.appendChild(colWrapper);

      } else {
        const group = this.recordGroups[this.divisionPage];
        wrapper.appendChild(this.createStandingsTable(group));
      }

      return wrapper;
    },

    createGameBox(game) {
      const table = document.createElement("table");
      table.className   = "game-boxscore";
      table.border      = "1";
      table.cellSpacing = "0";
      table.cellPadding = "2";

      // Title row
      const awayAbbr = ABBREVIATIONS[
        game.teams.away.team.name
      ]||"";
      const homeAbbr = ABBREVIATIONS[
        game.teams.home.team.name
      ]||"";
      const state    = game.status.abstractGameState;
      let timeText;
      if (state === "Preview") {
        timeText = moment(game.gameDate)
          .local()
          .format("h:mm A");
      } else if (state === "Final") {
        const parts = game.status.detailedState.split("/");
        timeText = parts[1]
          ? `F/${parts[1]}`
          : "F";
      } else {
        timeText = game.status.currentInningOrdinal;
      }

      // title + logos + time
      const trTitle = document.createElement("tr");
      const thMain  = document.createElement("th");
      thMain.colSpan   = 3;
      thMain.className = "box-title";
      thMain.innerHTML = `
        <span class="abbr">${awayAbbr}</span>
        <img src="${this.getLogoUrl(awayAbbr)}" class="logo-cell" alt="${awayAbbr}" />
         @
        <span class="abbr">${homeAbbr}</span>
        <img src="${this.getLogoUrl(homeAbbr)}" class="logo-cell" alt="${homeAbbr}" />
      `;
      const thTime = document.createElement("th");
      thTime.className = "box-time";
      thTime.innerText = timeText;
      trTitle.appendChild(thMain);
      trTitle.appendChild(thTime);
      table.appendChild(trTitle);

      // Header row (R/H/E)
      const trHdr = document.createElement("tr");
      ["", "R", "H", "E"].forEach(lbl => {
        const th = document.createElement("th");
        th.innerText = lbl;
        trHdr.appendChild(th);
      });
      table.appendChild(trHdr);

      // Data rows
      const lines = game.linescore?.teams || {};
      [game.teams.away, game.teams.home].forEach(teamData => {
        const tr = document.createElement("tr");
        const isAway = teamData.team.id === game.teams.away.team.id;
        const abbr   = ABBREVIATIONS[teamData.team.name]||"";
        const score  = state !== "Preview"
          ? teamData.score
          : "";
        const hits   = isAway
          ? lines.away?.hits || ""
          : lines.home?.hits || "";
        const errs   = isAway
          ? lines.away?.errors || ""
          : lines.home?.errors || "";

        [abbr, score, hits, errs].forEach(val => {
          const td = document.createElement("td");
          td.innerText = val;
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });

      return table;
    },

    createStandingsTable(group) {
      const container = document.createElement("div");
      const h3 = document.createElement("h3");
      h3.innerText = group.division.name;
      container.appendChild(h3);

      const table = document.createElement("table");
      table.className = "mlb-standings";

      group.teamRecords.forEach(rec => {
        const abbr    = ABBREVIATIONS[rec.team.name]||"";
        const lastTen = rec.records.find(r => r.type==="lastTen")
          ?.summary || "";
        const tr      = document.createElement("tr");
        tr.innerHTML = `
          <td class="team-cell">
            <img src="${this.getLogoUrl(abbr)}" alt="${abbr}" />
            <span class="abbr">${abbr}</span>
          </td>
          <td>${rec.leagueRecord.wins}-${rec.leagueRecord.losses}</td>
          <td>${rec.divisionGamesBack}</td>
          <td>${rec.wildCardGamesBack}</td>
          <td>${rec.streak.streakCode}</td>
          <td>${lastTen}</td>
        `;
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
