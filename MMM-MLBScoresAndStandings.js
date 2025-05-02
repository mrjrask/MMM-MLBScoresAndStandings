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
      rotateInterval:          5 * 1000,  // advance every 5s
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
      if (notification === "GAMES") {
        this.games        = payload;
        this.gamePage     = 0;
        this.rotationMode = "games";
        this.updateDom();
      }
      if (notification === "STANDINGS") {
        this.recordGroups = payload;
        this.divisions    = payload.map(r => r.division.name);
        this.divisionPage = 0;
        // If there are no upcoming games, start directly with standings
        if (this.games.length === 0) {
          this.rotationMode = "standings";
        }
        this.updateDom();
      }
    },

    rotateView() {
      const totalGamePages = Math.ceil(this.games.length / this.config.gamesPerPage) || 1;
      if (this.rotationMode === "games") {
        if (this.gamePage < totalGamePages - 1) {
          this.gamePage++;
        } else {
          this.rotationMode  = "standings";
          this.divisionPage  = 0;
        }
        this.updateDom(1000);
      } else if (this.rotationMode === "standings") {
        if (this.divisionPage < this.divisions.length - 1) {
          this.divisionPage++;
        } else {
          this.rotationMode = "games";
          this.gamePage     = 0;
        }
        this.updateDom(1000);
      }
    },

    getDom() {
      const wrapper = document.createElement("div");

      // Header + separator
      const header = document.createElement("h2");
      header.className = "module-header";
      header.innerText = this.rotationMode === "games" ? "MLB Scores" : "MLB Standings";
      wrapper.appendChild(header);
      wrapper.appendChild(document.createElement("hr"));

      // No-data fallback
      if (this.rotationMode === "games" && this.games.length === 0) {
        const msg = document.createElement("div");
        msg.innerText = "No games to display.";
        wrapper.appendChild(msg);
        return wrapper;
      }
      if (this.rotationMode === "standings" && this.divisions.length === 0) {
        const msg = document.createElement("div");
        msg.innerText = "Standings unavailable.";
        wrapper.appendChild(msg);
        return wrapper;
      }

      if (this.rotationMode === "games") {
        // Two columns, 4 box scores each
        const start     = this.gamePage * this.config.gamesPerPage;
        const slice     = this.games.slice(start, start + this.config.gamesPerPage);
        const colWrapper = document.createElement("div");
        colWrapper.className = "games-columns";
        const perCol    = this.config.gamesPerPage / 2;
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
        // Standings for a single division
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

      // Determine the status text (start time / inning / final)
      const state = game.status.abstractGameState;
      let timeText = "";
      if (state === "Preview") {
        timeText = moment(game.gameDate).local().format("h:mm A");
      } else if (state === "Final") {
        const parts = game.status.detailedState.split("/");
        timeText = parts[1] ? `F/${parts[1]}` : "F";
      } else {
        timeText = game.status.currentInningOrdinal;
      }

      // Row 1: header with time / R / H / E
      const trHdr = document.createElement("tr");
      const thTime = document.createElement("th");
      thTime.className = "status-cell";
      thTime.innerText = timeText;
      trHdr.appendChild(thTime);
      ["R","H","E"].forEach(lbl => {
        const th = document.createElement("th");
        th.className = "rhe-header";
        th.innerText = lbl;
        trHdr.appendChild(th);
      });
      table.appendChild(trHdr);

      // Data rows for Away and Home
      const lines = game.linescore?.teams || {};
      [game.teams.away, game.teams.home].forEach((teamData, idx) => {
        const tr = document.createElement("tr");

        // Column 1: logo + abbreviation
        const tdTeam = document.createElement("td");
        tdTeam.className = "team-cell";
        const abbr = ABBREVIATIONS[teamData.team.name] || "";
        const img = document.createElement("img");
        img.src       = this.getLogoUrl(abbr);
        img.alt       = abbr;
        img.className = "logo-cell";
        const span    = document.createElement("span");
        span.className = "abbr";
        span.innerText = abbr;
        tdTeam.appendChild(img);
        tdTeam.appendChild(span);
        tr.appendChild(tdTeam);

        // Columns 2–4: R, H, E values
        const isAway = idx === 0;
        const score  = state !== "Preview" ? teamData.score : "";
        const hits   = isAway ? lines.away?.hits || "" : lines.home?.hits || "";
        const errs   = isAway ? lines.away?.errors || "" : lines.home?.errors || "";
        [score, hits, errs].forEach(val => {
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
      const container = document.createElement("div");
      const h3 = document.createElement("h3");
      h3.innerText = group.division.name;
      container.appendChild(h3);

      const table = document.createElement("table");
      table.className = "mlb-standings";

      group.teamRecords.forEach(rec => {
        const abbr    = ABBREVIATIONS[rec.team.name] || "";
        const lastTen = rec.records.find(r => r.type === "lastTen")?.summary || "";
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
