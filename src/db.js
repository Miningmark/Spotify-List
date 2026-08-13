const mysql = require("mysql2/promise");
const config = require("./config");

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});

async function getLastPlayedAtMs() {
  const [rows] = await pool.query(
    `SELECT UNIX_TIMESTAMP(MAX(played_at)) * 1000 AS lastMs FROM \`${config.db.table}\``
  );
  const lastMs = rows[0] && rows[0].lastMs;
  return lastMs ? Number(lastMs) : null;
}

/**
 * Fügt Tracks ein, ignoriert Duplikate über den Unique Key (track_id, played_at).
 * Gibt die Anzahl tatsächlich neu eingefügter Zeilen zurück.
 */
async function insertTracks(tracks) {
  if (tracks.length === 0) return 0;

  const sql = `
    INSERT IGNORE INTO \`${config.db.table}\`
      (played_at, played_date, played_time, track_id, track_name, artist_name,
       album_name, duration_ms, duration_min, track_url, album_url, popularity, explicit)
    VALUES ?
  `;

  const values = tracks.map((t) => [
    t.playedAt,
    t.playedDate,
    t.playedTime,
    t.trackId,
    t.trackName,
    t.artistName,
    t.albumName,
    t.durationMs,
    t.durationMin,
    t.trackUrl,
    t.albumUrl,
    t.popularity,
    t.explicit,
  ]);

  const [result] = await pool.query(sql, [values]);
  return result.affectedRows;
}

async function close() {
  await pool.end();
}

module.exports = { getLastPlayedAtMs, insertTracks, close };
