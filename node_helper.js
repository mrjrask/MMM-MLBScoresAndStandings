const NodeHelper = require("node_helper");
const moment     = require("moment");

console.log("[MMM-MLBScoresAndStandings] helper started");

// Division configs for separate standings fetches
const DIVISIONS = [
  { name: "NL East", leagueId: 104, divisionId: 204 },
  { name: "NL Central", leagueId: 104, divisionId: 205 },
  { name: "NL West", leagueId: 104, divisionId: 203 },
  { name: "AL East", leagueId: 103, divisionId: 201 },
  { name: "AL Central", leagueId: 103, divisionId: 202 },
  { name: "AL West", leagueId: 103, divisionId: 200 }
];

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
    const groups = [];
    for (const d of DIVISIONS) {
      const url = `https://statsapi.mlb.com/api/v1/standings?season=${season}&leagueId=${d.leagueId}&divisionId=${d.divisionId}`;
      try {
        const res  = await fetch(url);
        const json = await res.json();
        const recs = json.records || [];
        let teamRecords = [];
        if (recs.length > 0) {
          // find the matching division record
          const rec = recs.find(r => r.division.id === d.divisionId) || recs[0];
          teamRecords = rec.teamRecords || [];
        }
        groups.push({ division: { name: d.name }, teamRecords });
      } catch (e) {
        console.error(`Failed to fetch ${d.name}`, e);
        groups.push({ division: { name: d.name }, teamRecords: [] });
      }
    }
    this.recordGroups = groups;
    console.log(
      "[MMM-MLBScoresAndStandings] fetched standings divisions:",
      groups.map(g => g.division.name)
    );
    this.sendSocketNotification("STANDINGS", this.recordGroups);
  }
});
