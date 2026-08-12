import { fallbackMessages } from "../../src/data.js";

function clean(value = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value).replace(/<[^>]*>/g, " ");
  return textarea.value.replace(/\s+/g, " ").trim();
}

export function normalizeMessage(item = {}) {
  const title = clean(item.title).slice(0, 145) || "Neue Meldung";
  const excerpt = clean(item.excerpt || item.description || item.summary).slice(0, 210);
  return {
    title,
    excerpt: excerpt || "Eine neue Entwicklung erzeugt weitere Fragen, Reaktionen und Folgeprobleme.",
    source: clean(item.source || "RSS").toUpperCase().slice(0, 25),
    category: clean(item.category || "NEWS").toUpperCase().slice(0, 24),
    url: item.url || item.link || "",
  };
}

export async function loadMessages() {
  const fallback = fallbackMessages.map(normalizeMessage);
  try {
    const url = new URL("../feeds.json", location.href);
    url.searchParams.set("v", String(Date.now()));
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    const messages = Array.isArray(payload) ? payload : payload.messages;
    if (!Array.isArray(messages) || !messages.length) throw new Error("empty");
    return { messages: [...messages.map(normalizeMessage), ...fallback], rssCount: messages.length };
  } catch {
    return { messages: fallback, rssCount: 0 };
  }
}
