// modules/MMM-MLBScoresAndStandings/node_helper.js

const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start() {
    console.log("MMM-MLBScoresAndStandings helper started");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      // immediately fetch once
      this._fetchGames();
      this._fetchStandings();
      // schedule recurring
      setInterval(() => this._fetchGames(),    this.config.updateIntervalScores);
      setInterval(() => this._fetchStandings(), this.config.updateIntervalStandings);
    }
  },

  async _fetchGames() {
    try {
      const today   = new Date().toISOString().slice(0, 10);
      const url     = `https://statsapi.mlb.com/api/v1/schedule/games?sportId=1&date=${today}`;
      const res     = await fetch(url);
      const json    = await res.json();
      const games   = (json.dates[0] && json.dates[0].games) || [];
      this.sendSocketNotification("GAMES", games);
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: fetchGames failed", e);
    }
  },

  async _fetchStandings() {
    try {
      // fetch NL and AL in parallel
      const [nlRes, alRes] = await Promise.all([
        fetch("https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=104"),
        fetch("https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=103")
      ]);
      const [nlJson, alJson] = await Promise.all([nlRes.json(), alRes.json()]);
      const nlRecs = nlJson.records || [];
      const alRecs = alJson.records || [];
      // combine and sort by division ID so East/Central/West line up
      const all     = [...nlRecs, ...alRecs].sort((a, b) => a.division.id - b.division.id);
      this.sendSocketNotification("STANDINGS", all);
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: fetchStandings failed", e);
    }
  }
});
