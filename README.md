# PUNKT E

Browserbasierter 360°-Nachrichtenraum mit WebXR-Unterstützung.

Öffentliche Fassung: https://maicoding.github.io/nachrichtenraum/

## Start

```bash
npm install
npm run dev
```

Die angezeigten Meldungen sind gekennzeichnete Demo-Inhalte. Eine externe Quelle kann über `VITE_MESSAGE_ENDPOINT` angebunden werden. Der Endpunkt liefert dieses Format:

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
