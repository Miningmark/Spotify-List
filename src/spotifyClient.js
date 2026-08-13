const { getAccessToken } = require("./spotifyAuth");

const RECENTLY_PLAYED_URL = "https://api.spotify.com/v1/me/player/recently-played";
const LIMIT = 50;
const MAX_PAGES = 20; // Sicherheitslimit gegen Endlosschleifen

async function fetchRecentlyPlayedPage(afterMs, accessToken) {
  const url = new URL(RECENTLY_PLAYED_URL);
  url.searchParams.set("limit", String(LIMIT));
  if (afterMs) {
    url.searchParams.set("after", String(afterMs));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify API Fehler (${response.status}): ${body}`);
  }

  return response.json();
}

/**
 * Holt alle seit `afterMs` (Unix-Millisekunden) neu gehörten Songs.
 * Spotify liefert max. 50 Einträge pro Aufruf, daher wird bei Bedarf
 * mehrfach paginiert (relevant falls zwischen zwei Syncs > 50 Songs liefen).
 */
async function fetchRecentlyPlayedSince(afterMs) {
  const accessToken = await getAccessToken();
  const allItems = [];
  let cursor = afterMs;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchRecentlyPlayedPage(cursor, accessToken);
    const items = data.items || [];
    if (items.length === 0) break;

    allItems.push(...items);

    if (items.length < LIMIT) break;

    const newestPlayedAtMs = Math.max(
      ...items.map((item) => new Date(item.played_at).getTime())
    );
    if (!cursor || newestPlayedAtMs <= cursor) break;
    cursor = newestPlayedAtMs;
  }

  return allItems;
}

module.exports = { fetchRecentlyPlayedSince };
