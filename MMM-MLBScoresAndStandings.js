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
    pageInterval: 5 * 1000,        // rotate every 5s
    gamesPerPage: 8,
    logoType: 'color',             // 'color' or 'bw'
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

    // Module header
    const header = document.createElement("h2");
    header.innerText = this.rotationMode === 'games' ? "MLB Scores" : "MLB Standings";
    wrapper.appendChild(header);

    if (this.rotationMode === 'games') {
      wrapper.appendChild(this.createGamesTable());
    } else {
      wrapper.appendChild(this.createStandingsTable());
    }

    return wrapper;
  },

  createGamesTable() {
    const table = document.createElement("table");
    table.className = "mlb-games";
    const startIdx = this.gamePage * this.config.gamesPerPage;
    const pageGames = this.games.slice(startIdx, startIdx + this.config.gamesPerPage);

    pageGames.forEach(game => {
      const { status } = game;
      const { abstractGameState: state, detailedState, currentInningOrdinal } = status;
      const hasStarted = (state === 'In Progress' || state === 'Final');
      const startTimeCT = moment(game.gameDate).local().format("h:mm A");
      let displayStatus = '';

      if (!hasStarted) {
        displayStatus = startTimeCT;
      } else if (state === 'Final') {
        const parts = detailedState.split("/");
        displayStatus = parts[1] ? `F/${parts[1]}` : "F";
      } else {
        displayStatus = currentInningOrdinal;
      }

      const { team: homeTeam, score: homeScore } = game.teams.home;
      const { team: awayTeam, score: awayScore } = game.teams.away;
      const homeAbbr = ABBREVIATIONS[homeTeam.name] || '';
      const awayAbbr = ABBREVIATIONS[awayTeam.name] || '';

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="team-cell">
          <img src="${this.getLogoUrl(homeAbbr)}" alt="${homeAbbr}" />
          <span class="abbr">${homeAbbr}</span>
        </td>
        <td class="score-cell">${hasStarted ? homeScore : ''}</td>
        <td class="dash-cell">${hasStarted ? '–' : ''}</td>
        <td class="score-cell">${hasStarted ? awayScore : ''}</td>
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
    const divHeader = document.createElement("h3");
    divHeader.innerText = divisionName;
    container.appendChild(divHeader);

    const table = document.createElement("table");
    table.className = "mlb-standings";

    this.standings
      .filter(rec => rec.division.name === divisionName)
      .forEach(rec => {
        const abbr = ABBREVIATIONS[rec.team.name] || '';
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

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  },

  divisions: [
    "NL East","NL Central","NL West",
    "AL East","AL Central","AL West"
  ]
});
