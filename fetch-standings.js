#!/usr/bin/env node
// fetch-standings.js

const fs   = require("fs");
const path = require("path");

// MLB division endpoints
const DIVISIONS = [
  { name: "NL East",    leagueId: 104, divisionId: 204 },
  { name: "NL Central", leagueId: 104, divisionId: 205 },
  { name: "NL West",    leagueId: 104, divisionId: 203 },
  { name: "AL East",    leagueId: 103, divisionId: 201 },
  { name: "AL Central", leagueId: 103, divisionId: 202 },
  { name: "AL West",    leagueId: 103, divisionId: 200 }
];

(async () => {
  const season  = new Date().getFullYear();
  const outPath = path.join(__dirname, "standings.json");
  const results = [];

  for (const d of DIVISIONS) {
    const url = `https://statsapi.mlb.com/api/v1/standings`
              + `?season=${season}`
              + `&leagueId=${d.leagueId}`
              + `&divisionId=${d.divisionId}`
              + `&sportId=1`;
    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const recs = json.records || [];
      // records array will usually be length 1 here
      const rec  = recs[0] || { teamRecords: [] };
      results.push({
        division:    { name: d.name },
        teamRecords: rec.teamRecords || []
      });
    } catch (err) {
      console.error(`[fetch-standings] error for ${d.name}:`, err);
      // still push an empty group so front-end rotation stays in sync
      results.push({
        division:    { name: d.name },
        teamRecords: []
      });
    }
  }

  // Write out exactly what node_helper expects
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(
    `[fetch-standings] wrote standings for ${
      results.length
    } divisions to ${outPath}`
  );
  process.exit(0);
})();
