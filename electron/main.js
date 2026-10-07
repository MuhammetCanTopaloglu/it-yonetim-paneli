// Electron ana process. Aşama 1: paketleme yok, sadece `npm run electron`
// ile başlatılan geliştirme/deneme penceresi. Mevcut `npm run dev` ve
// `npm start` akışlarına hiç dokunmaz — bu dosya tamamen ayrı bir katmandır.
const { app, BrowserWindow, Menu } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Varsayılan File/Edit/View/Window menü çubuğu bu iç-kurumsal panel için
// gereksiz — tamamen kaldırılıyor. DevTools'a hâlâ Ctrl+Shift+I ile
// erişilebilir (bkz. createWindow'daki before-input-event).
Menu.setApplicationMenu(null);

// Paketlenmiş (.exe/NSIS/portable) modda proje köküne yazma izni olmayabilir
// (ör. Program Files) — bu yüzden veri (DB + yüklenen dosyalar) Windows'un
// standart kullanıcı-veri konumuna taşınır: %AppData%\<productName>\data\.
// Aşama 1/geliştirme modunda (app.isPackaged === false) DATA_DIR set
// EDİLMEZ — mevcut proje-köküne-relative `data/` klasörü aynen kullanılır,
// bu yüzden npm run dev / npm start / npm run electron hiç etkilenmez.
if (app.isPackaged) {
  process.env.DATA_DIR = app.getPath("userData");
}

const PORT = Number(process.env.PORT) || 4000;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const APP_URL = `http://localhost:${PORT}`;

async function isOurServerAlreadyRunning() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return Boolean(body && body.ok === true);
  } catch {
    return false;
  }
}

async function ensureServerStarted() {
  const alreadyRunning = await isOurServerAlreadyRunning();
  if (alreadyRunning) {
    console.log(`[electron] Port ${PORT}'de zaten çalışan bir sunucu bulundu (ör. npm start), yeni bir instance başlatılmayacak.`);
    return;
  }

  // server/dist/index.js'in export ettiği startServer() aynı process
  // içinde çağrılır (ayrı bir child process değil) — bkz. plan notu.
  const serverEntry = pathToFileURL(path.join(__dirname, "..", "server", "dist", "index.js")).href;
  const { startServer } = await import(serverEntry);

  try {
    startServer(PORT);
  } catch (err) {
    if (err && err.code === "EADDRINUSE") {
      // Health-check ile yakalayamadığımız, bizim sunucumuz olmayan başka
      // bir işlem portu tutuyor olabilir — kullanıcıya açıkça bildir.
      throw new Error(
        `Port ${PORT} başka bir uygulama tarafından kullanılıyor ve orada beklenen sunucu (health-check) bulunamadı. Lütfen o portu kullanan uygulamayı kapatın veya PORT ortam değişkenini değiştirin.`
      );
    }
    throw err;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, "icon.ico"),
    title: "IT Yönetim Paneli",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Menü çubuğu kaldırıldığı için DevTools'a erişimin tek yolu bu kısayol
  // kalıyor — geliştirme/hata ayıklama için bırakıldı.
  win.webContents.on("before-input-event", (_event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      win.webContents.toggleDevTools();
    }
  });

  win.loadURL(APP_URL);
}

app.whenReady().then(async () => {
  try {
    await ensureServerStarted();
  } catch (err) {
    console.error("[electron] Sunucu başlatılamadı:", err);
    const { dialog } = require("electron");
    dialog.showErrorBox("IT Yönetim Paneli - Başlatma Hatası", String(err && err.message ? err.message : err));
    app.quit();
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
