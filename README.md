# Super BomberBoyz

Retro bomb battles in your browser for 1–8 players. Play online with friends without a server of your own (WebRTC via PeerJS), or solo against bots.

**Play here:** https://bomberboyz.no/
**With video and voice chat (max 4):** https://bomberboyz.no/videochat/

- **Create room** gives you a room code and a link to share. Friends open the link and hit **Join**.
- The host can fill empty slots with bots and presses **Start**.
- Controls: arrow keys or WASD, Space = bomb, M = sound on/off. On tablet and phone (landscape): d-pad on the left, bomb button on the right.
- Up to 8 players. The front page always uses the big board (27×23); /videochat/ uses the classic board (13×11). **Top Players** shows the shared all-players list only (your own stats are still stored locally but not shown).
- The whole board is always visible, scaled to the window, with the player list in a column to the left (one row per board tile row). The game goes fullscreen when you start (Create room, Join, Play vs bots, Start); Esc is respected for the rest of that game, F toggles fullscreen. Sound is on by default (no sound button). **Quit** sits to the right of the board and asks before leaving.
- Always landscape, same layout on every screen (whole board, no follow camera). Hold a phone or tablet upright and you'll see **Rotate your device**. The manifest asks for landscape/fullscreen when added to the home screen.
- Each round lasts 3:00. The red countdown shows above the board for the last 30 s. At 2:30 it's **HURRY UP!**: solid blocks drop in a spiral from the bottom-left corner, clockwise along the outer edge and then the next ring inwards (classic board two rings, big board three). Get hit by a block and you're out (nobody gets the kill). Bombs, power-ups and brick walls under the block disappear.
- It's a draw if time runs out before only one player is left, or if the last players die at the same time – no win, but the round counts as played.
- Power-ups: 💣 more bombs, 🔥 longer flames, ⚡ speed, 🥊 Boxing glove: punch bombs away (walk into a bomb and it slides until it hits something).
- The name field is empty with "Player" as a hint. Leave it empty and you're "Player".

## Video chat (/videochat/)
- Camera and mic between everyone in the room (full mesh of PeerJS MediaConnections, max 4); the logic lives in `videochat/video.js`. The video chat version uses the classic board and max 4 players.
- 320×240 @ 15 fps, echo cancellation and noise suppression, max about 250 kbit/s video per receiver.
- Say no to camera/mic and you can still play and see/hear the others.

## Music and sound
- All music and sound effects are original, generated with Web Audio while the game runs (`bbx.js`). No audio files, no borrowed tunes.
- Battle music, menu music, win and draw jingles, and effects for bombs, explosions, walls, power-ups, kicks, deaths and the countdown.
- Sound starts on your first tap or click. **M** toggles sound; the choice is remembered.

## Leaderboards
- **Best in room:** the host counts wins, rounds and kills per name while the room lives. Shown between rounds and in the lobby.
- **Top Players (all players):** the shared list, turned on in `bbx-config.js`. See `backend/README.md`. The server's messages are in Norwegian and are mapped to English in the browser.

## Structure
- `/` – main version without video: 8 players, big board (PeerJS prefix `bomberboyz2-v1-`).
- `/videochat/` – version with video and voice chat (PeerJS prefix `bomberboyz2-video-v1-`). Separate rooms, no collisions.
- `bbx.js` – music, sound and leaderboard (shared by both), `bbx-config.js` – settings for the shared leaderboard, `backend/` – server for the shared leaderboard.
- Old addresses redirect with room code (`?rom=`) and hash: `/legacy/` → `/`, `/video/` → `/videochat/`.
- Name, local stats and sound choice are stored in the browser and shared by both versions.

All graphics are original and drawn in code (`game.js`). PeerJS (MIT) is in `peerjs.min.js`.
