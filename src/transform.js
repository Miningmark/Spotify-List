function toMysqlDatetime(isoString) {
  // "2026-08-13T17:41:00.000Z" -> "2026-08-13 17:41:00" (UTC)
  return isoString.replace("T", " ").replace(/\.\d+Z$/, "");
}

function mapItemToRow(item) {
  const track = item.track;
  const mysqlDatetime = toMysqlDatetime(item.played_at);
  const [playedDate, playedTime] = mysqlDatetime.split(" ");

  return {
    playedAt: mysqlDatetime,
    playedDate,
    playedTime,
    trackId: track.id,
    trackName: track.name,
    artistName: track.artists.map((a) => a.name).join(", "),
    albumName: track.album ? track.album.name : null,
    durationMs: track.duration_ms,
    durationMin: Math.round((track.duration_ms / 60000) * 100) / 100,
    trackUrl: track.external_urls ? track.external_urls.spotify : null,
    albumUrl: track.album && track.album.external_urls ? track.album.external_urls.spotify : null,
    popularity: typeof track.popularity === "number" ? track.popularity : null,
    explicit: track.explicit ? 1 : 0,
  };
}

module.exports = { mapItemToRow };
