const NodeHelper = require("node_helper");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
  start() {
    console.log("[MMM-MLBScoresAndStandings] helper started");
    this.config = {};
    this.gamesURL = "https://statsapi.mlb.com/api/v1/schedule?leagueId=103,104&sportId=1"; // adjust as needed
    this.standingsURLBase = "https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=";
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      // Save user config
      this.config = payload;
      // Kick off our first fetch
      this.fetchGames();
      this.fetchStandings();
      // Schedule retries
      setInterval(() => this.fetchGames(), this.config.updateIntervalScores);
      setInterval(() => this.fetchStandings(), this.config.updateIntervalStandings);
    }
  },

  async fetchGames() {
    console.log("[MMM-MLBScoresAndStandings] fetching games...");
    try {
      const res = await fetch(this.gamesURL);
      res.raiseForStatus?.(); // if using node-fetch@3
      const json = await res.json();
      // schedule.dateGames is an array; flatten all games
      const dates = json.dates || [];
      const games = dates.reduce((arr, day) => arr.concat(day.games || []), []);
      console.log("[MMM-MLBScoresAndStandings] got", games.length, "games");
      this.sendSocketNotification("GAMES", games);
    } catch (e) {
      console.error("[MMM-MLBScoresAndStandings] Error fetching games:", e);
      // Even on error, send empty so module leaves Loading state
      this.sendSocketNotification("GAMES", []);
    }
  },

  async fetchStandings() {
    console.log("[MMM-MLBScoresAndStandings] fetching standings...");
    // our divisions in order: East, Central, West for NL (104) and AL (103)
    const divisions = [
      { leagueId: 104, divisionId: 204 },
      { leagueId: 104, divisionId: 205 },
      { leagueId: 104, divisionId: 203 },
      { leagueId: 103, divisionId: 201 },
      { leagueId: 103, divisionId: 202 },
      { leagueId: 103, divisionId: 200 },
    ];
    try {
      const allRecs = await Promise.all(divisions.map(async ({ leagueId, divisionId }) => {
        const url = `${this.standingsURLBase}${leagueId}&divisionId=${divisionId}`;
        const res = await fetch(url);
        res.raiseForStatus?.();
        const json = await res.json();
        const recs = json.records?.[0]?.teamRecords || [];
        return { division: json.records?.[0]?.division || { name: "" }, teamRecords: recs };
      }));
      console.log("[MMM-MLBScoresAndStandings] got standings for", allRecs.length, "divisions");
      this.sendSocketNotification("STANDINGS", allRecs);
    } catch (e) {
      console.error("[MMM-MLBScoresAndStandings] Error fetching standings:", e);
      this.sendSocketNotification("STANDINGS", []);
    }
  }
});
