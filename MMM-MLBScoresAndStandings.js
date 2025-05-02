const ABBREVIATIONS = {
  "Chicago Cubs": "CUBS", "Atlanta Braves": "ATL",  "Miami Marlins": "MIA",
  "New York Mets": "NYM",   "Philadelphia Phillies": "PHI", "Washington Nationals": "WAS",
  "Cincinnati Reds": "CIN","Milwaukee Brewers": "MIL",  "Pittsburgh Pirates": "PIT",
  "St. Louis Cardinals": "STL","Arizona Diamondbacks": "ARI","Colorado Rockies": "COL",
  "Los Angeles Dodgers": "LAD","San Diego Padres": "SD",  "San Francisco Giants": "SF",
  "Baltimore Orioles": "BAL","Boston Red Sox": "BOS",     "New York Yankees": "NYY",
  "Tampa Bay Rays": "TB",  "Toronto Blue Jays": "TOR",    "Chicago White Sox": "SOX",
  "Cleveland Guardians": "CLE","Detroit Tigers": "DET",  "Kansas City Royals": "KC",
  "Minnesota Twins": "MIN","Houston Astros": "HOU",       "Los Angeles Angels": "LAA",
  "Athletics": "ATH",      "Seattle Mariners": "SEA",     "Texas Rangers": "TEX"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores: 2 * 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,
    pageInterval: 20 * 1000,
    gamesPerPage: 8,
    logoType: 'color', // 'color' or 'bw'
    position: "top_right"
  },

  getScripts() {
    return ["moment.js"];
  },

  getStyles() {
    return ["MMM-MLBScoresAndStandings.css"];
  },

  start() {
    this.games = [];
    this.standings = [];
    this.gamePage = 0;
    this.divisionPage = 0;
    this.rotationMode = 'games';
    this.sendSocketNotification("INIT");

    setInterval(() => this.rotateView(), this.config.pageInterval);
  },

  rotateView() {
    if (this.rotationMode === 'games' && this.games.length > this.config.gamesPerPage) {
      this.gamePage = (this.gamePage + 1) % Math.ceil(this.games.length / this.config.gamesPerPage);
      this.updateDom(1000);
      if (this.gamePage === 0) this.rotationMode = 'standings';
    } else {
      this.divisionPage = (this.divisionPage + 1) % this.divisions.length;
      this.updateDom(1000);
      if (this.divisionPage === 0) this.rotationMode = 'games';
    }
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.games = payload;
      this.gamePage = 0;
      this.rotationMode = 'games';
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.standings = payload;
      this.divisionPage = 0;
      this.updateDom();
    }
  },

  getDom() {
    const wrapper = document.createElement("div");
    if (this.rotationMode === 'games') {
      return this.createGamesTable();
    } else {
      return this.createStandingsTable();
    }
  },

  createGamesTable() {
    const table = document.createElement("table");
    table.className = "mlb-games";
    const startIndex = this.gamePage * this.config.gamesPerPage;
    const pageGames = this.games.slice(startIndex, startIndex + this.config.gamesPerPage);

    pageGames.forEach(game => {
      const status = game.status;
      const state = status.abstractGameState;
      const hasStarted = state === 'In Progress' || state === 'Final';
      const startTimeCT = moment(game.gameDate).tz('America/Chicago').format("h:mm A");
      let displayStatus = '';

      if (!hasStarted) {
        displayStatus = startTimeCT;
      } else if (state === 'Final') {
        const parts = status.detailedState.split("/");
        displayStatus = parts[1] ? `F/${parts[1]}` : "F";
      } else {
        displayStatus = status.currentInningOrdinal;
      }

      const home = game.teams.home;
      const away = game.teams.away;
      const homeAbbr = ABBREVIATIONS[home.team.name];
      const awayAbbr = ABBREVIATIONS[away.team.name];

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="team-cell">
          <img src="${this.getLogoUrl(homeAbbr)}" alt="${homeAbbr}" />
          <span class="abbr">${homeAbbr}</span>
        </td>
        <td class="score-cell">${hasStarted ? home.score : ''}</td>
        <td class="dash-cell">${hasStarted ? '–' : ''}</td>
        <td class="score-cell">${hasStarted ? away.score : ''}</td>
        <td class="team-cell">
          <img src="${this.getLogoUrl(awayAbbr)}" alt="${awayAbbr}" />
          <span class="abbr">${awayAbbr}</span>
        </td>
        <td class="status-cell">${displayStatus}</td>
      `;
      table.appendChild(row);
    });

    return table;
  },

  createStandingsTable() {
    const divisionName = this.divisions[this.divisionPage];
    const container = document.createElement("div");
    const header = document.createElement("h3");
    header.innerText = divisionName;
    container.appendChild(header);

    const table = document.createElement("table");
    table.className = "mlb-standings";

    this.standings
      .filter(rec => rec.division.name === divisionName)
      .forEach(rec => {
        const abbr = ABBREVIATIONS[rec.team.name];
        const l10 = (rec.records.find(r => r.type === 'lastTen') || {}).summary || '–';
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="team-cell">
            <img src="${this.getLogoUrl(abbr)}" alt="${abbr}" />
            <span class="abbr">${abbr}</span>
          </td>
          <td>${rec.wins}-${rec.losses}</td>
          <td>${rec.divisionGamesBack || '–'}</td>
          <td>${rec.wildCardGamesBack || '–'}</td>
          <td>${rec.streak.streakCode}</td>
          <td>${l10}</td>
        `;
        table.appendChild(row);
      });

    container.appendChild(table);
    return container;
  },

  // Build URL to local logo file
  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  },

  divisions: [
    "NL East","NL Central","NL West",
    "AL East","AL Central","AL West"
  ]
});
