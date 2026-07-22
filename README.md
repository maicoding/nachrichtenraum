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

- 00:00 bis 00:10: langsamer Anlauf
- 00:10 bis 00:22: schnelle Beschleunigung
- 00:22 bis 00:32: Nachrichtenflut
- 00:32 bis 00:40: maximale Überlastung
- ab 00:40: Stille, alle Nachrichten verschwinden

Desktop: W, A, S, D oder Pfeiltasten zum Laufen, Ziehen mit der Maus oder Q und E zum sanften 360-Grad-Drehen. VR: linker Stick zum Laufen, rechter Stick zum stufenlosen Drehen.

Die Themen besitzen verschiedene dunkle Blautöne. Die Karten erinnern an Smartphone-Benachrichtigungen, erscheinen rund um die Person, ploppen auf und fliegen anschließend vorbei, nach oben oder zurück in die Tiefe.

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
