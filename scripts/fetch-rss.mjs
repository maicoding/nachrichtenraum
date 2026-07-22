import { mkdir, readFile, writeFile } from 'node:fs/promises';

const feeds = [
  {
    source: 'TAGESSCHAU.DE',
    category: 'INNENPOLITIK',
    url: 'https://www.tagesschau.de/inland/innenpolitik/index~rss2.xml'
  },
  {
    source: 'TAGESSCHAU.DE',
    category: 'AUSLANDSPOLITIK',
    url: 'https://www.tagesschau.de/ausland/index~rss2.xml'
  },
  {
    source: 'TAGESSCHAU.DE',
    category: 'WIRTSCHAFT & PREISE',
    url: 'https://www.tagesschau.de/wirtschaft/verbraucher/index~rss2.xml'
  },
  {
    source: 'TAGESSCHAU.DE',
    category: 'KLIMA & UMWELT',
    url: 'https://www.tagesschau.de/wissen/klima/index~rss2.xml'
  },
  {
    source: 'TAGESSCHAU.DE',
    category: 'GESUNDHEIT & PSYCHE',
    url: 'https://www.tagesschau.de/wissen/gesundheit/index~rss2.xml'
  },
  {
    source: 'TAZ.DE',
    category: 'POLITIK',
    url: 'https://taz.de/!p4608;rss/'
  },
  {
    source: 'SPIEGEL.DE',
    category: 'POLITIK',
    url: 'https://www.spiegel.de/politik/index.rss'
  },
  {
    source: 'DLF',
    category: 'NACHRICHTEN',
    url: 'https://www.deutschlandfunk.de/nachrichten-100.rss'
  },
  {
    source: 'DLF',
    category: 'KARRIERE & STUDIUM',
    url: 'https://www.deutschlandfunk.de/campus-karriere-104.xml'
  },
  {
    source: 'BILD.DE',
    category: 'POLITIK',
    url: 'https://www.bild.de/feed/politik.xml'
  }
];

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(item, name) {
  return item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
}

function parseItems(xml, feed) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    const title = decodeXml(tag(item, 'title'));
    const url = decodeXml(tag(item, 'link'));
    const published = Date.parse(decodeXml(tag(item, 'pubDate')));
    const publishedAt = new Date(Number.isFinite(published) ? published : Date.now()).toISOString();
    const category = feed.category;
    return { source: feed.source, title, url, publishedAt, category };
  }).filter(item => item.title && item.url.startsWith('https://'));
}

const settled = await Promise.allSettled(feeds.map(async feed => {
  const response = await fetch(feed.url, {
    headers: { 'user-agent': 'Punkt-E-Nachrichtenraum/1.0 (+https://maicoding.github.io/nachrichtenraum/)' }
  });
  if (!response.ok) throw new Error(`${feed.source}: HTTP ${response.status}`);
  return parseItems(await response.text(), feed);
}));

const messages = settled
  .filter(result => result.status === 'fulfilled')
  .flatMap(result => result.value.slice(0, 18))
  .filter((item, index, items) => items.findIndex(other => other.url === item.url) === index)
  .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  .slice(0, 180);

if (!messages.length) throw new Error('Kein RSS-Feed konnte geladen werden.');

let previous = null;
try {
  previous = JSON.parse(await readFile('feeds.json', 'utf8'));
} catch {
  previous = null;
}
const unchanged = JSON.stringify(previous?.messages) === JSON.stringify(messages);
const updatedAt = unchanged && previous?.updatedAt ? previous.updatedAt : new Date().toISOString();
const payload = `${JSON.stringify({ updatedAt, messages }, null, 2)}\n`;
await mkdir('public', { recursive: true });
await Promise.all([
  writeFile('feeds.json', payload),
  writeFile('public/feeds.json', payload)
]);

console.log(`${messages.length} RSS-Meldungen gespeichert.`);
