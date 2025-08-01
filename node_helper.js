// modules/MMM-MLBScoresAndStandings/node_helper.js

const NodeHelper = require("node_helper");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
  start() {
    console.log("MMM-MLBScoresAndStandings helper started");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      this._fetchGames();
      this._fetchStandings();
      setInterval(() => this._fetchGames(), this.config.updateIntervalScores);
      setInterval(() => this._fetchStandings(), this.config.updateIntervalStandings);
    }
  },

  async _fetchGames() {
    try {
      const tz = this.config.timeZone || "America/Chicago";

      // Get current local time in chosen timezone
      const now = new Date();
      const dateCT = new Date(now.toLocaleString("en-US", { timeZone: tz }));

      // Calculate if it's before 8:45am CT
      const hour = dateCT.getHours();
      const min = dateCT.getMinutes();

      // If before cutoff, back up one day
      if (hour < 8 || (hour === 8 && min < 45)) {
        dateCT.setDate(dateCT.getDate() - 1);
      }

      const dateStr = dateCT.toISOString().slice(0, 10);
      const url = `https://statsapi.mlb.com/api/v1/schedule/games?sportId=1&date=${dateStr}&hydrate=linescore`;

      const res = await fetch(url);
      const json = await res.json();
      const games = (json.dates[0] && json.dates[0].games) || [];

      if (!games.length) {
        console.warn(`📭 No MLB games found for ${dateStr}`);
      } else {
        console.log(`⚾ Loaded ${games.length} game(s) for ${dateStr}`);
      }

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

      const all = [...nlRecs, ...alRecs].sort((a, b) => a.division.id - b.division.id);
      console.log(`📈 Loaded ${all.length} standings groups`);
      this.sendSocketNotification("STANDINGS", all);
    } catch (e) {
      console.error("MMM-MLBScoresAndStandings: fetchStandings failed", e);
    }
  }
});
