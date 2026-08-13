const db = require("./db");
const logger = require("./logger");
const { fetchRecentlyPlayedSince } = require("./spotifyClient");
const { mapItemToRow } = require("./transform");

async function runSync() {
  logger.info("Sync gestartet");

  const lastPlayedAtMs = await db.getLastPlayedAtMs();
  logger.info(
    lastPlayedAtMs
      ? `Letzter bekannter Song vom ${new Date(lastPlayedAtMs).toISOString()}`
      : "Keine bisherigen Einträge, hole die letzten verfügbaren Songs"
  );

  const items = await fetchRecentlyPlayedSince(lastPlayedAtMs);
  logger.info(`${items.length} Song(s) von Spotify erhalten`);

  if (items.length === 0) {
    logger.info("Sync abgeschlossen, keine neuen Songs");
    return { fetched: 0, inserted: 0 };
  }

  const rows = items.map(mapItemToRow);
  rows.forEach((row) => {
    console.log(`  - ${row.playedAt}  ${row.artistName} - ${row.trackName}`);
  });

  const inserted = await db.insertTracks(rows);

  logger.info(`Sync abgeschlossen: ${inserted} neue(r) Song(s) gespeichert (${items.length - inserted} Duplikate übersprungen)`);
  return { fetched: items.length, inserted };
}

module.exports = { runSync };
