MMM-MLBScoresAndStandings

MagicMirror² Module to display Major League Baseball (MLB) Scoreboard and Standings in rotating views.

⸻

Features
	•	Live Scores
	  •	Shows today’s games in a two-column grid
	  •	Displays runs, hits, errors for away and home teams
	  •	Status cell shows:
	    • Pre-game time (in Central Time)
	    • Warmup, Delayed, Postponed, In Progress
	    •	Final (F) or extra innings (F/10 etc.)
	  •	Live games use yellow text; completed games use white
	  •	Paginated view with configurable number of games per page
	•	MLB Standings
	  •	Rotates through three pairs of divisions (East, Central, West)
	  •	Side-by-side NL & AL standings for each region
	  •	Columns: Team, W-L, Winning %, GB, Streak, Last 10, Home, Away
	  •	Cubs row highlighted in amber
	•	Flexible Intervals
	  •	Independent fetch intervals for scores and standings
	  •	Separate rotate intervals for scores, East, Central, and West pages
	•	Custom Logos
	  •	Supports color or black-and-white logo sets
	  •	Logos loaded from modules/MMM-MLBScoresAndStandings/logos/{color|bw}/{abbr}.png

⸻

Installation

	1.	Navigate to your MagicMirror modules directory:
cd ~/MagicMirror/modules
	2.	Clone this repository:
git clone https://github.com/mrjrask/MMM-MLBScoresAndStandings.git
	3.	Install dependencies:
cd MMM-MLBScoresAndStandings
npm install

⸻

Configuration

Edit your config/config.js and add the module block:
{
  module: "MMM-MLBScoresAndStandings",
  position: "bottom_right",  // or your desired region
  config: {
    // Data fetch intervals
    updateIntervalScores:    2 * 60 * 1000,  // every 2 minutes
    updateIntervalStandings: 15 * 60 * 1000, // every 15 minutes

    // Pagination & assets
    gamesPerPage: 16,        // number of games per page
    logoType:    "color",    // "color" or "bw"

    // Rotation intervals (milliseconds)
    rotateIntervalScores:   10 * 1000,  // 10 seconds for scores pages
    rotateIntervalEast:      7 * 1000,  // 7 seconds for East standings
    rotateIntervalCentral:  10 * 1000,  // 10 seconds for Central standings
    rotateIntervalWest:     12 * 1000   // 12 seconds for West standings
  }
},

⸻

Folder Structure

MMM-MLBScoresAndStandings/
├── MMM-MLBScoresAndStandings.js   # Main module file
├── MMM-MLBScoresAndStandings.css  # Styles
├── node_helper.js                 # Backend data fetcher
├── logos/                         # Logo sets
│   ├── color/
│   └── bw/
└── README.md                      # You are here

⸻

Troubleshooting
	•	No data / Loading… — check your internet, ensure API endpoints reachable.
	•	Wrong date — module uses Central Time by default.
	•	Missing logos — verify files in logos/color or logos/bw match team abbreviations.
