# PUNKT E

Browserbasierter 360°-Nachrichtenraum mit WebXR-Unterstützung.

Version 1: https://maicoding.github.io/nachrichtenraum/

Version 2 für Meta Quest: https://maicoding.github.io/nachrichtenraum/v2/

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

## Version 2 auf Meta Quest

1. Den Link im Meta Quest Browser öffnen.
2. `IN VR STARTEN` wählen.
3. Mit dem linken Stick vorwärts, rückwärts und seitwärts gehen. Physische Bewegung im eingerichteten Guardian-Bereich bleibt aktiv.
4. Mit dem rechten Stick in 30-Grad-Schritten drehen.
5. Mit einem Controller auf eine Kachel zeigen. Das weiße oder blaue Dreieck markiert den Trefferpunkt.
6. Den Trigger auf der Kachel drücken, um diese Nachricht anzuhalten oder fortzusetzen.
7. Den Trigger auf dem X drücken, um die Nachricht zu schließen. Sofort erscheinen zwei neue Nachrichten.
8. Mit A, X oder `ALLE ANHALTEN` die gesamte Simulation anhalten und fortsetzen.

Der Ablauf wiederholt drei aktive Phasen. Phase I läuft 20 Sekunden langsam, danach folgen 6 Sekunden Stille. Phase II läuft 20 Sekunden mit mittlerer Dichte, danach folgen 6 Sekunden Stille. Phase III läuft 20 Sekunden mit bis zu 72 Nachrichten, danach folgen 6 Sekunden Stille. Zu Beginn jeder aktiven Phase wird der Kartenbestand neu aufgebaut.

Die Browserfassung verwendet WebXR und A-Frame. Eine APK und das native Meta XR SDK werden für diesen Link nicht benötigt. Über das Browsermenü der Quest kann die Seite zum Startbildschirm hinzugefügt werden.
