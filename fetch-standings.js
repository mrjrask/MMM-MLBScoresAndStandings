#!/usr/bin/env node
// fetch-standings.js

const fs   = require("fs");
const path = require("path");

// Division definitions
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
              + `?sportId=1&season=${season}`
              + `&leagueId=${d.leagueId}`
              + `&divisionId=${d.divisionId}`;
    try {
      const res  = await fetch(url);
      const json = await res.json();
      const recs = json.records || [];

      // **DEBUG**: show what division IDs came back
      console.log(
        `[fetch-standings] ${d.name} API records divisions:`,
        recs.map(r => r.division?.id)
      );

      // pick the matching division (coerce to Number in case of string IDs)
      const divRec =
        recs.find(r => Number(r.division?.id) === d.divisionId) 
        || recs[0] 
        || { teamRecords: [] };

      results.push({
        division:    { name: d.name },
        teamRecords: divRec.teamRecords || []
      });

    } catch (err) {
      console.error(`[fetch-standings] error for ${d.name}:`, err);
      results.push({ division: { name: d.name }, teamRecords: [] });
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(
    `[fetch-standings] wrote standings for ${results.length} divisions to ${outPath}`
  );
})();
