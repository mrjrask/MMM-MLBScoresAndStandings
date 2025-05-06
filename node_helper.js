// node_helper.js

const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start() {
    console.log("[MMM-MLBScoresAndStandings] helper started");
    this.config = {};
    // Today's MLB schedule (all games)
    this.gamesURL = "https://statsapi.mlb.com/api/v1/schedule?leagueId=103,104&sportId=1";
    // Base URL for fetching standings
    this.standingsURLBase = "https://statsapi.mlb.com/api/v1/standings?season=2025&leagueId=";
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      // initial fetch
      this.fetchGames();
      this.fetchStandings();
      // schedule recurring fetches
      setInterval(() => this.fetchGames(), this.config.updateIntervalScores);
      setInterval(() => this.fetchStandings(), this.config.updateIntervalStandings);
    }
  },

  async fetchGames() {
    console.log("[MMM-MLBScoresAndStandings] fetching games...");
    try {
      const res = await fetch(this.gamesURL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const dates = json.dates || [];
      const games = dates.reduce((all, day) => all.concat(day.games || []), []);
      console.log("[MMM-MLBScoresAndStandings] got", games.length, "games");
      this.sendSocketNotification("GAMES", games);
    } catch (e) {
      console.error("[MMM-MLBScoresAndStandings] Error fetching games:", e);
      this.sendSocketNotification("GAMES", []);
    }
  },

  async fetchStandings() {
    console.log("[MMM-MLBScoresAndStandings] fetching standings...");
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rec = (json.records && json.records[0]) || {};
        return {
          division: rec.division || {},
          teamRecords: rec.teamRecords || []
        };
      }));
      console.log("[MMM-MLBScoresAndStandings] got standings for", allRecs.length, "divisions");
      this.sendSocketNotification("STANDINGS", allRecs);
    } catch (e) {
      console.error("[MMM-MLBScoresAndStandings] Error fetching standings:", e);
      this.sendSocketNotification("STANDINGS", []);
    }
  }
});
