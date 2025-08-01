/* MMM-MLBScoresAndStandings.js */
/* global Module */

const ABBREVIATIONS = {
  "Chicago Cubs": "CUBS", "Atlanta Braves": "ATL", "Miami Marlins": "MIA",
  "New York Mets": "NYM", "Philadelphia Phillies": "PHI", "Washington Nationals": "WAS",
  "Cincinnati Reds": "CIN", "Milwaukee Brewers": "MIL", "Pittsburgh Pirates": "PIT",
  "St. Louis Cardinals": "STL", "Arizona Diamondbacks": "ARI", "Colorado Rockies": "COL",
  "Los Angeles Dodgers": "LAD", "San Diego Padres": "SD", "San Francisco Giants": "SF",
  "Baltimore Orioles": "BAL", "Boston Red Sox": "BOS", "New York Yankees": "NYY",
  "Tampa Bay Rays": "TB", "Toronto Blue Jays": "TOR", "Chicago White Sox": "SOX",
  "Cleveland Guardians": "CLE", "Detroit Tigers": "DET", "Kansas City Royals": "KC",
  "Minnesota Twins": "MIN", "Houston Astros": "HOU", "Los Angeles Angels": "LAA",
  "Athletics": "ATH", "Seattle Mariners": "SEA", "Texas Rangers": "TEX"
};

const SINGLE_STAND_ORDER = [205, 202, 204, 201, 203, 200];
const PAIR_STAND_ORDER   = [[205, 202], [204, 201], [203, 200]];
const DIVISION_LABELS    = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:        60000,
    updateIntervalStandings:     15 * 60000,
    gamesPerPage:                8,
    logoType:                    "color",
    rotateIntervalScores:        15000,
    rotateIntervalEast:          7000,
    rotateIntervalCentral:       12000,
    rotateIntervalWest:          7000,
    standingsPerPage:            2,
    rotateIntervalStandingsSingle: 7000,
    timeZone:                    "America/Chicago",
    highlightedTeams:            [],
    showTitle:                   true
  },

  getHeader() {
    if (!this.config.showTitle) return null;
    return this.currentScreen < this.totalGamePages ? "MLB Scoreboard" : "MLB Standings";
  },

  getScripts() {
    return ["https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"];
  },

  getStyles() {
    return ["MMM-MLBScoresAndStandings.css"];
  },

  start() {
    this.games             = [];
    this.recordGroups      = [];
    this.loadedGames       = false;
    this.loadedStandings   = false;
    this.totalGamePages    = 1;
    this.totalStandPages   = this.config.standingsPerPage === 2
                                ? PAIR_STAND_ORDER.length
                                : SINGLE_STAND_ORDER.length;
    this.currentScreen     = 0;
    this.rotateTimer       = null;

    console.log("📺 MMM-MLBScoresAndStandings started");
    this.sendSocketNotification("INIT", this.config);

    setInterval(() => {
      this.sendSocketNotification("INIT", this.config);
    }, Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings));

    this._scheduleRotate();
  },

  _scheduleRotate() {
    const totalScreens = this.totalGamePages + this.totalStandPages;
    let delay;

    if (this.currentScreen < this.totalGamePages) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      delay = this.config.standingsPerPage === 1
        ? this.config.rotateIntervalStandingsSingle
        : [this.config.rotateIntervalCentral, this.config.rotateIntervalEast, this.config.rotateIntervalWest][idx] || this.config.rotateIntervalEast;
    }

    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % totalScreens;
      this.updateDom(1000);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.loadedGames    = true;
      this.games          = payload;
      this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings = true;
      this.recordGroups     = payload;
      this.updateDom();
    }
  },

  getDom() {
    const wrapper    = document.createElement("div");
    const showingGames = this.currentScreen < this.totalGamePages;
    wrapper.className = showingGames ? "scores-screen" : "standings-screen";

    if (showingGames && !this.loadedGames) {
      wrapper.innerText = "Loading games...";
      return wrapper;
    }
    if (!showingGames && !this.loadedStandings) {
      wrapper.innerText = "Loading standings...";
      return wrapper;
    }

    const content = showingGames
      ? this._buildGames()
      : this._buildStandings();
    wrapper.appendChild(content);
    return wrapper;
  },

  _buildGames() {
    const start   = this.currentScreen * this.config.gamesPerPage;
    const games   = this.games.slice(start, start + this.config.gamesPerPage);
    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";

    const half    = Math.ceil(games.length / 2);
    const columns = [games.slice(0, half), games.slice(half)];

    columns.forEach(colGames => {
      const col = document.createElement("div");
      col.className = "game-col";
      colGames.forEach(game => {
        col.appendChild(this.createGameBox(game));
      });
      wrapper.appendChild(col);
    });

    return wrapper;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const divIdsToShow = this.config.standingsPerPage === 2
      ? PAIR_STAND_ORDER[idx] || []
      : [SINGLE_STAND_ORDER[idx]].filter(Boolean);

    const wrapper = document.createElement("div");
    wrapper.className = this.config.standingsPerPage === 1
      ? "standings-single"
      : "standings-pair tighter-gap";

    divIdsToShow.forEach(divId => {
      const group = this.recordGroups.find(g => g.division.id === divId);
      if (group) {
        const div = document.createElement("div");
        div.className = "standings-division";
        const h3  = document.createElement("h3");
        h3.innerText = DIVISION_LABELS[divId];
        h3.style.margin = "0 0 4px 0";
        div.appendChild(h3);
        div.appendChild(this.createStandingsTable(group));
        wrapper.appendChild(div);
      }
    });

    return wrapper;
  },

  /* --------------------------------------------------------------------
     NEW: Creates a <table> for a single game's boxscore
  ---------------------------------------------------------------------*/
  createGameBox(game) {
    const table      = document.createElement("table");
    table.className  = "game-boxscore";

    const awayRuns   = game.linescore?.teams?.away?.runs   ?? 0;
    const homeRuns   = game.linescore?.teams?.home?.runs   ?? 0;
    const awayHits   = game.linescore?.teams?.away?.hits   ?? "";
    const homeHits   = game.linescore?.teams?.home?.hits   ?? "";
    const awayErrors = game.linescore?.teams?.away?.errors ?? "";
    const homeErrors = game.linescore?.teams?.home?.errors ?? "";

    ["away", "home"].forEach(teamType => {
      const tr = document.createElement("tr");

      // Team + logo
      const tdTeam = document.createElement("td");
      tdTeam.className = "team-cell";
      const abbr = ABBREVIATIONS[game.teams[teamType].team.name]
        || game.teams[teamType].team.abbreviation;
      const img = document.createElement("img");
      img.className = "logo-cell";
      img.src = this.file(`images/${abbr}.png`);
      tdTeam.appendChild(img);
      const span = document.createElement("span");
      span.className = "abbr";
      span.innerText = abbr;
      if (this.config.highlightedTeams.includes(abbr)) {
        span.classList.add("team-highlight");
      }
      tdTeam.appendChild(span);
      tr.appendChild(tdTeam);

      // Status (Top/Bottom/Nothing/Final)
      const tdStatus = document.createElement("td");
      tdStatus.className = "status-cell";
      if (game.status.abstractGameState === "Live") {
        tdStatus.innerText = `${game.linescore.inningState} ${game.linescore.currentInningOrdinal}`;
        tdStatus.classList.add("live");
      } else if (game.status.abstractGameState === "Final") {
        tdStatus.innerText = "Final";
      }
      tr.appendChild(tdStatus);

      // R/H/E cells
      const vals = (teamType === "away")
        ? [awayRuns, awayHits, awayErrors]
        : [homeRuns, homeHits, homeErrors];
      vals.forEach(v => {
        const td = document.createElement("td");
        td.className = `rhe-cell${game.status.abstractGameState === "Live" ? " live" : ""}`;
        td.innerText = v;
        tr.appendChild(td);
      });

      // Dim the loser in a final game
      if (game.status.abstractGameState === "Final") {
        const loser = awayRuns === homeRuns
          ? null
          : awayRuns > homeRuns ? "home" : "away";
        if (loser === teamType) {
          tr.classList.add("loser");
        }
      }

      table.appendChild(tr);
    });

    return table;
  },

  /* --------------------------------------------------------------------
     NEW: Creates a <table> for one division's standings
  ---------------------------------------------------------------------*/
  createStandingsTable(group) {
    const table      = document.createElement("table");
    table.className  = "mlb-standings";

    // Header
    const thead     = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["#", "", "W", "L", "PCT", "GB", "L10", "HOME", "AWAY"].forEach(h => {
      const th = document.createElement("th");
      th.innerText = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    group.teamRecords.forEach(rec => {
      const tr = document.createElement("tr");

      // Rank
      const tdRank = document.createElement("td");
      tdRank.innerText = rec.divisionRank;
      tr.appendChild(tdRank);

      // Team + logo
      const tdTeam = document.createElement("td");
      tdTeam.className = "team-cell";
      const abbr = ABBREVIATIONS[rec.team.name] || rec.team.abbreviation;
      const img  = document.createElement("img");
      img.className = "logo-cell";
      img.src = this.file(`images/${abbr}.png`);
      tdTeam.appendChild(img);
      const span = document.createElement("span");
      span.className = "abbr";
      span.innerText = abbr;
      if (this.config.highlightedTeams.includes(abbr)) {
        span.classList.add("team-highlight");
      }
      tdTeam.appendChild(span);
      tr.appendChild(tdTeam);

      // W, L, PCT, GB
      [rec.wins, rec.losses, rec.winningPercentage, rec.gamesBack === "0.0" ? "-" : rec.gamesBack]
        .forEach(v => {
          const td = document.createElement("td");
          td.innerText = v;
          tr.appendChild(td);
        });

      // Last 10
      const tdL10 = document.createElement("td");
      tdL10.innerText = `${rec.lastTen.wins}-${rec.lastTen.losses}`;
      tr.appendChild(tdL10);

      // Home/Away splits
      const homeSplit = rec.records.splits.find(s => s.type === "home");
      const awaySplit = rec.records.splits.find(s => s.type === "away");
      const tdHome = document.createElement("td");
      tdHome.innerText = homeSplit ? `${homeSplit.wins}-${homeSplit.losses}` : "";
      tr.appendChild(tdHome);
      const tdAway = document.createElement("td");
      tdAway.innerText = awaySplit ? `${awaySplit.wins}-${awaySplit.losses}` : "";
      tr.appendChild(tdAway);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }
});
