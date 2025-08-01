// modules/MMM-MLBScoresAndStandings/node_helper.js

const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start() {
    console.log("MMM-MLBScoresAndStandings helper started");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      // Initial fetch
      this._fetchGames();
      this._fetchStandings();
      // Schedule recurring updates
      setInterval(() => this._fetchGames(), this.config.updateIntervalScores);
      setInterval(() => this._fetchStandings(), this.config.updateIntervalStandings);
    }
  },

  async _fetchGames() {
    try {
      const tz = this.config.timeZone || "America/Chicago";
      // Get Central (or configured) date in ISO YYYY-MM-DD
      let dateCT = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      // Get time in 24h hh:mm to decide freeze cutoff
      const timeCT = new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
      const [hStr, mStr] = timeCT.split(":");
      const h = parseInt(hStr, 10), m = parseInt(mStr, 10);
      // If before 08:45 in CT, keep yesterday's games
      if (h < 8 || (h === 8 && m < 45)) {
        const dt = new Date(dateCT);
        dt.setDate(dt.getDate() - 1);
        dateCT = dt.toISOString().slice(0, 10);
      }
      const url = `https://statsapi.mlb.com/api/v1/schedule/games?sportId=1&date=${dateCT}&hydrate=linescore`;
      const res  = await fetch(url);
      const json = await res.json();
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
      console.log("📊 Full standings data:", JSON.stringify(all, null, 2));
      this.sendSocketNotification("STANDINGS", all);
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: fetchStandings failed", e);
    }
  }
});
