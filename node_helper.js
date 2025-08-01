// modules/MMM-MLBScoresAndStandings/node_helper.js

const NodeHelper = require("../../js/node_helper"); // Correct relative path

module.exports = NodeHelper.create({
  start() {
    console.log("✅ MMM-MLBScoresAndStandings helper started");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      console.log("⚙️  INIT received with config:", JSON.stringify(this.config, null, 2));

      this._fetchGames();
      this._fetchStandings();

      setInterval(() => {
        console.log("⏱️  Scheduled fetchGames()");
        this._fetchGames();
      }, this.config.updateIntervalScores);

      setInterval(() => {
        console.log("⏱️  Scheduled fetchStandings()");
        this._fetchStandings();
      }, this.config.updateIntervalStandings);
    }
  },

  async _fetchGames() {
    try {
      const tz = this.config.timeZone || "America/Chicago";
      let dateCT = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const timeCT = new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });

      const [hStr, mStr] = timeCT.split(":");
      const h = parseInt(hStr, 10), m = parseInt(mStr, 10);

      if (h < 8 || (h === 8 && m < 45)) {
        const dt = new Date(dateCT);
        dt.setDate(dt.getDate() - 1);
        dateCT = dt.toISOString().slice(0, 10);
        console.log(`📅 Before 8:45 CT — using yesterday's date: ${dateCT}`);
      } else {
        console.log(`📅 Using today’s date: ${dateCT}`);
      }

      const url = `https://statsapi.mlb.com/api/v1/schedule/games?sportId=1&date=${dateCT}&hydrate=linescore`;
      const res = await fetch(url);
      const json = await res.json();
      const games = (json.dates[0] && json.dates[0].games) || [];

      console.log(`📦 Loaded ${games.length} games from MLB API`);
      this.sendSocketNotification("GAMES", games);
    } catch (e) {
      console.error("❌ fetchGames failed:", e);
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

      console.log(`📊 Loaded ${all.length} division standings`);
      this.sendSocketNotification("STANDINGS", all);
    } catch (e) {
      console.error("❌ fetchStandings failed:", e);
    }
  }
});
