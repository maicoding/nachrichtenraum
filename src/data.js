export const messages = [
  { source: 'TAGESSCHAU', title: 'Bund und Länder beraten über die nächsten Schritte', age: 'vor 2 Minuten', category: 'POLITIK' },
  { source: 'TAZ', title: 'Neue Debatte über Verantwortung und Macht', age: 'vor 4 Minuten', category: 'POLITIK' },
  { source: 'NEWS', title: 'Parlament setzt Beratungen am Abend fort', age: 'vor 5 Minuten', category: 'POLITIK' },
  { source: 'WEB', title: 'Eilmeldung verdrängt die vorherige Eilmeldung', age: 'gerade eben', category: 'NETZ' },
  { source: 'UNIVERSUM', title: 'Ein fernes Signal erreicht die Erde', age: 'vor 8 Minuten', category: 'WISSEN' },
  { source: 'WANDERN', title: 'Wegesperrung im Mittelgebirge angekündigt', age: 'vor 11 Minuten', category: 'REGION' },
  { source: 'TAGESSCHAU', title: 'Ausschuss fordert weitere Aufklärung', age: 'vor 12 Minuten', category: 'POLITIK' },
  { source: 'TAZ', title: 'Kommunen warnen vor wachsender Belastung', age: 'vor 14 Minuten', category: 'POLITIK' },
  { source: 'NEWS', title: 'Neue Zahlen verändern die laufende Prognose', age: 'vor 15 Minuten', category: 'WIRTSCHAFT' },
  { source: 'WEB', title: 'Was heute wichtig werden könnte', age: 'vor 17 Minuten', category: 'NETZ' },
  { source: 'WANDERN', title: 'Rettungsdienst meldet erhöhtes Einsatzaufkommen', age: 'vor 18 Minuten', category: 'REGION' },
  { source: 'UNIVERSUM', title: 'Forschende beobachten ungewöhnliche Aktivität', age: 'vor 20 Minuten', category: 'WISSEN' },
  { source: 'TAGESSCHAU', title: 'Opposition verlangt eine Sondersitzung', age: 'vor 21 Minuten', category: 'POLITIK' },
  { source: 'TAZ', title: 'Proteste dauern in mehreren Städten an', age: 'vor 22 Minuten', category: 'POLITIK' },
  { source: 'NEWS', title: 'Verhandlungen gehen ohne Ergebnis weiter', age: 'vor 24 Minuten', category: 'POLITIK' },
  { source: 'WEB', title: 'Der nächste Liveticker beginnt', age: 'vor 25 Minuten', category: 'NETZ' },
  { source: 'TAGESSCHAU', title: 'Ministerium kündigt Prüfung an', age: 'vor 27 Minuten', category: 'POLITIK' },
  { source: 'TAZ', title: 'Kritik an kurzfristiger Entscheidung wächst', age: 'vor 29 Minuten', category: 'POLITIK' },
  { source: 'UNIVERSUM', title: 'Neue Aufnahme zeigt Spuren vergangener Zeit', age: 'vor 31 Minuten', category: 'WISSEN' },
  { source: 'WANDERN', title: 'Wetterwechsel erschwert die Orientierung', age: 'vor 33 Minuten', category: 'REGION' },
  { source: 'NEWS', title: 'Mehrere Meldungen widersprechen einander', age: 'vor 35 Minuten', category: 'MEDIEN' },
  { source: 'WEB', title: 'Die meistgelesene Nachricht ändert sich erneut', age: 'vor 36 Minuten', category: 'NETZ' },
  { source: 'TAGESSCHAU', title: 'Abstimmung endet mit knapper Mehrheit', age: 'vor 38 Minuten', category: 'POLITIK' },
  { source: 'TAZ', title: 'Wer entscheidet, welche Meldung bleibt?', age: 'vor 40 Minuten', category: 'MEDIEN' }
];

export function messageAt(index) {
  return messages[index % messages.length];
}
