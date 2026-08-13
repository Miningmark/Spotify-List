/**
 * Einmaliges Setup-Skript: holt per Spotify OAuth (Authorization Code Flow)
 * einen Refresh Token mit Scope "user-read-recently-played" und schreibt
 * ihn automatisch in die .env. Danach nicht mehr nötig.
 *
 * Voraussetzung: In der Spotify App (developer.spotify.com/dashboard) muss
 * unter "Redirect URIs" exakt die unten verwendete REDIRECT_URI eingetragen sein.
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PORT = Number(process.env.SPOTIFY_AUTH_PORT || 8888);
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "user-read-recently-played";
const ENV_PATH = path.join(__dirname, "..", ".env");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET fehlen in der .env");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");

function buildAuthorizeUrl() {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCodeForTokens(code) {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token-Austausch fehlgeschlagen (${response.status}): ${body}`);
  }

  return response.json();
}

function saveRefreshTokenToEnv(refreshToken) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";

  if (/^SPOTIFY_REFRESH_TOKEN=.*$/m.test(content)) {
    content = content.replace(/^SPOTIFY_REFRESH_TOKEN=.*$/m, `SPOTIFY_REFRESH_TOKEN=${refreshToken}`);
  } else {
    content += `${content.endsWith("\n") || content === "" ? "" : "\n"}SPOTIFY_REFRESH_TOKEN=${refreshToken}\n`;
  }

  fs.writeFileSync(ENV_PATH, content, "utf8");
}

function sendHtml(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<html><body style="font-family: sans-serif; padding: 2rem;">${message}</body></html>`);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (reqUrl.pathname !== "/callback") {
    sendHtml(res, 404, "Not found");
    return;
  }

  const error = reqUrl.searchParams.get("error");
  const code = reqUrl.searchParams.get("code");
  const returnedState = reqUrl.searchParams.get("state");

  if (error) {
    sendHtml(res, 400, `Autorisierung abgelehnt: ${error}`);
    server.close();
    return;
  }

  if (returnedState !== state) {
    sendHtml(res, 400, "Ungültiger state-Parameter (mögliches CSRF). Bitte erneut starten.");
    server.close();
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    saveRefreshTokenToEnv(tokens.refresh_token);
    sendHtml(res, 200, "Autorisierung erfolgreich! Refresh Token wurde in die .env geschrieben. Dieses Fenster kannst du schließen.");
    console.log("\nRefresh Token wurde in .env gespeichert (SPOTIFY_REFRESH_TOKEN).");
    console.log("Du kannst jetzt z.B. mit 'npm run sync-once' testen.\n");
  } catch (err) {
    sendHtml(res, 500, `Fehler beim Token-Austausch: ${err.message}`);
    console.error(err.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  const authorizeUrl = buildAuthorizeUrl();
  console.log("\nSchritt 1: Stelle sicher, dass diese Redirect URI in deiner Spotify App (Dashboard) hinterlegt ist:");
  console.log(`  ${REDIRECT_URI}\n`);
  console.log("Schritt 2: Öffne folgenden Link im Browser und logge dich mit dem gewünschten Spotify-Account ein:\n");
  console.log(`  ${authorizeUrl}\n`);
  console.log(`Warte auf Autorisierung auf Port ${PORT}...`);
});
