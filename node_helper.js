const NodeHelper = require("node_helper");
const fetch      = require("node-fetch");

module.exports = NodeHelper.create({
  start() {
    console.log("Starting node_helper for MMM-MLBScoresAndStandings");
  },

  socketNotificationReceived(notification, config) {
    if (notification === "INIT") {
      this.config = config;
      this._scheduleFetch();
    }
  },

  _scheduleFetch() {
    this._fetchGames();
    this._fetchStandings();
    setTimeout(() => this._scheduleFetch(), this.config.updateIntervalScores);
  },

  async _fetchGames() {
    try {
      const today   = new Date();
      const dateStr = today.toISOString().split("T")[0];
      const url     = `https://statsapi.mlb.com/api/v1/schedule/games?sportId=1&date=${dateStr}`;
      const res     = await fetch(url);
      const data    = await res.json();
      const games   = (data.dates[0] && data.dates[0].games) || [];
      this.sendSocketNotification("GAMES", games);
    } catch (e) {
      console.error("Failed to fetch games:", e);
    }
  },

  async _fetchStandings() {
    try {
      // fetch all NL and AL divisions
      const [nlRes, alRes] = await Promise.all([
        fetch("https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=104"),
        fetch("https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=103")
      ]);
      const nlData = await nlRes.json();
      const alData = await alRes.json();
      const nlRecs = nlData.records || [];
      const alRecs = alData.records || [];
      // combine and sort by division id
      const all    = [...nlRecs, ...alRecs]
                       .sort((a,b) => a.division.id - b.division.id);
      this.sendSocketNotification("STANDINGS", all);
    } catch (e) {
      console.error("Failed to fetch standings:", e);
    }
  }
});
