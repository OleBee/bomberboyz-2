# Super BomberBoyz

Retro bombespill i nettleseren for 1–8 spillere. Spill online med venner uten egen server (WebRTC via PeerJS), eller alene mot boter.

**Spill her:** https://bomberboyz.no/
**Med video- og lydchat (maks 4):** https://bomberboyz.no/videochat/

- **Lag rom** gir en romkode og en lenke du kan dele. Venner åpner lenken og trykker **Bli med**.
- Verten kan fylle tomme plasser med boter og trykker **Start**.
- Styring: piltaster eller WASD, mellomrom = bombe. På mobil vises knapper under brettet.
- Opptil 8 spillere. Stort brett (27×23, dobbelt så bredt og høyt som det vanlige) er standard; «Vanlig» (13×11) velges på startskjermen eller med «Brett»-knappen i lobbyen. På PC/laptop vises alltid hele brettet, skalert til vinduet og spillerlista står i en kolonne til venstre. Spillet går i fullskjerm når du starter (Lag rom, Bli med, Spill mot boter, Start); Esc gjelder resten av spillet, F slår fullskjerm av/på. På mobil følger kameraet deg på stort brett; nettbrett viser hele brettet når rutene blir minst 24 px.
- Hver runde varer 3:00 (nedtelling i HUD-en). Ved 2:30 kommer **HURRY UP!**: faste blokker faller i spiral fra nederste venstre hjørne, med klokka langs ytterkanten og så neste ring innover (vanlig brett to ringer, stort brett tre). Står du der en blokk lander, er du ute (ingen får drapspoeng). Bomber, power-ups og murvegger under blokka forsvinner.
- Uavgjort hvis tiden går ut før én står igjen, eller hvis alle de siste dør samtidig – da får ingen seier, men runden telles som spilt.
- Power-ups: 💣 flere bomber, 🔥 lengre flamme, ⚡ fart, 🥊 Boksehanske: dytt bomber (gå inn i en bombe, så glir den til den treffer noe).
- Navnefeltet er tomt med «Spiller» som hint. Skriver du ingenting, heter du «Spiller».

## Videochat (/videochat/)
- Kamera og mikrofon mellom alle i rommet (full mesh av PeerJS MediaConnections, maks 4), logikken ligger i `videochat/video.js`. Videochat-versjonen har vanlig brett og maks 4 spillere.
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
- `/` – hovedversjonen uten video: 8 spillere, stort brett (PeerJS-prefiks `bomberboyz2-v1-`).
- `/videochat/` – versjonen med video- og lydchat (PeerJS-prefiks `bomberboyz2-video-v1-`). Egne rom, kolliderer ikke.
- `bbx.js` – musikk, lyd og toppliste (felles for begge), `bbx-config.js` – innstillinger for felles toppliste, `backend/` – server for felles toppliste.
- Gamle adresser videresender med romkode (`?rom=`) og hash: `/legacy/` → `/`, `/video/` → `/videochat/`.
- Navn, lokal toppliste og lydvalg lagres i nettleseren og deles av begge versjonene.

All grafikk er original og tegnes i kode (`game.js`). PeerJS (MIT) ligger i `peerjs.min.js`.
