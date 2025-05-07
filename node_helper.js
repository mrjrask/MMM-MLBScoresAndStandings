// modules/MMM-MLBScoresAndStandings/node_helper.js

const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start() {
    console.log("MMM-MLBScoresAndStandings helper started");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      // Initial data fetch
      this._fetchGames();
      this._fetchStandings();
      // Schedule updates
      setInterval(() => this._fetchGames(), this.config.updateIntervalScores);
      setInterval(() => this._fetchStandings(), this.config.updateIntervalStandings);
    }
  },

  async _fetchGames() {
    try {
      // Use Central Time date to avoid UTC offset
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      const url   = `https://statsapi.mlb.com/api/v1/schedule/games?sportId=1&date=${today}&hydrate=linescore`;
      const res   = await fetch(url);
      const json  = await res.json();
      const games = (json.dates[0] && json.dates[0].games) || [];
      this.sendSocketNotification("GAMES", games);
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: fetchGames failed", e);
    }
  },

  async _fetchStandings() {
    try {
      const [nlRes, alRes] = await Promise.all([
        fetch("https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=104"),
        fetch("https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=103")
      ]);
      const [nlJson, alJson] = await Promise.all([nlRes.json(), alRes.json()]);
      const nlRecs = nlJson.records || [];
      const alRecs = alJson.records || [];
      // Merge NL and AL, sorted by division ID
      const all = [...nlRecs, ...alRecs].sort((a, b) => a.division.id - b.division.id);
      this.sendSocketNotification("STANDINGS", all);
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: fetchStandings failed", e);
    }
  }
});
