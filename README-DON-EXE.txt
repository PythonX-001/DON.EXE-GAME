DON.EXE — GAME + LEADERBOARD BACKEND
===================================

CONTENTS
- index.html       The updated game
- server.js        Backend API and ranking page (Node.js built-in modules only)
- package.json     Start command
- scores.json      Created automatically when the first public score is saved

RUN IT ON YOUR COMPUTER
1. Install Node.js 18 or newer.
2. Put index.html, server.js and package.json in the same folder.
3. Open a terminal in that folder and run:
      npm start
   (You can also run: node server.js)
4. Open the game at:
      http://localhost:3000
5. View the ranking page at:
      http://localhost:3000/leaderboard

HOW THE SCORES WORK
- The game asks the player to choose English or Arabic before entering a username.
- After a username is saved, the game submits the current score when it changes.
- Only public usernames, scores and game ranks are shown on the ranking page.
- Players can disable “Show me on the public leaderboard” in the username prompt/settings; opting out removes that browser's public record.
- Each browser profile gets its own player ID. Playing on another browser/device creates another entry.
- Scores are stored in scores.json on the server. Keep that file and use a hosting provider with persistent disk storage if you deploy online.

DEPLOYMENT
Deploy the folder as a Node.js web service and use `npm start`. Make sure the hosting platform supports persistent local files, or adapt the storage layer to a managed database. Share the deployed site's URL with players; /leaderboard is the ranking page.

IMPORTANT LIMITATIONS
This starter backend has no administrator login and /leaderboard is public. Scores are sent by the game client, so someone who deliberately modifies their browser can fake a score; this is suitable for a casual leaderboard, not a tamper-proof competition. Use a private/authenticated dashboard and server-side score validation before collecting data you need to keep private or enforce competitively.
