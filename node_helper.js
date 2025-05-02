const NodeHelper = require("node_helper");
const moment = require("moment");

module.exports = NodeHelper.create({
  start() {
    console.log("MMM-MLBScoresAndStandings helper started");
    this.games = [];
    this.standings = [];
  },

  scheduleFetch() {
    // Scores: every 2 minutes
    setInterval(() => this.fetchData(), 2 * 60 * 1000);
    // Standings: every 15 minutes
    setInterval(() => this.fetchStandings(), 15 * 60 * 1000);
  },

  socketNotificationReceived(notification) {
    if (notification === "INIT") {
      this.fetchData();
      this.fetchStandings();
      this.scheduleFetch();
    }
  },

  async fetchData() {
    const date = moment().format("YYYY-MM-DD");
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      // Flatten games
      this.games = json.dates[0]?.games || [];
      this.sendSocketNotification("GAMES", this.games);
    } catch (e) {
      console.error("Failed to fetch games", e);
    }
  },

  async fetchStandings() {
    const season = moment().year();
    const url = `https://statsapi.mlb.com/api/v1/standings?season=${season}&standingsTypes=regularSeason,wildCard`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      // json.records is an array per division and wild card; flatten as needed
      this.standings = json.records;
      this.sendSocketNotification("STANDINGS", this.standings);
    } catch (e) {
      console.error("Failed to fetch standings", e);
    }
  }
});
