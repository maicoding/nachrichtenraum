# PUNKT E

Browserbasierter 360°-Nachrichtenraum mit WebXR-Unterstützung.

Öffentliche Fassung: https://maicoding.github.io/nachrichtenraum/

## Start

```bash
npm install
npm run dev
```

Die Anwendung lädt Schlagzeilen aus den offiziellen RSS-Feeds von tagesschau.de und taz.de. GitHub aktualisiert `feeds.json` zweimal pro Stunde. Die Karten nennen die Quelle und öffnen beim Anklicken den jeweiligen Artikel.

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
