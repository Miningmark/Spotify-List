const config = require("./config");
const logger = require("./logger");

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const basicAuth = Buffer.from(
    `${config.spotify.clientId}:${config.spotify.clientSecret}`
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.spotify.refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify Token-Refresh fehlgeschlagen (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (data.refresh_token && data.refresh_token !== config.spotify.refreshToken) {
    logger.warn(
      "Spotify hat einen neuen Refresh Token ausgestellt. Bitte SPOTIFY_REFRESH_TOKEN in der .env aktualisieren."
    );
  }
  cachedToken = data.access_token;
  // 60s Puffer vor Ablauf einplanen
  cachedTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

module.exports = { getAccessToken };
