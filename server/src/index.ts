import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./db/migrate.js";
import authRouter, { requireAuth } from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import inventoryRouter from "./routes/inventory.js";
import subnetsRouter from "./routes/subnets.js";
import ipAssignmentsRouter from "./routes/ipAssignments.js";
import switchesRouter from "./routes/switches.js";
import switchLinksRouter from "./routes/switchLinks.js";
import todosRouter from "./routes/todos.js";
import notesRouter from "./routes/notes.js";
import changelogRouter from "./routes/changelog.js";
import backupRouter from "./routes/backup.js";
import dashboardRouter from "./routes/dashboard.js";
import searchRouter from "./routes/search.js";
import attachmentsRouter from "./routes/attachments.js";
import switchPortsRouter from "./routes/switchPorts.js";
import topologyAnnotationsRouter from "./routes/topologyAnnotations.js";
import pingRouter from "./routes/ping.js";
import snmpRouter from "./routes/snmp.js";
import vaultRouter from "./routes/vault.js";
import licensesRouter from "./routes/licenses.js";

runMigrations();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Express app'i kurar ve verilen portta dinlemeye başlar. `node dist/index.js`
 * ile doğrudan çalıştırıldığında (npm run dev / npm start) dosyanın en
 * altında otomatik çağrılır — davranış öncekiyle birebir aynıdır. Electron
 * main process de aynı fonksiyonu import edip kendi içinde çağırarak ayrı
 * bir child process açmadan aynı sunucuyu başlatabilir (bkz. electron/main.js).
 */
export function startServer(port: number = Number(process.env.PORT) || 4000) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());

  // /api/health ve /api/auth/* (login, logout, me) requireAuth'tan ÖNCE mount
  // edilir — bu korumadan muaf tek yol budur. Login kilitli olursa kimse
  // giremez; /me'nin kendisi zaten oturum olup olmadığını kontrol eden
  // endpoint, o da girişsiz erişilebilir olmalı (frontend guard bunu kullanır).
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", authRouter);

  // Bu satırdan SONRA mount edilen HER route girişsiz erişime kapalı.
  app.use("/api", requireAuth);

  app.use("/api/users", usersRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/subnets", subnetsRouter);
  app.use("/api/ip-assignments", ipAssignmentsRouter);
  app.use("/api/switches", switchesRouter);
  app.use("/api/switch-links", switchLinksRouter);
  app.use("/api/todos", todosRouter);
  app.use("/api/notes", notesRouter);
  app.use("/api/changelog", changelogRouter);
  app.use("/api/backup", backupRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/attachments", attachmentsRouter);
  app.use("/api/switch-ports", switchPortsRouter);
  app.use("/api/topology-annotations", topologyAnnotationsRouter);
  app.use("/api/ping", pingRouter);
  app.use("/api/snmp", snmpRouter);
  app.use("/api/vault", vaultRouter);
  app.use("/api/licenses", licensesRouter);

  // Production: `npm run build` client'ı client/dist'e derler, burası onu
  // statik servis eder — tek port, tek sunucu, ayrı bir Vite dev sunucusu
  // gerekmez. Dev'de (`tsx watch`) client/dist yok, bu blok atlanır ve client
  // zaten Vite'ın kendi dev sunucusundan (5173, /api proxy'siyle) servis edilir.
  const clientDistDir = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    // SPA fallback: React Router route'ları (ör. /vault, /topology) hard
    // refresh'te 404 vermesin diye bilinmeyen GET istekleri index.html'e düşer.
    // /api/* zaten yukarıda ele alındığı için buraya hiç ulaşmaz.
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDistDir, "index.html"));
    });
  }

  return app.listen(port, () => {
    console.log(`[server] http://localhost:${port}`);
  });
}

// Doğrudan `node dist/index.js` ile çalıştırıldığında (npm run dev / npm
// start) otomatik başlat. Electron gibi başka bir modül `startServer`'ı
// import edip kendi kontrolünde çağırdığında bu blok atlanır.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  startServer();
}
