# BomberBoyz 2

Retro bombespill i nettleseren for 1–4 spillere, med video- og lydchat mellom spillerne. Spill online med venner uten egen server (WebRTC via PeerJS), eller alene mot boter.

**Spill her:** https://bomberboyz.no/
**Gammel versjon uten video:** https://bomberboyz.no/legacy/

- **Lag rom** gir en romkode og en lenke du kan dele. Venner åpner lenken og trykker **Bli med**.
- Verten kan fylle tomme plasser med boter og trykker **Start**.
- Styring: piltaster eller WASD, mellomrom = bombe. På mobil vises knapper under brettet.
- Etter 90 sekunder begynner brettet å krympe.
- Navnefeltet er tomt med «Spiller» som hint. Skriver du ingenting, heter du «Spiller».

## Video og lyd
- Kamera og mikrofon mellom alle i rommet (full mesh av PeerJS MediaConnections, maks 4), logikken ligger i `video.js`.
- 320×240 @ 15 fps, ekkokansellering og støydemping, maks ca. 250 kbit/s video per mottaker.
- Nekter du kamera/mikrofon, kan du fortsatt spille og se/høre de andre.

## Struktur
- `/` – videoversjonen (PeerJS-prefiks `bomberboyz2-video-v1-`).
- `/legacy/` – originalversjonen uten video (PeerJS-prefiks `bomberboyz2-v1-`). Egne rom, kolliderer ikke.
- `/video/` – videresender til `/` med romkode (`?rom=`) og hash bevart.

All grafikk er original og tegnes i kode (`game.js`). PeerJS (MIT) ligger i `peerjs.min.js`.
