import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATA_DIR env'i sadece paketlenmiş Electron modunda set edilir (main.js,
// app.getPath('userData') → %AppData%\...). Set edilmemişse (dev, npm start,
// Aşama-1 electron) mevcut davranış birebir korunur: proje köküne göre
// relative `data/` klasörü. Bu yüzden dev/production akışları hiç etkilenmez.
export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "data")
  : path.resolve(__dirname, "../../../data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "app.db");

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
