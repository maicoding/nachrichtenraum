# PUNKT E

Browserbasierter 360°-Nachrichtenraum mit WebXR-Unterstützung.

Öffentliche Fassung: https://maicoding.github.io/nachrichtenraum/

## Start

```bash
npm install
npm run dev
```

Die Anwendung lädt Schlagzeilen aus den RSS-Feeds von tagesschau.de, taz.de, SPIEGEL Politik, Deutschlandfunk und BILD Politik. Enthalten sind Wirtschaft und Preise, Innenpolitik, Auslandspolitik, Karriere und Studium, Klima und Umwelt sowie Gesundheit und Psyche. GitHub aktualisiert `feeds.json` zweimal pro Stunde. Die Karten nennen die Quelle und öffnen beim Anklicken den jeweiligen Artikel.

## Ablauf

- 00:00 bis 02:00: Morgen, Geschwindigkeit 4, Tonstufe 3
- 02:00 bis 03:00: Atempause
- 03:00 bis 05:00: Mittag, Geschwindigkeit 6
- 05:00 bis 06:00: Atempause
- 06:00 bis 08:00: Abend, Geschwindigkeit 8, Tonstufe 6
- ab 08:00: Stille

Desktop: W, A, S, D oder Pfeiltasten zum Laufen, Ziehen mit der Maus zum Umsehen. VR: linker Stick zum Laufen, rechter Stick zum Drehen.

Die Tagesschau-Inhalte sind für den privaten, nicht-kommerziellen Gebrauch vorgesehen. Für eine öffentliche oder kommerzielle Ausstellung müssen die Nutzungsrechte mit den Anbietern geklärt werden.

Eine weitere externe Quelle kann über `VITE_MESSAGE_ENDPOINT` angebunden werden. Der Endpunkt liefert dieses Format:

```json
{
  "messages": [
    {
      "source": "WHATSAPP",
      "title": "Text der freigegebenen Nachricht",
      "age": "gerade eben",
      "category": "PUBLIKUM"
    }
  ]
}
```

Manuelle Live-Nachrichten lassen sich in der Browser-Konsole einspeisen:

```js
window.nachrichtenraum.pushMessage({ source: 'WHATSAPP', title: 'Eine freigegebene Nachricht' })
```

Für den Ausstellungsbetrieb benötigt WebXR HTTPS oder `localhost`.
