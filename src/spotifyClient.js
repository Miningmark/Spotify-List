const { getAccessToken } = require("./spotifyAuth");

const RECENTLY_PLAYED_URL = "https://api.spotify.com/v1/me/player/recently-played";
const ARTISTS_URL = "https://api.spotify.com/v1/artists";
const LIMIT = 50;
const MAX_PAGES = 20; // Sicherheitslimit gegen Endlosschleifen
const ARTISTS_BATCH_SIZE = 50; // Spotify erlaubt max. 50 IDs pro Aufruf

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

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Holt zu einer Liste von Artist-IDs die jeweiligen Genres von Spotify.
 * Gibt eine Map artistId -> string[] (Genres) zurück. Artists ohne
 * hinterlegte Genres liefern ein leeres Array (bei Spotify inzwischen häufig).
 */
async function fetchArtistGenres(artistIds) {
  const uniqueIds = [...new Set(artistIds)].filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const accessToken = await getAccessToken();
  const genresByArtistId = {};

  for (const batch of chunk(uniqueIds, ARTISTS_BATCH_SIZE)) {
    const url = new URL(ARTISTS_URL);
    url.searchParams.set("ids", batch.join(","));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Spotify API Fehler beim Artist-Abruf (${response.status}): ${body}`);
    }

    const data = await response.json();
    for (const artist of data.artists || []) {
      if (artist) {
        genresByArtistId[artist.id] = artist.genres || [];
      }
    }
  }

  return genresByArtistId;
}

module.exports = { fetchRecentlyPlayedSince, fetchArtistGenres };
