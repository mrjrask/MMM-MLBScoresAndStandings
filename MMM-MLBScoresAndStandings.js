console.log("[MMM-MLBScoresAndStandings] front-end loaded");

const moment = require("moment");

Module.register("MMM-MLBScoresAndStandings", {
  defaults: {
    updateIntervalScores: 2 * 60 * 1000,
    updateIntervalStandings: 15 * 60 * 1000,
    position: "top_right"
  },

  start() {
    this.games = [];
    this.standings = [];
    this.sendSocketNotification("INIT");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GAMES") {
      this.games = payload;
      this.updateDom();
    }
    if (notification === "STANDINGS") {
      this.standings = payload;
      this.updateDom();
    }
  },

  getStyles() {
    return ["MMM-MLBScoresAndStandings.css"];
  },

  getDom() {
    const wrapper = document.createElement("div");

    // ——— Games Section ———
    const gamesHeader = document.createElement("h3");
    gamesHeader.innerText = "Today's Games";
    wrapper.appendChild(gamesHeader);

    const gamesTable = document.createElement("table");
    gamesTable.className = "mlb-games";

    this.games.forEach(game => {
      const { team: homeTeam, score: homeScore } = game.teams.home;
      const { team: awayTeam, score: awayScore } = game.teams.away;
      const statusText = this.formatStatus(game);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><img src="${this.getLogoUrl(homeTeam.id)}" alt="${homeTeam.name}" /></td>
        <td>${homeScore}</td>
        <td>–</td>
        <td>${awayScore}</td>
        <td><img src="${this.getLogoUrl(awayTeam.id)}" alt="${awayTeam.name}" /></td>
        <td class="status">${statusText}</td>
      `;
      gamesTable.appendChild(row);
    });

    wrapper.appendChild(gamesTable);

    // ——— Standings Section ———
    const standHeader = document.createElement("h3");
    standHeader.innerText = "Standings";
    wrapper.appendChild(standHeader);

    const standTable = document.createElement("table");
    standTable.className = "mlb-standings";

    this.standings.forEach(teamRec => {
      const { team, wins, losses, divisionGamesBack, wildCardGamesBack, streak, records } = teamRec;
      // For L10 we’ll grab the “records” array’s last summary if available
      const l10 = (records.find(r => r.type === "lastTen") || {}).summary || "–";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><img src="${this.getLogoUrl(team.id)}" alt="${team.name}" /></td>
        <td>${wins}-${losses}</td>
        <td>${divisionGamesBack || "–"}</td>
        <td>${wildCardGamesBack || "–"}</td>
        <td>${streak.streakCode}</td>
        <td>${l10}</td>
      `;
      standTable.appendChild(row);
    });

    wrapper.appendChild(standTable);
    return wrapper;
  },

  getLogoUrl(teamId) {
    return `https://www.mlbstatic.com/team-logos/${teamId}/primary/60x60.png`;
  },

  formatStatus(game) {
    const { abstractGameState, detailedState, currentInningOrdinal } = game.status;

    if (abstractGameState === "Final") {
      // detailedState might be "Final/10"
      const parts = detailedState.split("/");
      return parts[1] ? `F/${parts[1]}` : "F";
    }

    if (abstractGameState === "In Progress") {
      return currentInningOrdinal;
    }

    if (abstractGameState === "Preview") {
      // show local start time like "7:10 PM"
      return moment(game.gameDate).local().format("h:mm A");
    }

    // fallback (shouldn’t hit often)
    return detailedState || abstractGameState;
  }
});
