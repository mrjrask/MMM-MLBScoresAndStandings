/* MMM-MLBScoresAndStandings.js */
/* global Module */

const ABBREVIATIONS = {
  "Chicago Cubs": "CUBS","Atlanta Braves": "ATL","Miami Marlins": "MIA",
  "New York Mets": "NYM","Philadelphia Phillies": "PHI","Washington Nationals": "WAS",
  "Cincinnati Reds": "CIN","Milwaukee Brewers": "MIL","Pittsburgh Pirates": "PIT",
  "St. Louis Cardinals": "STL","Arizona Diamondbacks": "ARI","Colorado Rockies": "COL",
  "Los Angeles Dodgers": "LAD","San Diego Padres": "SD","San Francisco Giants": "SF",
  "Baltimore Orioles": "BAL","Boston Red Sox": "BOS","New York Yankees": "NYY",
  "Tampa Bay Rays": "TB","Toronto Blue Jays": "TOR","Chicago White Sox": "SOX",
  "Cleveland Guardians": "CLE","Detroit Tigers": "DET","Kansas City Royals": "KC",
  "Minnesota Twins": "MIN","Houston Astros": "HOU","Los Angeles Angels": "LAA",
  "Athletics": "ATH","Seattle Mariners": "SEA","Texas Rangers": "TEX"
};

// Division and Wild Card ordering
const SINGLE_STAND_ORDER = [205, 202, 204, 201, 203, 200];
const PAIR_STAND_ORDER   = [[205,202], [204,201], [203,200]];
const WILD_CARD_ORDER    = ["NL", "AL"];
const DIVISION_LABELS    = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West",
  "NL": "NL Wild Card", "AL": "AL Wild Card"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:        1   * 60 * 1000,
    updateIntervalStandings:   15   * 60 * 1000,
    gamesPerPage:                  8,
    logoType:                  "color",
    rotateIntervalScores:         15  * 1000,
    rotateIntervalEast:           7   * 1000,
    rotateIntervalCentral:       12   * 1000,
    rotateIntervalWest:           7   * 1000,
    standingsPerPage:              2, // show two screens at once
    rotateIntervalStandingsSingle: 7   * 1000,
    timeZone:               "America/Chicago",
    highlightedTeams:             [],
    showTitle:                   true
  },

  getHeader() {
    if (!this.config.showTitle) return null;
    return this.currentScreen < this.totalGamePages
      ? "MLB Scoreboard"
      : "MLB Standings";
  },

  getScripts() {
    return ["https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"];
  },
  getStyles() {
    return ["MMM-MLBScoresAndStandings.css"];
  },

  start() {
    this.games           = [];
    this.recordGroups    = [];
    this.loadedGames     = false;
    this.loadedStandings = false;
    this.totalGamePages  = 1;
    // 6 divisions + 2 wild card screens
    this.totalStandPages = SINGLE_STAND_ORDER.length + WILD_CARD_ORDER.length;
    this.currentScreen   = 0;
    this.rotateTimer     = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(
      () => this.sendSocketNotification("INIT", this.config),
      Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings)
    );
    this._scheduleRotate();
  },

  _scheduleRotate() {
    const totalScreens = this.totalGamePages + this.totalStandPages;
    let delay;
    if (this.currentScreen < this.totalGamePages) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      if (this.config.standingsPerPage === 1) {
        delay = this.config.rotateIntervalStandingsSingle;
      } else {
        const intervals = [
          this.config.rotateIntervalCentral,
          this.config.rotateIntervalEast,
          this.config.rotateIntervalWest
        ];
        delay = intervals[idx] || this.config.rotateIntervalEast;
      }
    }
    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % totalScreens;
      this.updateDom(1000);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.loadedGames    = true;
      this.games          = payload;
      this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.loadedStandings = true;
      this.recordGroups    = payload;
      this.updateDom();
    }
  },

  _noData(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "small dimmed";
    wrapper.innerText = msg;
    return wrapper;
  },

  getDom() {
    const wrapper = document.createElement("div");
    const showingGames = this.currentScreen < this.totalGamePages;
    wrapper.className = showingGames ? "scores-screen" : "standings-screen";

    if (showingGames && !this.loadedGames) return this._noData("Loading games...");
    if (!showingGames && !this.loadedStandings) return this._noData("Loading standings...");
    if (showingGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

    const content = showingGames ? this._buildGames() : this._buildStandings();
    wrapper.appendChild(content);
    return wrapper;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const games = this.games.slice(start, start + this.config.gamesPerPage);
    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";

    const half = Math.ceil(games.length / 2);
    [games.slice(0, half), games.slice(half)].forEach(col => {
      const colDiv = document.createElement("div");
      colDiv.className = "game-col";
      col.forEach(game => colDiv.appendChild(this.createGameBox(game)));
      wrapper.appendChild(colDiv);
    });

    return wrapper;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const wrapper = document.createElement("div");

    if (idx < SINGLE_STAND_ORDER.length) {
      // Regular division
      wrapper.className = "standings-single";
      wrapper.appendChild(this._createStandingsBlock(SINGLE_STAND_ORDER[idx]));
    } else {
      // Wild Card screens
      wrapper.className = "standings-single";
      const wcIdx = idx - SINGLE_STAND_ORDER.length;
      wrapper.appendChild(this._createWildCardBlock(WILD_CARD_ORDER[wcIdx]));
    }

    return wrapper;
  },

  _createStandingsBlock(divId) {
    const block = document.createElement("div");
    block.className = "standings-division";

    const h3 = document.createElement("h3");
    h3.innerText = DIVISION_LABELS[divId];
    block.appendChild(h3);

    const group = this.recordGroups.find(g => g.division.id === divId);
    block.appendChild(this.createStandingsTable(group));

    return block;
  },

  _createWildCardBlock(league) {
    const block = document.createElement("div");
    block.className = "standings-division";

    const h3 = document.createElement("h3");
    h3.innerText = DIVISION_LABELS[league];
    block.appendChild(h3);

    // Gather and sort all teams in that league
    const records = this.recordGroups
      .filter(r => r.division.name.startsWith(league))
      .flatMap(r => r.teamRecords)
      .sort((a,b) => b.wins - a.wins || a.losses - b.losses);

    // Use top N teams (for full context you could slice more)
    const pseudoGroup = { teamRecords: records };
    block.appendChild(this.createStandingsTable(pseudoGroup, true));

    return block;
  },

  createStandingsTable(group, isWildCard = false) {
    const table = document.createElement("table");
    table.className = "mlb-standings";

    // Header row
    const trH = document.createElement("tr");
    ["","W-L","W%","GB","Streak","L10","Home","Away"].forEach(txt => {
      const th = document.createElement("th");
      th.innerText = txt;
      trH.appendChild(th);
    });
    table.appendChild(trH);

    // Data rows
    group.teamRecords.forEach((rec, i) => {
      const tr = document.createElement("tr");

      // Bold line divider after 3rd team in Wild Card
      if (isWildCard && i === 3) {
        tr.style.borderTop = "2px solid #FFD242";
      }

      // Team cell
      const tdTeam = document.createElement("td");
      tdTeam.className = "team-cell";
      const img = document.createElement("img");
      img.src = this.getLogoUrl(ABBREVIATIONS[rec.team.name] || "");
      img.alt = ABBREVIATIONS[rec.team.name] || "";
      img.className = "logo-cell";
      img.onerror = () => img.style.display = "none";
      tdTeam.appendChild(img);
      const sp = document.createElement("span");
      sp.className = "abbr";
      sp.innerText = ABBREVIATIONS[rec.team.name] || "";
      tdTeam.appendChild(sp);
      tr.appendChild(tdTeam);

      // Wins-Losses and percentage
      const lr = rec.leagueRecord || {};
      const W  = parseInt(lr.wins) || 0;
      const L  = parseInt(lr.losses) || 0;
      const pct = (W+L>0)
        ? ((W/(W+L)).toFixed(3).replace(/^0/,""))
        : "-";
      [`${W}-${L}`, pct].forEach(val => {
        const td = document.createElement("td");
        td.innerText = val;
        tr.appendChild(td);
      });

      // Games Back, with “1/2” for .5
      let gb = rec.divisionGamesBack;
      if (gb != null && gb !== "-") {
        const f = parseFloat(gb), m = Math.floor(f), r = f - m;
        if (Math.abs(r) < 1e-6) {
          gb = `${m}`;
        } else if (r === 0.5) {
          gb = m === 0 ? "1/2" : `${m}1/2`;
        } else {
          gb = f.toString();
        }
      }
      const tdGB = document.createElement("td");
      tdGB.innerText = gb;
      tr.appendChild(tdGB);

      // Streak, L10, Home, Away
      const lastTen = rec.records?.splitRecords?.find(s => s.type.toLowerCase() === "lastten");
      const l10     = lastTen ? `${lastTen.wins}-${lastTen.losses}` : "-";
      const homeRec = rec.records?.splitRecords?.find(s => s.type.toLowerCase() === "home");
      const awayRec = rec.records?.splitRecords?.find(s => s.type.toLowerCase() === "away");
      [rec.streak?.streakCode || "-", l10,
       homeRec ? `${homeRec.wins}-${homeRec.losses}` : "-",
       awayRec ? `${awayRec.wins}-${awayRec.losses}` : "-"
      ].forEach(val => {
        const td = document.createElement("td");
        td.innerText = val;
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  },


  createGameBox(game) {  
    const table = document.createElement("table");  
    table.className   = "game-boxscore";  
    table.cellSpacing = 0;  
    table.cellPadding = 0;  

    const awayScore = game.teams.away.score;  
    const homeScore = game.teams.home.score;  
    const ls        = game.linescore || {};  
    const state     = game.status.abstractGameState || "";  
    const det       = game.status.detailedState || "";  
    const innings   = ls.innings || [];  

    const isSuspended = det.includes("Suspended") || state === "Suspended";  
    const isPost      = det.includes("Postponed");  
    const isWarmup    = det === "Warmup";  
    const isPrev      = state === "Preview";  
    const isFin       = state === "Final";  
    const live        = !isPrev && !isFin && !isPost && !isWarmup && !isSuspended;  
    const show        = !isPrev && !isPost && !isSuspended;  

    let statusText;  
    if (isSuspended) {  
      statusText = "Suspended";  
    } else if (isPost) {  
      statusText = "Postponed";  
    } else if (isWarmup) {  
      statusText = "Warmup";  
    } else if (isPrev) {  
      statusText = new Date(game.gameDate).toLocaleTimeString("en-US", {  
        timeZone: this.config.timeZone,  
        hour12: true,  
        hour: "numeric",  
        minute: "2-digit"  
      });  
    } else if (isFin) {  
      statusText = innings.length === 9 ? "F" : `F/${innings.length}`;  
    } else {  
      const st = ls.inningState || "";  
      const io = ls.currentInningOrdinal || "";  
      statusText = (st + " " + io).trim() || "In Progress";  
    }  

    // Header row for boxscore: status + R/H/E  
    const trH = document.createElement("tr");  
    const thS = document.createElement("th");  
    thS.className = "status-cell";  
    thS.innerText = statusText;  
    trH.appendChild(thS);  
    ["R","H","E"].forEach(lbl => {  
      const th = document.createElement("th");  
      th.className = "rhe-header";  
      th.innerText = lbl;  
      trH.appendChild(th);  
    });  
    table.appendChild(trH);  

    const lines = ls.teams || {};  
    [game.teams.away, game.teams.home].forEach((t, i) => {  
      const tr = document.createElement("tr");  
      if (isFin) {  
        const awayL = awayScore < homeScore;  
        const homeL = homeScore < awayScore;  
        if ((i===0 && awayL) || (i===1 && homeL)) tr.classList.add("loser");  
      }  

      const abbr = ABBREVIATIONS[t.team.name] || t.team.abbreviation || "";  
      const tdT  = document.createElement("td");  
      tdT.className = "team-cell";  
      const img  = document.createElement("img");  
      img.src      = this.getLogoUrl(abbr);  
      img.alt      = abbr;  
      img.className= "logo-cell";  
      img.onerror  = () => img.style.display = 'none';  
      tdT.appendChild(img);  
      const sp    = document.createElement("span");  
      sp.className = "abbr";  
      sp.innerText = abbr;  
      if (this.config.highlightedTeams.includes(abbr)) sp.classList.add("team-highlight");  
      if (isFin) sp.classList.add("final");  
      tdT.appendChild(sp);  
      tr.appendChild(tdT);  

      const runVal = show ? t.score : "";  
      const hitVal = show  
        ? (i===0 ? (lines.away?.hits ?? "") : (lines.home?.hits ?? ""))  
        : "";  
      const errVal = show  
        ? (t.errors != null ? t.errors  
            : (i===0 ? (lines.away?.errors ?? "") : (lines.home?.errors ?? "")))  
        : "";  

      [runVal, hitVal, errVal].forEach(val => {  
        const td = document.createElement("td");  
        td.className = live ? "rhe-cell live" : "rhe-cell";  
        td.innerText = val;  
        tr.appendChild(td);  
      });  
      table.appendChild(tr);  
    });  

    return table;  
  },  

  createStandingsTable(group) {  
    const table = document.createElement("table");  
    table.className = "mlb-standings";  

    const trH = document.createElement("tr");  
    ["","W-L","W%","GB","Streak","L10","Home","Away"].forEach(txt => {  
      const th = document.createElement("th");  
      th.innerText = txt;  
      trH.appendChild(th);  
    });  
    table.appendChild(trH);  

    group.teamRecords.forEach(rec => {  
      const tr   = document.createElement("tr");  
      const ab   = ABBREVIATIONS[rec.team.name] || rec.team.abbreviation || "";  
      if (this.config.highlightedTeams.includes(ab)) tr.classList.add("team-highlight");  

      const tdTeam = document.createElement("td");  
      tdTeam.className = "team-cell";  
      const img2 = document.createElement("img");  
      img2.src      = this.getLogoUrl(ab);  
      img2.alt      = ab;  
      img2.className= "logo-cell";  
      img2.onerror  = () => img2.style.display = 'none';  
      tdTeam.appendChild(img2);  
      const sp2 = document.createElement("span");  
      sp2.className = "abbr";  
      sp2.innerText = ab;  
      tdTeam.appendChild(sp2);  
      tr.appendChild(tdTeam);  

      const lr = rec.leagueRecord || {};  
      const W  = parseInt(lr.wins) || 0;  
      const L  = parseInt(lr.losses) || 0;  
      const pct = (W+L>0)  
        ? ((W/(W+L)).toFixed(3).replace(/^0/,""))  
        : "-";  
      [  
        `${W}-${L}`,  
        pct  
      ].forEach(val => {  
        const td = document.createElement("td");  
        td.innerText = val;  
        tr.appendChild(td);  
      });  

      let gb = rec.divisionGamesBack;  
      if (gb != null && gb !== "-") {  
        const f = parseFloat(gb), m = Math.floor(f), r = f - m;  
        if (Math.abs(r) < 1e-6) {  
          gb = `${m}`;  
        } else if (r === 0.5) {  
          gb = m === 0  
            ? `<span class="fraction">1/2</span>`  
            : `${m}<span class="fraction">1/2</span>`;  
        } else {  
          gb = f.toString();  
        }  
      }  
      const tdGB = document.createElement("td");  
      tdGB.innerHTML = gb;  
      tr.appendChild(tdGB);  

      const tdSt = document.createElement("td");  
      tdSt.innerText = rec.streak?.streakCode || "-";  
      tr.appendChild(tdSt);  

      let l10 = "-";  
      const s10 = rec.records?.splitRecords?.find(s => s.type.toLowerCase() === "lastten");  
      if (s10) l10 = `${s10.wins}-${s10.losses}`;  
      const td10 = document.createElement("td");  
      td10.innerText = l10;  
      tr.appendChild(td10);  

      ["home","away"].forEach(type => {  
        let v = "-";  
        const sp = rec.records?.splitRecords?.find(s => s.type.toLowerCase() === type);  
        if (sp) v = `${sp.wins}-${sp.losses}`;  
        const td = document.createElement("td");  
        td.innerText = v;  
        tr.appendChild(td);  
      });  

      table.appendChild(tr);  
    });  

    return table;  
  },  

  getLogoUrl(abbr) {  
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);  
  }  
});
