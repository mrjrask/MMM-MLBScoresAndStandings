#!/usr/bin/env node
// fetch-standings.js

const fs      = require("fs");
const path    = require("path");
const nf      = require("node-fetch");
const fetch   = nf.default || nf;

// Current season
const season  = new Date().getFullYear();
const outPath = path.join(__dirname, "standings.json");

// Regular divisions
const DIVISIONS = [
  { name: "NL East",    leagueId: 104, divisionId: 204 },
  { name: "NL Central", leagueId: 104, divisionId: 205 },
  { name: "NL West",    leagueId: 104, divisionId: 203 },
  { name: "AL East",    leagueId: 103, divisionId: 201 },
  { name: "AL Central", leagueId: 103, divisionId: 202 },
  { name: "AL West",    leagueId: 103, divisionId: 200 }
];

// Wild Card standings (league-wide)
const WILDCARDS = [
  { id: "NL", leagueId: 104, name: "NL Wild Card" },
  { id: "AL", leagueId: 103, name: "AL Wild Card" }
];

(async () => {
  const results = [];

  // Fetch regular division standings
  for (const d of DIVISIONS) {
    const url = `https://statsapi.mlb.com/api/v1/standings?sportId=1&season=${season}`
              + `&leagueId=${d.leagueId}&divisionId=${d.divisionId}`;
    try {
      const res  = await fetch(url);
      const json = await res.json();
      const recs = json.records || [];

      const match = recs.find(r => Number(r.division.id) === d.divisionId) || recs[0] || { teamRecords: [] };
      results.push({
        division:    { id: d.divisionId, name: d.name },
        teamRecords: match.teamRecords || []
      });
    } catch (err) {
      console.error(`[fetch-standings] Error fetching ${d.name}:`, err);
      results.push({ division: { id: d.divisionId, name: d.name }, teamRecords: [] });
    }
  }

  // Fetch Wild Card standings
  for (const w of WILDCARDS) {
    const wcUrl = `https://statsapi.mlb.com/api/v1/standings?sportId=1&season=${season}`
                + `&leagueId=${w.leagueId}&standingsTypes=wildCard`;
    try {
      const wcRes  = await fetch(wcUrl);
      const wcJson = await wcRes.json();
      const wcRecs = wcJson.records?.[0]?.teamRecords || [];
      results.push({
        division:    { id: w.id, name: w.name },
        teamRecords: wcRecs
      });
    } catch (err) {
      console.error(`[fetch-standings] Error fetching ${w.name}:`, err);
      results.push({ division: { id: w.id, name: w.name }, teamRecords: [] });
    }
  }

  // Write all to file
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`[fetch-standings] Wrote ${results.length} divisions to ${outPath}`);
})();
