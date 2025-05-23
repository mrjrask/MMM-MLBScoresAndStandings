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

// Order for rotating divisions
const DIVISION_ORDER = [204, 205, 203, 201, 202, 200];
const DIVISION_LABELS = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:            1 * 60 * 1000,
    updateIntervalStandings:       15 * 60 * 1000,
    gamesPerPage:                    8,
    logoType:                      "color",
    rotateIntervalScores:           15 * 1000,
    rotateIntervalEast:              7 * 1000,
    rotateIntervalCentral:          12 * 1000,
    rotateIntervalWest:              7 * 1000,
    standingsPerPage:                2,          // 1 or 2 divisions per page
    rotateIntervalStandingsSingle:   7 * 1000,  // when standingsPerPage = 1
    timeZone:                     "America/Chicago",
    highlightedTeams: []
  },

  getHeader() {
    return this.currentScreen < this.totalGamePages
      ? "MLB Scoreboard"
      : "MLB Standings";
  },

  getScripts() { return ["moment.js"]; },
  getStyles()  { return ["MMM-MLBScoresAndStandings.css"]; },

  start() {
    this.games           = [];
    this.recordGroups    = [];
    this.loadedGames     = false;
    this.loadedStandings = false;
    this.totalGamePages  = 1;
    this.totalStandPages = Math.ceil(DIVISION_ORDER.length / this.config.standingsPerPage);
    this.currentScreen   = 0;
    this.rotateTimer     = null;

    this.sendSocketNotification("INIT", this.config);
    setInterval(() => this.sendSocketNotification("INIT", this.config), this.config.updateIntervalScores);
    setInterval(() => this.sendSocketNotification("INIT", this.config), this.config.updateIntervalStandings);
    this._scheduleRotate();
  },

  _scheduleRotate() {
    const total = this.totalGamePages + this.totalStandPages;
    let delay;
    if (this.currentScreen < this.totalGamePages) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      if (this.config.standingsPerPage === 1) {
        delay = this.config.rotateIntervalStandingsSingle;
      } else {
        const arr = [
          this.config.rotateIntervalEast,
          this.config.rotateIntervalCentral,
          this.config.rotateIntervalWest
        ];
        delay = arr[idx] || this.config.rotateIntervalEast;
      }
    }
    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % total;
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

  getDom() {
    const wrapper = document.createElement("div");
    const showingGames = this.currentScreen < this.totalGamePages;
    wrapper.className = showingGames ? "scores-screen" : "standings-screen";

    if (showingGames && !this.loadedGames) return this._noData("Loading...");
    if (!showingGames && !this.loadedStandings) return this._noData("Loading...");
    if (showingGames && this.games.length === 0) return this._noData("No games to display.");
    if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

    const content = showingGames ? this._buildGames() : this._buildStandings();

    // Wrap content in a centering container if we're in fullscreen_above
    const position = this.data.position || "";
    if (position === "fullscreen_above") {
      const container = document.createElement("div");
      container.className = "mlb-fullscreen-center";
      container.appendChild(content);
      wrapper.appendChild(container);
    } else {
      wrapper.appendChild(content);
    }

    return wrapper;
  },

  _buildGames() {
    const start = this.currentScreen * this.config.gamesPerPage;
    const games = this.games.slice(start, start + this.config.gamesPerPage);
    const wrapper = document.createElement("div");
    wrapper.className = "games-columns";
    const half = Math.ceil(games.length / 2);
    [games.slice(0, half), games.slice(half)].forEach(colGames => {
      const colDiv = document.createElement("div");
      colDiv.className = "game-col";
      colGames.forEach(game => colDiv.appendChild(this.createGameBox(game)));
      wrapper.appendChild(colDiv);
    });
    return wrapper;
  },

  _buildStandings() {
    const idx   = this.currentScreen - this.totalGamePages;
    const start = idx * this.config.standingsPerPage;
    const slice = DIVISION_ORDER.slice(start, start + this.config.standingsPerPage);
    const wrapper = document.createElement("div");
    wrapper.className = this.config.standingsPerPage === 1 ? "standings-single" : "standings-pair";
    slice.forEach(divId => {
      const grp = this.recordGroups.find(g => g.division.id === divId);
      if (grp) {
        const div = document.createElement("div");
        div.className = "standings-division";
        const h3 = document.createElement("h3"); h3.innerText = DIVISION_LABELS[divId]; h3.style.margin = "0 0 4px 0";
        div.appendChild(h3);
        div.appendChild(this.createStandingsTable(grp));
        wrapper.appendChild(div);
      }
    });
    return wrapper;
  },

  createGameBox(game) {
    const table = document.createElement("table");
    table.className   = "game-boxscore";
    table.cellSpacing = 0;
    table.cellPadding = 0;
    const awayScore = game.teams.away.score;
    const homeScore = game.teams.home.score;
    const ls        = game.linescore || {};
    const isPrev    = game.status.abstractGameState === "Preview";
    const isFin     = game.status.abstractGameState === "Final";
    const isPostp   = game.status.detailedState.includes("Postponed");
    const isWarmup  = game.status.detailedState === "Warmup";
    const live      = !isPrev && !isFin && !isPostp && !isWarmup;
    const show      = !isPrev && !isPostp;

    let statusText;
    if (isPostp) statusText = "Postponed";
    else if (isWarmup) statusText = "Warmup";
    else if (isPrev) {
      statusText = new Date(game.gameDate).toLocaleTimeString("en-US", {timeZone: this.config.timeZone, hour12: true, hour: "numeric", minute: "2-digit"});
    } else if (isFin) {
      const innings = (ls.innings || []).length;
      statusText = innings === 9 ? "F" : `F/${innings}`;
    } else {
      const st = ls.inningState || "";
      const io = ls.currentInningOrdinal || "";
      statusText = (st + " " + io).trim() || "In Progress";
    }

    const trH = document.createElement("tr");
    const thS = document.createElement("th"); thS.className = "status-cell"; thS.innerText = statusText; trH.appendChild(thS);
    ["R","H","E"].forEach(lbl => {const th = document.createElement("th"); th.className = "rhe-header"; th.innerText = lbl; trH.appendChild(th);});
    table.appendChild(trH);

    const lines = ls.teams || {};
    [game.teams.away, game.teams.home].forEach((t,i) => {
      const tr = document.createElement("tr");
      if (isFin) { const awayL = awayScore < homeScore; const homeL = homeScore < awayScore; if ((i===0 && awayL) || (i===1 && homeL)) tr.classList.add("loser"); }
      const abbr = ABBREVIATIONS[t.team.name] || "";
      const tdT = document.createElement("td"); tdT.className = "team-cell";
      const img = document.createElement("img"); img.src = this.getLogoUrl(abbr); img.alt = abbr; img.className = "logo-cell"; tdT.appendChild(img);
      const sp = document.createElement("span"); sp.className = "abbr"; sp.innerText = abbr;
      if (this.config.highlightedTeams.includes(abbr)) sp.classList.add("team-highlight");
      if (isFin) sp.classList.add("final");
      tdT.appendChild(sp); tr.appendChild(tdT);
      const runVal = show ? t.score : "";
      const hitVal = show ? (i===0 ? (lines.away?.hits ?? "") : (lines.home?.hits ?? "")) : "";
      const errVal = show ? (t.errors != null ? t.errors : (i===0 ? (lines.away?.errors ?? "") : (lines.home?.errors ?? ""))) : "";
      [runVal, hitVal, errVal].forEach(val => {
        const td = document.createElement("td");
        td.className = (live || isWarmup) ? "rhe-cell live" : "rhe-cell";
        td.innerText = val;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    return table;
  },

  createStandingsTable(group) {
    const table = document.createElement("table"); table.className = "mlb-standings";
    const headers = ["","W-L","W%","GB","Streak","L10","Home","Away"];
    const trH = document.createElement("tr"); headers.forEach(txt => { const th = document.createElement("th"); th.innerText = txt; trH.appendChild(th); }); table.appendChild(trH);
    group.teamRecords.forEach(rec => {
      const tr = document.createElement("tr"); const ab = ABBREVIATIONS[rec.team.name] || "";
      if (this.config.highlightedTeams.includes(ab)) tr.classList.add("team-highlight");
      const tdTeam = document.createElement("td"); tdTeam.className = "team-cell";
      const img2 = document.createElement("img"); img2.src = this.getLogoUrl(ab); img2.alt = ab; img2.className = "logo-cell"; tdTeam.appendChild(img2);
      const sp2 = document.createElement("span"); sp2.className = "abbr"; sp2.innerText = ab; tdTeam.appendChild(sp2);
      tr.appendChild(tdTeam);
      const lr = rec.leagueRecord || {}; const W = parseInt(lr.wins)||0; const L = parseInt(lr.losses)||0;
      const pct = (W+L>0)?((W/(W+L)).toFixed(3).replace(/^0/,"")):"-";
      [`${W}-${L}`, pct].forEach(val=>{ const td=document.createElement("td"); td.innerText=val; tr.appendChild(td); });
      let gb = rec.divisionGamesBack; if (gb!=null&&gb!="-") { const f=parseFloat(gb),m=Math.floor(f),r=f-m; if (Math.abs(r)<1e-6) gb=`${m}`; else if(r===0.5) gb=m===0?"½":`${m}½`; else gb=f.toString(); }
      const tdGB=document.createElement("td"); tdGB.innerText=gb; tr.appendChild(tdGB);
      const tdSt=document.createElement("td"); tdSt.innerText=rec.streak?.streakCode||"-"; tr.appendChild(tdSt);
      let l10="-"; const s10=rec.records?.splitRecords?.find(s=>s.type.toLowerCase()==="lastten"); if (s10) l10=`${s10.wins}-${s10.losses}`;
      const td10=document.createElement("td"); td10.innerText=l10; tr.appendChild(td10);
      ["home","away"].forEach(type=>{ let v="-"; const sp=rec.records?.splitRecords?.find(s=>s.type.toLowerCase()===type); if(sp) v=`${sp.wins}-${sp.losses}`; const td=document.createElement("td"); td.innerText=v; tr.appendChild(td); });
      table.appendChild(tr);
    });
    return table;
  },

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
