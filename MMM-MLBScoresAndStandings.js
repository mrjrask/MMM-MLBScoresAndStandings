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

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:   2 * 60 * 1000,
    updateIntervalStandings:15 * 60 * 1000,
    rotateInterval:         5 * 1000,
    gamesPerPage:           8,
    logoType:               "color",
    position:               "top_right"
  },

  getScripts() {
    return ["moment.js"];
  },

  getStyles() {
    return ["MMM-MLBScoresAndStandings.css"];
  },

  start() {
    this.games         = [];
    this.recordGroups  = [];
    this.divisions     = [];
    this.gamePage      = 0;
    this.divisionPage  = 0;
    this.rotationMode  = "games";
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
      this.recordGroups  = payload;
      this.divisions     = payload.map(r => r.division.name);
      this.divisionPage  = 0;
      this.rotationMode  = this.games.length ? "games" : "standings";
      this.updateDom();
    }
  },

  rotateView() {
    if (this.rotationMode === "games" && this.games.length > this.config.gamesPerPage) {
      this.gamePage = (this.gamePage + 1) % Math.ceil(this.games.length / this.config.gamesPerPage);
      this.updateDom(1000);
      if (this.gamePage === 0) {
        this.rotationMode  = "standings";
        this.divisionPage  = 0;
      }
    } else if (this.rotationMode === "standings" && this.divisions.length > 0) {
      this.divisionPage = (this.divisionPage + 1) % this.divisions.length;
      this.updateDom(1000);
      if (this.divisionPage === 0) {
        this.rotationMode = this.games.length ? "games" : "standings";
      }
    }
  },

  getDom() {
    const wrapper = document.createElement("div");

    // Global header
    const header = document.createElement("h2");
    header.innerText = this.rotationMode === "games" ? "MLB Scores" : "MLB Standings";
    wrapper.appendChild(header);

    if (this.rotationMode === "games") {
      const start   = this.gamePage * this.config.gamesPerPage;
      const slice   = this.games.slice(start, start + this.config.gamesPerPage);
      slice.forEach(game => wrapper.appendChild(this.createGameBox(game)));
    } else {
      const group = this.recordGroups[this.divisionPage];
      wrapper.appendChild(this.createStandingsTable(group));
    }

    return wrapper;
  },

  createGameBox(game) {
    const table = document.createElement("table");
    table.className = "game-boxscore";

    // Title row
    const awayAbbr = ABBREVIATIONS[game.teams.away.team.name];
    const homeAbbr = ABBREVIATIONS[game.teams.home.team.name];
    const titleRow = document.createElement("tr");
    const titleCell= document.createElement("th");
    titleCell.colSpan = 4;
    titleCell.className = "box-title";
    titleCell.innerText = `${awayAbbr} @ ${homeAbbr}`;
    titleRow.appendChild(titleCell);
    table.appendChild(titleRow);

    // Header row (R/H/E)
    const hdr = document.createElement("tr");
    ["", "R", "H", "E"].forEach(lbl => {
      const th = document.createElement("th");
      th.innerText = lbl;
      hdr.appendChild(th);
    });
    table.appendChild(hdr);

    // Away and Home rows
    const linescore = game.linescore?.teams || {};
    [game.teams.away, game.teams.home].forEach(teamData => {
      const row = document.createElement("tr");
      const abbr = ABBREVIATIONS[teamData.team.name];
      const stats = [
        abbr,
        teamData.score || "",
        linescore[teamData.team.id === game.teams.away.team.id ? "away" : "home"]?.hits || "",
        linescore[teamData.team.id === game.teams.away.team.id ? "away" : "home"]?.errors || ""
      ];
      stats.forEach(val => {
        const td = document.createElement("td");
        td.innerText = val;
        row.appendChild(td);
      });
      table.appendChild(row);
    });

    // Footer
    const ftrRow  = document.createElement("tr");
    const ftrCell = document.createElement("td");
    ftrCell.colSpan = 4;
    ftrCell.className = "box-footer";
    const state = game.status.abstractGameState;
    if (state === "Preview") {
      ftrCell.innerText = moment(game.gameDate).local().format("h:mm A");
    } else if (state === "Final") {
      const parts = game.status.detailedState.split("/");
      ftrCell.innerText = parts[1] ? `F/${parts[1]}` : "F";
    } else {
      ftrCell.innerText = game.status.currentInningOrdinal;
    }
    ftrRow.appendChild(ftrCell);
    table.appendChild(ftrRow);

    return table;
  },

  createStandingsTable(group) {
    const container = document.createElement("div");
    // Division header
    const divHeader = document.createElement("h3");
    divHeader.innerText = group.division.name
      .replace("American League","AL")
      .replace("National League","NL");
    container.appendChild(divHeader);

    const table = document.createElement("table");
    table.className = "mlb-standings";

    group.teamRecords.forEach(rec => {
      const abbr = ABBREVIATIONS[rec.team.name];
      const lastTen = rec.records.find(r => r.type === "lastTen")?.summary || "";
      const row = document.createElement("tr");
      row.innerHTML = `
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
      table.appendChild(row);
    });

    container.appendChild(table);
    return container;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
