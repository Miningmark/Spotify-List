const cron = require("node-cron");
const config = require("./config");
const logger = require("./logger");
const { runSync } = require("./syncJob");

let syncInProgress = false;

async function safeRunSync() {
  if (syncInProgress) {
    logger.warn("Vorheriger Sync läuft noch, überspringe diesen Durchlauf");
    return;
  }
  syncInProgress = true;
  try {
    await runSync();
  } catch (err) {
    logger.error("Sync fehlgeschlagen:", err.message);
  } finally {
    syncInProgress = false;
  }
}

async function main() {
  const runOnceOnly = process.argv.includes("--once");

  await safeRunSync();

  if (runOnceOnly) {
    const db = require("./db");
    await db.close();
    return;
  }

  logger.info(`Scheduler aktiv, Cron: "${config.syncCron}"`);
  cron.schedule(config.syncCron, safeRunSync);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function shutdown() {
  logger.info("Beende Anwendung...");
  const db = require("./db");
  await db.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error("Unerwarteter Fehler beim Start:", err);
  process.exit(1);
});
