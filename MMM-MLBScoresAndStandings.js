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
      this.games               = [];
      this.recordGroups        = [];
      this.totalGamePages      = 1;
      this.totalStandingsPages = 0;
      this.currentScreen       = 0;

      // initialize helper
      this.sendSocketNotification("INIT", this.config);

      // rotate every rotateInterval (5s)
      setInterval(() => this.rotateView(), this.config.rotateInterval);
    },

    socketNotificationReceived(notification, payload) {
      console.log(`[MMM] received ${notification}:`, payload.length);
      if (notification === "GAMES") {
        this.games = payload;
        this.totalGamePages = Math.max(
          1,
          Math.ceil(this.games.length / this.config.gamesPerPage)
        );
        console.log("[MMM] totalGamePages=", this.totalGamePages);
        // reset to start of game pages
        this.currentScreen = 0;
        this.updateDom();
      }
      if (notification === "STANDINGS") {
        this.recordGroups        = payload;
        this.totalStandingsPages = payload.length;
        console.log(
          "[MMM] totalStandingsPages=",
          this.totalStandingsPages
        );
        // after games finished, jump into standings
        this.currentScreen = this.totalGamePages;
        this.updateDom();
      }
    },

    rotateView() {
      const totalScreens =
        this.totalGamePages + this.totalStandingsPages;
      this.currentScreen = (this.currentScreen + 1) % totalScreens;
      this.updateDom(1000);
    },

    getDom() {
      const wrapper = document.createElement("div");
      const header  = document.createElement("h2");
      header.className = "module-header";

      const inGames = this.currentScreen < this.totalGamePages;
      header.innerText = inGames ? "MLB Scores" : "MLB Standings";
      wrapper.appendChild(header);
      wrapper.appendChild(document.createElement("hr"));

      // fallback
      if (inGames && this.games.length === 0) {
        return this._noData("No games to display.");
      }
      if (!inGames && this.totalStandingsPages === 0) {
        return this._noData("Standings unavailable.");
      }

      if (inGames) {
        const page  = this.currentScreen;
        const start = page * this.config.gamesPerPage;
        const slice = this.games.slice(
          start,
          start + this.config.gamesPerPage
        );
        const cols = document.createElement("div");
        cols.className = "games-columns";
        const perCol = this.config.gamesPerPage / 2;
        for (let i = 0; i < 2; i++) {
          const col = document.createElement("div");
          col.className = "game-col";
          slice
            .slice(i * perCol, (i + 1) * perCol)
            .forEach(gm => col.appendChild(this.createGameBox(gm)));
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
      const no = document.createElement("div");
      no.innerText = msg;
      return no;
    },

    createGameBox(game) {
      const table = document.createElement("table");
      table.className   = "game-boxscore";
      table.cellSpacing = "0";
      table.cellPadding = "0";
      table.border      = "0";

      // status text
      const state = game.status.abstractGameState;
      let statusText = "";
      if (state === "Preview") {
        statusText = moment(game.gameDate)
          .local()
          .format("h:mm A");
      } else if (state === "Final") {
        const parts = game.status.detailedState.split("/");
        statusText = parts[1] ? `F/${parts[1]}` : "F";
      } else {
        statusText = game.status.currentInningOrdinal;
      }

      // header row
      const trH = document.createElement("tr");
      const thTime = document.createElement("th");
      thTime.className = "status-cell";
      thTime.innerText = statusText;
      trH.appendChild(thTime);
      ["R", "H", "E"].forEach(lbl => {
        const th = document.createElement("th");
        th.className = "rhe-header";
        th.innerText = lbl;
        trH.appendChild(th);
      });
      table.appendChild(trH);

      // data rows
      const lines = game.linescore?.teams || {};
      [game.teams.away, game.teams.home].forEach((td, idx) => {
        const tr = document.createElement("tr");
        // team cell
        const abbr = ABBREVIATIONS[td.team.name] || "";
        const tdTeam = document.createElement("td");
        tdTeam.className = "team-cell";
        const img = document.createElement("img");
        img.src       = this.getLogoUrl(abbr);
        img.alt       = abbr;
        img.className = "logo-cell";
        tdTeam.appendChild(img);
        const sp = document.createElement("span");
        sp.className = "abbr";
        sp.innerText = abbr;
        tdTeam.appendChild(sp);
        tr.appendChild(tdTeam);

        // R/H/E values
        const isAway = idx === 0;
        const vals = [
          state !== "Preview" ? td.score : "",
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
      const container = document.createElement("div");
      const h3 = document.createElement("h3");
      h3.innerText = group.division.name;
      container.appendChild(h3);
      const table = document.createElement("table");
      table.className = "mlb-standings";
      group.teamRecords.forEach(rec => {
        const abbr = ABBREVIATIONS[rec.team.name] || "";
        const lastTen = rec.records.find(r => r.type === "lastTen")
          ?.summary || "";
        const tr = document.createElement("tr");
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
