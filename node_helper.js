const NodeHelper = require("node_helper");
const moment     = require("moment");

console.log("[MMM-MLBScoresAndStandings] helper started");

module.exports = NodeHelper.create({
  start() {
    this.games        = [];
    this.recordGroups = [];
    this.config       = {};
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      this.fetchData();
      this.fetchStandings();
      this.scheduleFetch();
    }
  },

  scheduleFetch() {
    setInterval(
      () => this.fetchData(),
      this.config.updateIntervalScores
    );
    setInterval(
      () => this.fetchStandings(),
      this.config.updateIntervalStandings
    );
  },

  async fetchData() {
    const date = moment().format("YYYY-MM-DD");
    const url  = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`;
    try {
      const res  = await fetch(url);
      const json = await res.json();
      this.games = json.dates?.[0]?.games || [];
      console.log(
        "[MMM-MLBScoresAndStandings] fetched games:",
        this.games.length
      );
      this.sendSocketNotification("GAMES", this.games);
    } catch (e) {
      console.error("[MMM-MLBScoresAndStandings] fetchData error", e);
    }
  },

  async fetchStandings() {
    const season = moment().year();
    // Fetch only regular season standings by sport
    const url    = `https://statsapi.mlb.com/api/v1/standings?sportId=1&season=${season}&standingsTypes=regularSeason`;
    try {
      const res    = await fetch(url);
      const json   = await res.json();
      this.recordGroups = json.records || [];
      console.log(
        "[MMM-MLBScoresAndStandings] fetched standings groups:",
        this.recordGroups.length
      );
      this.sendSocketNotification("STANDINGS", this.recordGroups);
    } catch (e) {
      console.error("[MMM-MLBScoresAndStandings] fetchStandings error", e);
    }
  }
});
