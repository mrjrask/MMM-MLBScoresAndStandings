/* MMM-MLBScoresAndStandings.js */
/* global Module, moment */

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

const DIVISION_LABELS = {
  204: "NL East",
  205: "NL Central",
  203: "NL West",
  201: "AL East",
  202: "AL Central",
  200: "AL West"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:    2 * 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,
    rotateInterval:          7 * 1000,
    gamesPerPage:            8,
    logoType:                "color",
    showWildCardGamesBack:   false
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
    this.loadedGames         = false;
    this.loadedStandings     = false;
    this.totalGamePages      = 1;
    this.totalStandingsPages = 0;
    this.currentScreen       = 0;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config), this.config.updateIntervalScores);
    setInterval(() => this.rotateView(), this.config.rotateInterval);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.loadedGames    = true;
      this.games          = payload;
      this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings     = true;
      this.recordGroups        = payload;
      this.totalStandingsPages = Math.ceil(this.recordGroups.length / 2);
      this.updateDom();
    }
  },

  rotateView() {
    const total = this.totalGamePages + this.totalStandingsPages;
    this.currentScreen = (this.currentScreen + 1) % total;
    this.updateDom(1000);
  },

  getDom() {
    const showingGames = this.currentScreen < this.totalGamePages;
    const wrapper = document.createElement("div");
    wrapper.classList.add(showingGames ? "scores-screen" : "standings-screen");

    // Title Bar + line
    const header = document.createElement("h2");
    header.className = "module-header";
    header.innerText = showingGames ? "MLB Scoreboard" : "MLB Standings";
    wrapper.appendChild(header);
    wrapper.appendChild(document.createElement("hr"));

    // Loading
    if (showingGames && !this.loadedGames)     return this._noData("Loading...");
    if (!showingGames && !this.loadedStandings) return this._noData("Loading...");

    // No data
    if (showingGames && this.loadedGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.loadedStandings && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

    return showingGames ? this._buildGames() : this._buildStandings();
  },

  _noData(msg) {
    const div = document.createElement("div");
    div.innerText = msg;
    return div;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const slice = this.games.slice(start, start + this.config.gamesPerPage);
    const grid  = document.createElement("div");
    grid.className = "games-columns";
    const half = this.config.gamesPerPage / 2;

    for (let i = 0; i < 2; i++) {
      const col = document.createElement("div");
      col.className = "game-col";
      slice.slice(i * half, (i + 1) * half).forEach(g => col.appendChild(this.createGameBox(g)));
      grid.appendChild(col);
    }
    return grid;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    // explicit pairs: [NL East, AL East], [NL Central, AL Central], [NL West, AL West]
    const pairs = [
      [this.recordGroups[0], this.recordGroups[3]],
      [this.recordGroups[1], this.recordGroups[4]],
      [this.recordGroups[2], this.recordGroups[5]]
    ];
    const [first, second] = pairs[idx] || [];
    const container = document.createElement("div");
    container.className = "standings-pair";
    if (first)  container.appendChild(this.createStandingsTable(first));
    if (second) container.appendChild(this.createStandingsTable(second));
    return container;
  },

  createGameBox(game) {
    // unchanged as before...
  },

  createStandingsTable(group) {
    const container = document.createElement("div");
    const title     = document.createElement("h3");
    // use DIVISION_LABELS map
    const divId     = group.division.id;
    title.innerText = DIVISION_LABELS[divId] || group.division.name || "";
    container.appendChild(title);
    // no extra <hr> here

    const table = document.createElement("table");
    table.className = "mlb-standings";
    const hdrs = ["","W-L","W%","GB","Streak","L10","Home","Away"];
    const trHdr = document.createElement("tr");
    hdrs.forEach(txt => {
      const th = document.createElement("th");
      th.innerText = txt;
      trHdr.appendChild(th);
    });
    table.appendChild(trHdr);

    group.teamRecords.forEach(rec => {
      const tr = document.createElement("tr");
      if (rec.team.name === "Chicago Cubs") tr.classList.add("cubs-highlight");

      // team & logo
      const abbr = ABBREVIATIONS[rec.team.name] || "";
      const tdT  = document.createElement("td"); tdT.className = "team-cell";
      const img  = document.createElement("img"); img.src = this.getLogoUrl(abbr); img.alt = abbr; img.className = "logo-cell";
      tdT.appendChild(img);
      const sp   = document.createElement("span"); sp.className = "abbr"; sp.innerText = abbr;
      tdT.appendChild(sp);
      tr.appendChild(tdT);

      // rest of cells as before...
    });

    container.appendChild(table);
    return container;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
