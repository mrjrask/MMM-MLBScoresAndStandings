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
const DIV_PAIRS = [
  [204, 201], // NL East & AL East
  [205, 202], // NL Central & AL Central
  [203, 200]  // NL West  & AL West
];
const WILD_CARD_ORDER = ["NL", "AL"];
const DIVISION_LABELS = {
  204: "NL East", 205: "NL Central", 203: "NL West",
  201: "AL East", 202: "AL Central", 200: "AL West",
  "NL": "NL Wild Card", "AL": "AL Wild Card"
};

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores:          1   * 60 * 1000,
    updateIntervalStandings:     15   * 60 * 1000,
    gamesPerPage:                    8,
    logoType:                    "color",
    rotateIntervalScores:           15  * 1000,
    rotateIntervalEast:             7   * 1000,
    rotateIntervalCentral:         12   * 1000,
    rotateIntervalWest:             7   * 1000,
    standingsPerPage:                2,
    rotateIntervalStandingsSingle:   7   * 1000,
    timeZone:                   "America/Chicago",
    highlightedTeams:               [],
    showTitle:                     true
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
    this.totalStandPages = DIV_PAIRS.length + WILD_CARD_ORDER.length;
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
    const total = this.totalGamePages + this.totalStandPages;
    let delay;
    if (this.currentScreen < this.totalGamePages) {
      delay = this.config.rotateIntervalScores;
    } else {
      const idx = this.currentScreen - this.totalGamePages;
      if (this.config.standingsPerPage === 1) {
        delay = this.config.rotateIntervalStandingsSingle;
      } else {
        const iv = [
          this.config.rotateIntervalCentral,
          this.config.rotateIntervalEast,
          this.config.rotateIntervalWest
        ];
        delay = iv[idx] || this.config.rotateIntervalEast;
      }
    }
    clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => {
      this.currentScreen = (this.currentScreen + 1) % total;
      this.updateDom(1000);
      this._scheduleRotate();
    }, delay);
  },

  socketNotificationReceived(n, p) {
    if (n === "GAMES") {
      this.loadedGames    = true;
      this.games          = p;
      this.totalGamePages = Math.max(1, Math.ceil(p.length / this.config.gamesPerPage));
      this.updateDom();
    }
    if (n === "STANDINGS") {
      this.loadedStandings = true;
      this.recordGroups    = p;
      this.updateDom();
    }
  },

  _noData(msg) {
    const w = document.createElement("div");
    w.className = "small dimmed";
    w.innerText = msg;
    return w;
  },

  getDom() {
    const w = document.createElement("div");
    const g = this.currentScreen < this.totalGamePages;
    w.className = g ? "scores-screen" : "standings-screen";

    if (g && !this.loadedGames) return this._noData("Loading games...");
    if (!g && !this.loadedStandings) return this._noData("Loading standings...");
    if (g && this.games.length === 0) return this._noData("No games to display.");
    if (!g && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

    const c = g ? this._buildGames() : this._buildStandings();
    w.appendChild(c);
    return w;
  },

  _buildGames() {
    const s = this.currentScreen * this.config.gamesPerPage;
    const g = this.games.slice(s, s + this.config.gamesPerPage);
    const w = document.createElement("div"); w.className = "games-columns";
    const h = Math.ceil(g.length/2);
    [g.slice(0,h), g.slice(h)].forEach(col => {
      const d = document.createElement("div"); d.className="game-col";
      col.forEach(game => d.appendChild(this.createGameBox(game)));
      w.appendChild(d);
    });
    return w;
  },

  _buildStandings() {
    const idx = this.currentScreen - this.totalGamePages;
    const w   = document.createElement("div");
    if (idx < DIV_PAIRS.length) {
      w.className = "standings-pair";
      DIV_PAIRS[idx].forEach(id => w.appendChild(this._createStandingsBlock(id)));
    } else {
      w.className = "standings-single";
      const wc = idx - DIV_PAIRS.length;
      w.appendChild(this._createWildCardBlock(WILD_CARD_ORDER[wc]));
    }
    return w;
  },

  _createStandingsBlock(id) {
    const b = document.createElement("div"); b.className="standings-division";
    const h3= document.createElement("h3");
    h3.innerText = DIVISION_LABELS[id];
    h3.style.margin = "0";
    b.appendChild(h3);
    const g = this.recordGroups.find(r=>r.division.id===id);
    b.appendChild(this.createStandingsTable(g, false));
    return b;
  },

  _createWildCardBlock(lg) {
    const b = document.createElement("div"); b.className="standings-division";
    const h3= document.createElement("h3");
    h3.innerText = DIVISION_LABELS[lg];
    h3.style.margin = "0";
    b.appendChild(h3);
    const recs = this.recordGroups
      .filter(r=>r.division.name.startsWith(lg))
      .flatMap(r=>r.teamRecords)
      .sort((a,b)=>b.wins-a.wins||a.losses-b.losses);
    b.appendChild(this.createStandingsTable({teamRecords:recs}, true));
    return b;
  },

  createStandingsTable(group, wc=false) {
    const t = document.createElement("table"); t.className="mlb-standings";
    const thR = document.createElement("tr");
    ["","W-L","W%","GB","Streak","L10","Home","Away"].forEach(txt=>{
      const th=document.createElement("th"); th.innerText=txt; thR.appendChild(th);
    });
    t.appendChild(thR);
    group.teamRecords.forEach((rec,i)=>{
      const tr=document.createElement("tr");
      if(wc&&i===3) tr.style.borderTop="2px solid #FFD242";
      const tdT=document.createElement("td"); tdT.className="team-cell";
      const img=document.createElement("img"); img.src=this.getLogoUrl(ABBREVIATIONS[rec.team.name]||"");
      img.alt=ABBREVIATIONS[rec.team.name]||""; img.className="logo-cell"; img.onerror=()=>img.style.display='none';
      tdT.appendChild(img);
      const sp=document.createElement("span"); sp.className="abbr"; sp.innerText=ABBREVIATIONS[rec.team.name]||"";
      tdT.appendChild(sp); tr.appendChild(tdT);
      const lr=rec.leagueRecord||{}; const W=+lr.wins||0; const L=+lr.losses||0;
      const pct=(W+L>0?((W/(W+L)).toFixed(3).replace(/^0/,"")):"-");
      [`${W}-${L}`,pct].forEach(v=>{const td=document.createElement("td");td.innerText=v;tr.appendChild(td);});
      let gb=rec.divisionGamesBack;
      if(gb!=null&&gb!="-"){const f=parseFloat(gb),m=Math.floor(f),r=f-m;
        if(Math.abs(r)<1e-6) gb=`${m}`; else if(r===0.5) gb=m===0?"1/2":`${m}1/2`; else gb=f.toString();}
      const tdG=document.createElement("td");tdG.innerText=gb;tr.appendChild(tdG);
      const lt=rec.records?.splitRecords?.find(s=>s.type.toLowerCase()==="lastten");
      const l10=lt?`${lt.wins}-${lt.losses}`:"-";
      const home=rec.records?.splitRecords?.find(s=>s.type.toLowerCase()==="home");
      const away=rec.records?.splitRecords?.find(s=>s.type.toLowerCase()==="away");
      [rec.streak?.streakCode||"-",l10,
       home?`${home.wins}-${home.losses}`:"-",
       away?`${away.wins}-${away.losses}`:"-"
      ].forEach(v=>{const td=document.createElement("td");td.innerText=v;tr.appendChild(td);});
      t.appendChild(tr);
    });
    return t;
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
    if (isSuspended) statusText = "Suspended";
    else if (isPost) statusText = "Postponed";
    else if (isWarmup) statusText = "Warmup";
    else if (isPrev) {
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
        if ((i === 0 && awayL) || (i === 1 && homeL)) tr.classList.add("loser");
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
        ? (i === 0 ? (lines.away?.hits ?? "") : (lines.home?.hits ?? ""))
        : "";
      const errVal = show
        ? (t.errors != null ? t.errors
            : (i === 0 ? (lines.away?.errors ?? "") : (lines.home?.errors ?? "")))
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

  getLogoUrl(abbr) {
    return this.file(`logos/${this.config.logoType}/${abbr}.png`);
  }
});
