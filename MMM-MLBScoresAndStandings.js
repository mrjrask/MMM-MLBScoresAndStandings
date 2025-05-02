console.log("[MMM-MLBScoresAndStandings] front-end loaded");

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

    // Today's Games
    const gamesTable = document.createElement("table");
    gamesTable.className = "mlb-games";
    this.games.forEach(game => {
      const row = document.createElement("tr");
      // Home team
      const hom = game.teams.home;
      const away = game.teams.away;
      row.innerHTML = `
        <td><img src="${this.getLogoUrl(hom.team.id)}" /></td>
        <td>${hom.score}</td>
        <td>–</td>
        <td>${away.score}</td>
        <td><img src="${this.getLogoUrl(away.team.id)}" /></td>
        <td>${this.formatStatus(game.status)}</td>
      `;
      gamesTable.appendChild(row);
    });
    wrapper.appendChild(gamesTable);

    // Standings
    const standTable = document.createElement("table");
    standTable.className = "mlb-standings";
    this.standings.forEach(teamRec => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><img src="${this.getLogoUrl(teamRec.team.id)}" /></td>
        <td>${teamRec.wins}-${teamRec.losses}</td>
        <td>${teamRec.divisionGamesBack || "–"}</td>
        <td>${teamRec.wildCardGamesBack || "–"}</td>
        <td>${teamRec.streak.streakCode}</td>
        <td>${teamRec.records[0].summary || teamRec.records.slice(-1)[0].summary}</td>
      `;
      standTable.appendChild(row);
    });
    wrapper.appendChild(standTable);

    return wrapper;
  },

  // MLB static logo URLs:
  getLogoUrl(teamId) {
    return `https://www.mlbstatic.com/team-logos/${teamId}/primary/60x60.png`;
  },

  formatStatus(statusObj) {
    if (statusObj.abstractGameState === "Final") {
      const innings = statusObj.detailedState.includes("F/") 
        ? statusObj.detailedState.replace("Final/", "")
        : "";
      return innings ? `F/${innings}` : "F";
    }
    if (statusObj.abstractGameState === "In Progress") {
      return statusObj.currentInningOrdinal;
    }
    return statusObj.abstractGameState; // e.g., Scheduled
  }
});
