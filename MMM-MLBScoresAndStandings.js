/* MMM-MLBScoresAndStandings.js */
/* global Module */

(function () {
  "use strict";

  var ABBREVIATIONS = {
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

  // Division pairs (2 per page), then Wild Card pages (1 per page)
  var DIV_PAIRS = [
    [204, 201], // NL East & AL East
    [205, 202], // NL Central & AL Central
    [203, 200]  // NL West & AL West
  ];
  var WILD_CARD_ORDER = ["NL", "AL"];
  var NL_DIVS = { 203: true, 204: true, 205: true };
  var AL_DIVS = { 200: true, 201: true, 202: true };

  var DIVISION_LABELS = {
    204: "NL East", 205: "NL Central", 203: "NL West",
    201: "AL East", 202: "AL Central", 200: "AL West",
    "NL": "NL Wild Card", "AL": "AL Wild Card"
  };

  Module.register("MMM-MLBScoresAndStandings", {
    defaults: {
      updateIntervalScores:            60 * 1000,
      updateIntervalStandings:       15 * 60 * 1000,
      gamesPerPage:                      8,
      logoType:                      "color",
      rotateIntervalScores:           15 * 1000,
      rotateIntervalEast:              7 * 1000,
      rotateIntervalCentral:          12 * 1000,
      rotateIntervalWest:              7 * 1000,
      timeZone:               "America/Chicago",
      highlightedTeams:                 [],
      showTitle:                        true,

      // Standings options
      showHomeAwaySplits:               true,

      // Width cap so it behaves in middle_center
      maxWidth:                      "800px"
    },

    getHeader: function () {
      if (!this.config.showTitle) return null;
      return (this.currentScreen < this.totalGamePages) ? "MLB Scoreboard" : "MLB Standings";
    },

    getScripts: function () {
      return ["https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"];
    },

    getStyles: function () {
      return ["MMM-MLBScoresAndStandings.css"];
    },

    start: function () {
      this.games           = [];
      this.recordGroups    = []; // six division records from helper
      this.loadedGames     = false;
      this.loadedStandings = false;

      // pages: N game pages + 3 division pages (pair) + 2 wild card pages
      this.totalGamePages  = 1;
      this.totalStandPages = DIV_PAIRS.length + WILD_CARD_ORDER.length;
      this.currentScreen   = 0;
      this.rotateTimer     = null;
      this._headerStyleInjectedFor = null;

      this.sendSocketNotification("INIT", this.config);
      var self = this;
      setInterval(function () { self.sendSocketNotification("INIT", self.config); },
        Math.min(this.config.updateIntervalScores, this.config.updateIntervalStandings));

      this._scheduleRotate();
    },

    // ---------- helpers ----------
    _toCssSize: function (v, fallback) {
      if (fallback == null) fallback = "800px";
      if (v == null) return fallback;
      if (typeof v === "number") return v + "px";
      var s = String(v).trim();
      if (/^\d+$/.test(s)) return s + "px";
      return s;
    },

    _injectHeaderWidthStyle: function () {
      var cap = this._toCssSize(this.config.maxWidth, "800px");
      if (this._headerStyleInjectedFor === cap) return;

      var styleId = this.identifier + "-width-style";
      var el = document.getElementById(styleId);
      var css =
        "#" + this.identifier + " .module-header{max-width:" + cap + ";margin:0 auto;display:block;}";

      if (!el) {
        el = document.createElement("style");
        el.id = styleId;
        el.type = "text/css";
        el.textContent = css;
        document.head.appendChild(el);
      } else {
        el.textContent = css;
      }
      this._headerStyleInjectedFor = cap;
    },

    _scheduleRotate: function () {
      var total = this.totalGamePages + this.totalStandPages;
      var delay = this.config.rotateIntervalScores;

      if (this.currentScreen >= this.totalGamePages) {
        var idx = this.currentScreen - this.totalGamePages;
        var intervals = [
          this.config.rotateIntervalEast,    // pair 0
          this.config.rotateIntervalCentral, // pair 1
          this.config.rotateIntervalWest     // pair 2
        ];
        delay = intervals[idx] || this.config.rotateIntervalEast;
      }

      var self = this;
      clearTimeout(this.rotateTimer);
      this.rotateTimer = setTimeout(function () {
        self.currentScreen = (self.currentScreen + 1) % total;
        self.updateDom(300);
        self._scheduleRotate();
      }, delay);
    },

    socketNotificationReceived: function (notification, payload) {
      try {
        if (notification === "GAMES") {
          this.loadedGames    = true;
          this.games          = Array.isArray(payload) ? payload : [];
          this.totalGamePages = Math.max(1, Math.ceil(this.games.length / this.config.gamesPerPage));
          this.updateDom();
        }
        if (notification === "STANDINGS") {
          this.loadedStandings = true;
          this.recordGroups    = Array.isArray(payload) ? payload : [];
          this.updateDom();
        }
      } catch (e) {
        console.error("MMM-MLBScoresAndStandings: socket handler error", e);
      }
    },

    _noData: function (msg) {
      var div = document.createElement("div");
      div.className = "small dimmed";
      div.innerText = msg;
      return div;
    },

    getDom: function () {
      this._injectHeaderWidthStyle();

      var wrapper = document.createElement("div");
      var showingGames = this.currentScreen < this.totalGamePages;
      wrapper.className = showingGames ? "scores-screen" : "standings-screen";

      if (this.data && this.data.position !== "fullscreen_above") {
        var cssSize = this._toCssSize(this.config.maxWidth, "800px");
        wrapper.style.maxWidth = cssSize;
        wrapper.style.margin = "0 auto";
        wrapper.style.display = "block";
        wrapper.style.width = "100%";
        wrapper.style.overflow = "hidden";
      }

      if (showingGames && !this.loadedGames)       return this._noData("Loading games...");
      if (!showingGames && !this.loadedStandings)  return this._noData("Loading standings...");
      if (showingGames && this.games.length === 0) return this._noData("No games to display.");
      if (!showingGames && this.recordGroups.length === 0) return this._noData("Standings unavailable.");

      try {
        wrapper.appendChild(showingGames ? this._buildGames() : this._buildStandings());
      } catch (e) {
        console.error("MMM-MLBScoresAndStandings: getDom build error", e);
        return this._noData("Error building view.");
      }
      return wrapper;
    },

    // ----------------- SCOREBOARD -----------------
    _buildGames: function () {
      var start = this.currentScreen * this.config.gamesPerPage;
      var games = this.games.slice(start, start + this.config.gamesPerPage);

      var matrix = document.createElement("table");
      matrix.className = "games-matrix";

      var tbody = document.createElement("tbody");

      for (var i = 0; i < games.length; i += 2) {
        var row = document.createElement("tr");

        for (var col = 0; col < 2; col++) {
          var cell = document.createElement("td");
          cell.className = "games-matrix-cell";

          var game = games[i + col];
          if (game) {
            cell.appendChild(this.createGameBox(game));
          } else {
            cell.classList.add("empty");
          }

          row.appendChild(cell);
        }

        tbody.appendChild(row);
      }

      matrix.appendChild(tbody);
      return matrix;
    },

    // STATIC 4-COLUMN BOX SCORE (status/team, R, H, E)
    createGameBox: function (game) {
      var table = document.createElement("table");
      table.className = "game-boxscore";
      table.cellSpacing = 0;
      table.cellPadding = 0;

      // Fixed columns via <colgroup>
      var colgroup = document.createElement("colgroup");
      var colClasses = ["col-first", "col-r", "col-h", "col-e"];
      for (var ci = 0; ci < colClasses.length; ci++) {
        var c = document.createElement("col");
        c.className = colClasses[ci];
        colgroup.appendChild(c);
      }
      table.appendChild(colgroup);

      var ls      = (game && game.linescore) || {};
      var state   = (game && game.status && game.status.abstractGameState) || "";
      var det     = (game && game.status && game.status.detailedState) || "";
      var innings = (ls && ls.innings) || [];

      var isSuspended = /Suspended/i.test(det) || state === "Suspended";
      var isPost      = /Postponed/i.test(det);
      var isWarmup    = det === "Warmup";
      var isPrev      = state === "Preview";
      var isFin       = state === "Final";
      var live        = !isPrev && !isFin && !isPost && !isWarmup && !isSuspended;
      var showVals    = !isPrev && !isPost && !isSuspended;

      if (isFin) table.classList.add("is-final");
      else if (live) table.classList.add("is-live");
      else if (isPrev) table.classList.add("is-preview");
      else if (isPost) table.classList.add("is-postponed");
      else if (isSuspended) table.classList.add("is-suspended");
      else if (isWarmup) table.classList.add("is-warmup");

      var statusText;
      if (isSuspended)       statusText = "Suspended";
      else if (isPost)       statusText = "Postponed";
      else if (isWarmup)     statusText = "Warmup";
      else if (isPrev) {
        var d = new Date(game.gameDate);
        statusText = d.toLocaleTimeString("en-US", {
          timeZone: this.config.timeZone || "America/Chicago",
          hour12: true, hour: "numeric", minute: "2-digit"
        });
      } else if (isFin) {
        statusText = (innings.length === 9) ? "Final" : ("Final/" + innings.length);
      } else {
        var st = (ls && ls.inningState) || "";
        var io = (ls && ls.currentInningOrdinal) || "";
        var tmp = (st + " " + io).replace(/\s+/g, " ").trim();
        statusText = tmp || "In Progress";
      }

      // THEAD (status + R/H/E)
      var thead = document.createElement("thead");
      var trH = document.createElement("tr");

      var thS = document.createElement("th");
      thS.className = "status-cell col-first" + (live ? " live" : "");
      thS.innerText = statusText;
      trH.appendChild(thS);

      var labels = ["R","H","E"];
      for (var li = 0; li < labels.length; li++) {
        var th = document.createElement("th");
        th.className = "rhe-header";
        th.innerText = labels[li];
        trH.appendChild(th);
      }
      thead.appendChild(trH);
      table.appendChild(thead);

      // TBODY (away + home)
      var tbody = document.createElement("tbody");
      var away = game && game.teams && game.teams.away;
      var home = game && game.teams && game.teams.home;
      var awayScore = (away && typeof away.score !== "undefined") ? away.score : null;
      var homeScore = (home && typeof home.score !== "undefined") ? home.score : null;
      var lines = (ls && ls.teams) || {};

      var rows = [away, home];
      for (var ri = 0; ri < rows.length; ri++) {
        var t = rows[ri];
        if (!t || !t.team) continue;
        var tr = document.createElement("tr");

        if (isFin) {
          var awayL = (awayScore != null && homeScore != null) ? (awayScore < homeScore) : false;
          var homeL = (awayScore != null && homeScore != null) ? (homeScore < awayScore) : false;
          if ((ri === 0 && awayL) || (ri === 1 && homeL)) tr.classList.add("loser");
        }

        // First column: team (logo + abbr)
        var abbr = ABBREVIATIONS[t.team.name] || t.team.abbreviation || "";
        var tdTeam = document.createElement("td");
        tdTeam.className = "col-first";

        var teamWrap = document.createElement("div");
        teamWrap.className = "team-cell";

        var img = document.createElement("img");
        img.src = this.getLogoUrl(abbr);
        img.alt = abbr;
        img.className = "logo-cell";
        img.onerror = (function (imgEl) { return function () { imgEl.style.display = "none"; }; })(img);
        teamWrap.appendChild(img);

        var sp = document.createElement("span");
        sp.className = "abbr";
        sp.innerText = abbr;
        if (this._isHighlighted(abbr)) sp.classList.add("team-highlight");
        if (isFin) sp.classList.add("final");
        teamWrap.appendChild(sp);

        tdTeam.appendChild(teamWrap);
        tr.appendChild(tdTeam);

        // R / H / E
        var runVal = showVals ? ((typeof t.score !== "undefined") ? t.score : "") : "";
        var hitVal = showVals ? (ri === 0 ? (lines.away && lines.away.hits) : (lines.home && lines.home.hits)) : "";
        var errVal = showVals ? (
          (typeof t.errors !== "undefined") ? t.errors
            : (ri === 0 ? (lines.away && lines.away.errors) : (lines.home && lines.home.errors))
        ) : "";

        var vals = [runVal, hitVal, errVal];
        for (var vi = 0; vi < vals.length; vi++) {
          var td = document.createElement("td");
          td.className = "rhe-cell" + (live ? " live" : "");
          td.innerText = (vals[vi] == null ? "" : vals[vi]);
          tr.appendChild(td);
        }

        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      return table;
    },

    // ----------------- STANDINGS -----------------
    _buildStandings: function () {
      var idx = this.currentScreen - this.totalGamePages;
      var wrapper = document.createElement("div");

      if (idx < DIV_PAIRS.length) {
        wrapper.className = "standings-pair";
        for (var i = 0; i < DIV_PAIRS[idx].length; i++) {
          wrapper.appendChild(this._createDivisionBlock(DIV_PAIRS[idx][i]));
        }
      } else {
        wrapper.className = "standings-single";
        var wcIdx = idx - DIV_PAIRS.length;
        var league = WILD_CARD_ORDER[wcIdx]; // "NL" or "AL"
        wrapper.appendChild(this._createWildCardBlock(league));
      }
      return wrapper;
    },

    _createDivisionBlock: function (divId) {
      var block = document.createElement("div");
      block.className = "standings-division";

      var title = document.createElement("h3");
      title.className = "division-title";
      title.innerText = DIVISION_LABELS[divId];
      title.style.margin = "0";
      block.appendChild(title);

      var group = null;
      for (var i = 0; i < this.recordGroups.length; i++) {
        var g = this.recordGroups[i];
        if (g && g.division && g.division.id === divId) { group = g; break; }
      }
      if (!group) group = { teamRecords: [] };

      block.appendChild(this.createStandingsTable(group, { isWildCard: false }));
      return block;
    },

    _createWildCardBlock: function (league) {
      var block = document.createElement("div");
      block.className = "standings-division";

      var title = document.createElement("h3");
      title.className = "division-title";
      title.innerText = DIVISION_LABELS[league];
      title.style.margin = "0";
      block.appendChild(title);

      var wcGroup = this._buildWildCardGroup(league === "NL" ? NL_DIVS : AL_DIVS);
      block.appendChild(this.createStandingsTable(wcGroup, { isWildCard: true }));
      return block;
    },

    _pct: function (rec) {
      var w = parseInt(rec && rec.leagueRecord && rec.leagueRecord.wins || 0, 10);
      var l = parseInt(rec && rec.leagueRecord && rec.leagueRecord.losses || 0, 10);
      return (w + l) ? (w / (w + l)) : 0;
    },

    _cmpPctDesc: function (a, b) { return this._pct(b) - this._pct(a); },

    _leadersByDivision: function () {
      var m = {};
      for (var i = 0; i < this.recordGroups.length; i++) {
        var gr = this.recordGroups[i];
        var divId = gr && gr.division && gr.division.id;
        var trs = gr && gr.teamRecords || [];
        if (!divId || !trs.length) continue;
        var sorted = trs.slice().sort(this._cmpPctDesc.bind(this));
        var leader = sorted[0];
        if (leader && leader.team && typeof leader.team.id !== "undefined") {
          m[divId] = leader.team.id;
        }
      }
      return m;
    },

    _buildWildCardGroup: function (leagueDivsMap) {
      // Gather league’s division groups
      var leagueGroups = [];
      for (var i = 0; i < this.recordGroups.length; i++) {
        var gr = this.recordGroups[i];
        if (gr && gr.division && leagueDivsMap[gr.division.id]) leagueGroups.push(gr);
      }
      if (!leagueGroups.length) return { teamRecords: [] };

      var leaders = this._leadersByDivision();
      function isLeader(rec, divId) {
        return leaders[divId] === (rec && rec.team && rec.team.id);
      }

      // Pool of non-division-leaders
      var pool = [];
      for (var g = 0; g < leagueGroups.length; g++) {
        var divId = leagueGroups[g].division.id;
        var trs = leagueGroups[g].teamRecords || [];
        for (var t = 0; t < trs.length; t++) {
          if (!isLeader(trs[t], divId)) pool.push(trs[t]);
        }
      }
      if (!pool.length) return { teamRecords: [] };

      // Sort by pct desc, then wins desc
      var sortedByPct = pool.slice().sort(function (a, b) {
        var pctDelta = (this._cmpPctDesc(a, b));
        if (pctDelta !== 0) return pctDelta;
        var aw = parseInt(a && a.leagueRecord && a.leagueRecord.wins || 0, 10);
        var bw = parseInt(b && b.leagueRecord && b.leagueRecord.wins || 0, 10);
        return bw - aw;
      }.bind(this));

      // Baseline = 3rd team
      var base = sortedByPct[Math.min(2, sortedByPct.length - 1)];

      function wcgbNum(r) {
        if (!base || !r) return 0;
        var bw = parseInt(base.leagueRecord && base.leagueRecord.wins || 0, 10);
        var bl = parseInt(base.leagueRecord && base.leagueRecord.losses || 0, 10);
        var rw = parseInt(r.leagueRecord && r.leagueRecord.wins || 0, 10);
        var rl = parseInt(r.leagueRecord && r.leagueRecord.losses || 0, 10);
        return Math.max(0, ((bw - rw) + (rl - bl)) / 2);
      }

      var withWCGB = sortedByPct.map(function (r) {
        var n = wcgbNum(r);
        r._wcgbNum = n;
        r._wcgbText = this._formatGB(n);
        return r;
      }.bind(this)).sort(function (a, b) {
        if (a._wcgbNum !== b._wcgbNum) return a._wcgbNum - b._wcgbNum; // closer to 0 first
        var pctDelta = (this._cmpPctDesc(a, b));
        if (pctDelta !== 0) return pctDelta;
        var aw = parseInt(a.leagueRecord && a.leagueRecord.wins || 0, 10);
        var bw = parseInt(b.leagueRecord && b.leagueRecord.wins || 0, 10);
        return bw - aw;
      }.bind(this));

      return { teamRecords: withWCGB };
    },

    _formatGB: function (num) {
      if (num == null) return "-";
      if (typeof num === "string") {
        if (num === "-" || num.trim() === "") return "-";
        var f = parseFloat(num);
        if (!isNaN(f)) num = f; else return "-";
      }
      if (Math.abs(num) < 1e-6) return "--";
      var m = Math.floor(num + 1e-9);
      var r = num - m;
      if (Math.abs(r - 0.5) < 1e-6) {
        return (m === 0)
          ? "<span class=\"fraction\">1/2</span>"
          : (m + "<span class=\"fraction\">1/2</span>");
      }
      if (Math.abs(r) < 1e-6) return String(m);
      return num.toFixed(1).replace(/\.0$/, "");
    },

    _formatENum: function (val) {
      if (val == null) return "-";
      if (val === "-" || val === "--") return val;
      var n = parseInt(val, 10);
      if (!isNaN(n)) return n === 0 ? "--" : String(n);
      return String(val);
    },

    _appendHeaderCell: function (tr, label, cls, sepRight) {
      var th = document.createElement("th");
      th.innerText = label;
      if (cls) th.classList.add(cls);
      if (sepRight) th.classList.add("sep-right");
      tr.appendChild(th);
    },

    createStandingsTable: function (group, opts) {
      opts = opts || {};
      var isWildCard = !!opts.isWildCard;
      var showSplits = !!this.config.showHomeAwaySplits;

      var table = document.createElement("table");
      table.className = isWildCard ? "mlb-standings mlb-standings--wc" : "mlb-standings mlb-standings--div";

      // HEADERS
      var trH = document.createElement("tr");
      if (isWildCard) {
        // ["", "W-L", "W%", "WCGB", "E#", "Streak", "L10", [Home, Away]]
        this._appendHeaderCell(trH, "",     "team-col");
        this._appendHeaderCell(trH, "W-L",  "wl-col");
        this._appendHeaderCell(trH, "W%",   "pct-col", true); // thick after W%
        this._appendHeaderCell(trH, "WCGB", "wcgb-col");
        this._appendHeaderCell(trH, "E#",   "wce-col", true); // thick after WCE#
        this._appendHeaderCell(trH, "Streak","streak-col");
        this._appendHeaderCell(trH, "L10",  "l10-col");
        if (showSplits) {
          this._appendHeaderCell(trH, "Home","home-col");
          this._appendHeaderCell(trH, "Away","away-col");
        }
      } else {
        // ["", "W-L", "W%", "GB", "E#", "WCGB", "E#", "Streak", "L10", [Home, Away]]
        this._appendHeaderCell(trH, "",     "team-col");
        this._appendHeaderCell(trH, "W-L",  "wl-col");
        this._appendHeaderCell(trH, "W%",   "pct-col", true); // thick after W%
        this._appendHeaderCell(trH, "GB",   "gb-col");
        this._appendHeaderCell(trH, "E#",   "e-col",  true);  // thick between E# and WCGB
        this._appendHeaderCell(trH, "WCGB", "wcgb-col");
        this._appendHeaderCell(trH, "E#",   "wce-col", true); // thick between WCE# and Streak
        this._appendHeaderCell(trH, "Streak","streak-col");
        this._appendHeaderCell(trH, "L10",  "l10-col");
        if (showSplits) {
          this._appendHeaderCell(trH, "Home","home-col");
          this._appendHeaderCell(trH, "Away","away-col");
        }
      }
      table.appendChild(trH);

      // ROWS
      var trs = (group && group.teamRecords) ? group.teamRecords : [];
      for (var i = 0; i < trs.length; i++) {
        var rec = trs[i];
        var tr = document.createElement("tr");
        if (isWildCard && i === 3) tr.style.borderTop = "2px solid #FFD242"; // separator after top 3

        var ab = "";
        if (rec && rec.team) {
          ab = ABBREVIATIONS[rec.team.name] || rec.team.abbreviation || "";
        }
        if (this._isHighlighted(ab)) tr.classList.add("team-highlight");

        // Team
        var tdT = document.createElement("td");
        tdT.className = "team-col team-cell";

        var img = document.createElement("img");
        img.src = this.getLogoUrl(ab);
        img.alt = ab;
        img.className = "logo-cell";
        img.onerror = (function (imgEl) { return function () { imgEl.style.display = "none"; }; })(img);
        tdT.appendChild(img);

        var sp = document.createElement("span");
        sp.className = "abbr";
        sp.innerText = ab;
        tdT.appendChild(sp);

        tr.appendChild(tdT);

        // W-L, W%
        var lr = rec && rec.leagueRecord || {};
        var W  = parseInt(lr.wins || 0, 10);
        var L  = parseInt(lr.losses || 0, 10);
        var pct = (W + L > 0) ? ((W / (W + L)).toFixed(3).replace(/^0/, "")) : "-";

        var tdWL = document.createElement("td");
        tdWL.className = "wl-col";
        tdWL.innerText = (W + "-" + L);
        tr.appendChild(tdWL);

        var tdPct = document.createElement("td");
        tdPct.className = "pct-col sep-right"; // thick after W%
        tdPct.innerText = pct;
        tr.appendChild(tdPct);

        if (isWildCard) {
          // WCGB, E#(wildcard)
          var tdWC = document.createElement("td");
          tdWC.className = "wcgb-col";
          tdWC.innerHTML = (typeof rec._wcgbText === "string")
            ? rec._wcgbText
            : this._formatGB(rec && rec.wildCardGamesBack);
          tr.appendChild(tdWC);

          var tdEw = document.createElement("td");
          tdEw.className = "wce-col sep-right";
          tdEw.innerText = this._formatENum(rec && rec.wildCardEliminationNumber);
          tr.appendChild(tdEw);
        } else {
          // GB, E# (division)
          var tdGB = document.createElement("td");
          tdGB.className = "gb-col";
          tdGB.innerHTML = this._formatGB(rec && rec.divisionGamesBack);
          tr.appendChild(tdGB);

          var tdEd = document.createElement("td");
          tdEd.className = "e-col sep-right";
          tdEd.innerText = this._formatENum(rec && rec.eliminationNumber);
          tr.appendChild(tdEd);

          // WCGB, E# (wildcard)
          var tdWC2 = document.createElement("td");
          tdWC2.className = "wcgb-col";
          tdWC2.innerHTML = this._formatGB(rec && rec.wildCardGamesBack);
          tr.appendChild(tdWC2);

          var tdEwc2 = document.createElement("td");
          tdEwc2.className = "wce-col sep-right";
          tdEwc2.innerText = this._formatENum(rec && rec.wildCardEliminationNumber);
          tr.appendChild(tdEwc2);
        }

        // Streak
        var tdStreak = document.createElement("td");
        tdStreak.className = "streak-col";
        tdStreak.innerText = (rec && rec.streak && rec.streak.streakCode) ? rec.streak.streakCode : "-";
        tr.appendChild(tdStreak);

        // L10
        var splitRecs = (rec && rec.records && rec.records.splitRecords) ? rec.records.splitRecords : [];
        var s10 = null;
        for (var s = 0; s < splitRecs.length; s++) {
          var typ = (splitRecs[s].type || "").toLowerCase();
          if (typ === "lastten") { s10 = splitRecs[s]; break; }
        }
        var tdL10 = document.createElement("td");
        tdL10.className = "l10-col";
        tdL10.innerText = s10 ? (s10.wins + "-" + s10.losses) : "-";
        tr.appendChild(tdL10);

        // Home/Away (optional)
        if (showSplits) {
          var home = null, away = null;
          for (var s2 = 0; s2 < splitRecs.length; s2++) {
            var typ2 = (splitRecs[s2].type || "").toLowerCase();
            if (typ2 === "home") home = splitRecs[s2];
            if (typ2 === "away") away = splitRecs[s2];
          }
          var tdHome = document.createElement("td");
          tdHome.className = "home-col";
          tdHome.innerText = home ? (home.wins + "-" + home.losses) : "-";
          tr.appendChild(tdHome);

          var tdAway = document.createElement("td");
          tdAway.className = "away-col";
          tdAway.innerText = away ? (away.wins + "-" + away.losses) : "-";
          tr.appendChild(tdAway);
        }

        table.appendChild(tr);
      }

      return table;
    },

    _isHighlighted: function (abbr) {
      var h = this.config.highlightedTeams;
      if (Array.isArray(h)) return h.indexOf(abbr) !== -1;
      if (typeof h === "string") return h.toUpperCase() === String(abbr).toUpperCase();
      return false;
    },

    getLogoUrl: function (abbr) {
      return this.file("logos/" + this.config.logoType + "/" + abbr + ".png");
    }
  });
})();
