# BomberBoyz 2

Retro bombespill i nettleseren for 1–4 spillere, med video- og lydchat mellom spillerne. Spill online med venner uten egen server (WebRTC via PeerJS), eller alene mot boter.

**Spill her:** https://bomberboyz.no/
**Gammel versjon uten video:** https://bomberboyz.no/legacy/

- **Lag rom** gir en romkode og en lenke du kan dele. Venner åpner lenken og trykker **Bli med**.
- Verten kan fylle tomme plasser med boter og trykker **Start**.
- Styring: piltaster eller WASD, mellomrom = bombe. På mobil vises knapper under brettet.
- Etter 90 sekunder begynner brettet å krympe.
- Power-ups: 💣 flere bomber, 🔥 lengre flamme, ⚡ fart, 🥊 Boksehanske: dytt bomber (gå inn i en bombe, så glir den til den treffer noe).
- Navnefeltet er tomt med «Spiller» som hint. Skriver du ingenting, heter du «Spiller».

## Video og lyd
- Kamera og mikrofon mellom alle i rommet (full mesh av PeerJS MediaConnections, maks 4), logikken ligger i `video.js`.
- 320×240 @ 15 fps, ekkokansellering og støydemping, maks ca. 250 kbit/s video per mottaker.
- Nekter du kamera/mikrofon, kan du fortsatt spille og se/høre de andre.

## Musikk og lyd
- All musikk og alle lydeffekter er egne komposisjoner, laget med Web Audio mens spillet kjører (`bbx.js`). Ingen lydfiler, ingen lånte melodier.
- Kampmusikk, menymusikk, seiers- og uavgjort-jingle, og effekter for bombe, eksplosjon, vegg, power-up, spark, død og nedtelling.
- Lyden starter først når du trykker eller klikker. **M** slår lyd av/på, høyttalerknappen øverst til høyre bytter mellom 25 %, 50 %, 85 % og av. Valget huskes.

## Toppliste
- **Beste i rommet:** verten teller seire, runder og drap per navn så lenge rommet lever. Vises mellom rundene og i lobbyen.
- **Beste spillere (denne enheten):** lagres i nettleseren (localStorage), topp 10 vises på startsiden. Boter telles ikke.
- **Felles liste (alle enheter):** av til `bbx-config.js` fylles ut. Se `backend/README.md`.

## Struktur
- `/` – videoversjonen (PeerJS-prefiks `bomberboyz2-video-v1-`).
- `/legacy/` – originalversjonen uten video (PeerJS-prefiks `bomberboyz2-v1-`). Egne rom, kolliderer ikke.
- `bbx.js` – musikk, lyd og toppliste (felles for begge versjoner), `bbx-config.js` – innstillinger for felles toppliste.
- `/video/` – videresender til `/` med romkode (`?rom=`) og hash bevart.

All grafikk er original og tegnes i kode (`game.js`). PeerJS (MIT) ligger i `peerjs.min.js`.
