#!/usr/bin/env node
// fetch-standings.js

const fs   = require("fs");
const path = require("path");

// Your six divisions, with their IDs:
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

      // Show exactly which division blocks came back:
      console.log(
        `[fetch-standings] ${d.name} API returned divisions:`,
        recs.map(r => `${r.division.id} (${r.division.link || "no-name"})`)
      );

      // Pick the one whose division.id matches yours
      const match = recs.find(r => Number(r.division.id) === d.divisionId);
      if (!match) {
        console.warn(
          `[fetch-standings] ⚠️ No exact match for ${d.name} (id=${d.divisionId}), defaulting to first record (${recs[0]?.division.id})`
        );
      } else {
        console.log(
          `[fetch-standings] Matched ${d.name} → division ${match.division.id}`
        );
      }

      results.push({
        division:    { name: d.name },
        teamRecords: (match || recs[0] || { teamRecords: [] }).teamRecords || []
      });
    } catch (err) {
      console.error(`[fetch-standings] Error fetching ${d.name}:`, err);
      results.push({ division: { name: d.name }, teamRecords: [] });
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`[fetch-standings] Wrote ${results.length} divisions to ${outPath}`);
})();
