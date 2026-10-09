# BomberBoyz 2 – prototype med video og lyd

Testversjon på https://bomberboyz.no/video/. Hovedspillet på roten er uendret.

- Samme spill, men med kamera og mikrofon mellom alle spillerne i rommet (full mesh av PeerJS MediaConnections, maks 4).
- Egne rom: PeerJS-prefikset er `bomberboyz2-video-v1-`, så rom her kolliderer ikke med hovedspillet.
- `video.js` inneholder all video/lyd-logikk. `game.js` har bare små kroker (peer-id og kamera/mikrofon-status i lobbymeldingen).
- 320×240 @ 15 fps, ekkokansellering og støydemping, maks ca. 250 kbit/s video per mottaker.
- Nekter du kamera/mikrofon, kan du fortsatt spille og se/høre de andre.
