#!/usr/bin/env node
// fetch-standings.js
const fs    = require("fs");
const path  = require("path");
const fetch = require("node-fetch");
const moment= require("moment");

const OUTFILE = path.join(__dirname, "standings.json");
const season  = moment().year();
const url     = `https://statsapi.mlb.com/api/v1/standings?sportId=1&season=${season}&standingsTypes=regularSeason,wildCard`;

(async () => {
  try {
    const res  = await fetch(url);
    const json = await res.json();
    // Extract only the `records` array; that's exactly what your module needs.
    fs.writeFileSync(OUTFILE, JSON.stringify(json.records, null, 2));
    console.log(`[fetch-standings] wrote ${json.records.length} divisions to ${OUTFILE}`);
  } catch (e) {
    console.error("[fetch-standings] error:", e);
    process.exit(1);
  }
})();
