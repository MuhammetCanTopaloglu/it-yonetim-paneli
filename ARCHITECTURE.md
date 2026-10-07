# Mimari

Kısa teknik özet. Ayrıntı için ilgili dosyalardaki yorumlara bakın.

## Katmanlar

```
client/   React 18 + TypeScript + Vite + Tailwind        (SPA)
server/   Express 4 + node:sqlite (yerleşik SQLite)       (REST API, /api/*)
electron/ İsteğe bağlı masaüstü kabuğu                    (aynı sunucuyu aynı process'te başlatır)
data/     Çalışma zamanı verisi (app.db, uploads/)        (repoya girmez)
```

- **Native bağımlılık yok.** Veritabanı `node:sqlite`, kriptografi `node:crypto`, SNMP `net-snmp` (saf JS).
  Bu bilinçli bir tercih: derleme araç zinciri gerektirmeden `npm install` ve Electron paketleme çalışır.
- **Tek port, tek süreç (production).** `server/src/index.ts` API'yi ve `client/dist` statik dosyalarını aynı
  porttan servis eder; React Router için SPA fallback vardır. `startServer()` dışa aktarılır, Electron aynı
  process içinde çağırır.
- **Dev:** Vite (5173) `/api`'yi Express'e (4000) proxy'ler.
- **Veri konumu:** `DATA_DIR` ortam değişkeni verilirse `<DATA_DIR>/data/`, yoksa proje köküne göre `data/`.
  Paketli Electron `%AppData%` altına yazar. Şema `schema.sql` + idempotent `ensureColumn` / tablo yeniden
  oluşturma migration'ları (`db/migrate.ts`) ile her açılışta güncellenir.
- **Route düzeni:** `/api/health` ve `/api/auth/*` açık; bunun altında `requireAuth` global kapıdır,
  kasa router'ı ayrıca `requireAdmin` ile korunur.

## Kimlik doğrulama

- Parolalar **scrypt** ile `salt:hash` olarak saklanır (`lib/password.ts`), karşılaştırma `timingSafeEqual`.
- **Server-side session:** `sessions` tablosunda rastgele id, 7 gün TTL; istemciye `httpOnly`, `SameSite=Lax`
  çerez (`COOKIE_SECURE=true` ile HTTPS'te `Secure`). JWT yok, oturum sunucudan iptal edilebilir.
- **Brute-force koruması:** 5 başarısız denemeden sonra hesap 5 dakika kilitlenir (429). Yanlış kullanıcı adı /
  yanlış parola aynı genel hatayı döner.
- İlk kurulumda kullanıcı yoksa `İlk Admin Hesabı Oluştur` ekranı gelir (`/api/auth/setup-first-admin`, yalnız
  `users` boşken çalışır). Rastgele/konsola yazılan şifre yoktur.
- Roller: `admin` / `user`. Kasa ve kullanıcı yönetimi yalnız admin.

## Kimlik kasası (vault)

- **Şifreleme:** AES-256-GCM (kimlik doğrulamalı: yanlış anahtar veya bozulmuş veri `DecryptionError` fırlatır).
  Her `encrypt()` çağrısı taze 12 baytlık IV üretir; saklama biçimi `iv:authTag:ciphertext` (base64).
- **KDF:** scrypt, `N=131072, r=8, p=1` (≈128 MiB, `maxmem` açıkça yükseltilir). Anahtar **hiçbir yerde saklanmaz**.
- **Verifier deseni:** Kurulumda rastgele bir token anahtarla şifrelenip `vault_meta.verifier` olarak saklanır.
  Ana parola doğrulaması = adayın türettiği anahtarla verifier'ı çözmek. Parolanın kendisi/hash'i tutulmaz.
  Kurtarma yolu yoktur; arayüz bunu zorunlu onayla uyarır.
- **Oturum anahtarı:** Türetilen anahtar yalnız sunucu belleğinde (`lib/vaultSession.ts`), uygulama oturumuna
  bağlı, 5 dakika kayan zaman aşımı. Logout, sunucu yeniden başlatma ve istemcinin Kasa sayfasından çıkması /
  sekme kapanması kasayı kilitler. 5 hatalı denemede 5 dakika kilit.
- **Sızıntı koruması:** Liste uçları şifreli alanları hiç seçmez; çözülmüş değer yalnız tek-kayıt "reveal"
  yanıtında döner; changelog'a asla sır yazılmaz; istemci çözülmüş değeri yalnız React state'inde tutur.
- **Ana parola değişimi:** Önce tüm kayıtlar eski anahtarla çözülür (yazma yok), sonra yeni salt/verifier ve yeniden
  şifrelenmiş kayıtlar tek transaction'da yazılır; herhangi bir hata ROLLBACK ile eski durumu korur.

## Lisans modülü ve kasa entegrasyonu

- `licenses` (ürün, tedarikçi, toplam koltuk, tarihler, maliyet, `license_key_encrypted`) ve polimorfik
  `license_assignments` (envanter / switch / serbest etiket).
- Lisans anahtarı **aynı kasa anahtarıyla** (`vaultCrypto.encrypt/decrypt`, aynı oturum anahtarı) şifrelenir;
  ikinci bir kripto sistemi yoktur. Liste ve CRUD kasa kilitliyken çalışır; yalnız anahtarı yazmak/okumak
  (`reveal-key`) kasa gerektirir ve kilitliyse `423` döner. Arayüz kilit durumunda aynı sayfada kasayı açıp
  yarım kalan işlemi otomatik sürdürür.
- Koltuk kullanımı = `license_assignments` satır sayısı; doluysa yeni atama reddedilir.
- Yenileme uyarısı: ≤14 gün acil, ≤60 gün yaklaşan, geçmiş; dashboard ve ağ sağlığı özetine yansır.
- Faturalar `attachments` tablosunun genişletilmiş hâlidir (`is_invoice`, tutar, tedarikçi, tarih); hem envanter
  hem lisans için çalışır.

## Etki analizi (blast radius)

`lib/blastRadius.ts` içindeki saf fonksiyon `computeBlastRadius()`: "bu switch düşerse ne etkilenir?"

- Switch'ler düğüm, `switch_links` yönsüz kenar; **omurga olarak işaretli switch'ler** kaynaktır.
- Hedef düğüm çıkarılır, kalan grafikte tüm omurgalardan **çok kaynaklı BFS** yapılır; omurgaya ulaşamayan
  düğümler "etkilenen"dir. Yedekli yol (iki uplink) varsa düğüm etkilenmez; çift omurgada biri düşerse diğerine
  bağlı olanlar etkilenmez.
- Omurga hiç işaretlenmemişse hesap yapılmaz (`hasBackbone=false`). Etkilenen switch'lere bağlı envanter portlardan
  türetilir. Davranış 7 birim testle sabitlenmiştir.

## SNMP ve ağ keşfi

- **Tekil sorgu:** SNMP v2c ile `sysName`, `sysDescr`, `sysUpTime`, `ifNumber` ve arayüz `ifOperStatus`
  (`net-snmp`'in `table()` yardımcısı boşluklu sütunlarda boş döndüğü için `subtree()` + OID son eki ayrıştırma).
- **Community string** switch kaydında düz metin saklanır ama **hiçbir API yanıtında dönmez**; yalnız
  `/api/snmp/query` içeride okur. Cevap gelmezse (zaman aşımı) açık hata verilir.
- **Ağ taraması:** CIDR veya `a-b` aralığı, 20 eşzamanlı sorgu, bulunan cihazlar bir aday listesi olarak döner;
  **hiçbir şey otomatik eklenmez**, kullanıcı onaylar.
- **Ping:** Sistem `ping` komutu, 8 eşzamanlı, dashboard'da çevrimdışı switch/envanter özeti.

## Yedekleme / geri yükleme güvenlik ağı

- Dışa aktarma: tüm tablolar JSON. Kasa/lisans anahtarları **şifreli hâliyle** girer (dışa aktarma yolunda hiç
  decrypt yoktur, kasa kilitliyken de çalışır). Salt yedekle taşındığı için aynı ana parola başka makinede açar.
- İçe aktarma: kolon listeleri sabit (yüklenen JSON anahtarları asla SQL tanımlayıcısı olmaz);
  yıkıcı işlemden önce **otomatik güvenlik yedeği** (`data/auto-backup-before-restore-*.json`, son 5);
  silme+ekleme **tek transaction**, hata olursa ROLLBACK; yedek boşsa veya mevcut veriden belirgin biçimde
  küçükse ekstra onay (`409`). Yedeklerde yüklenen dosyaların *içeriği* yoktur, yalnız metadata.
- Kasa içeren yedeği içe aktarırken arayüz "kaynak sistemin ana parolası gerekir" uyarısı verir.

## Ek güvenlik notları

- Dosya yükleme: uzantı allowlist'i (çalıştırılabilir yok), 10 MB sınır, dosya adı UUID, path traversal temizliği.
- Ping, SNMP sorgusu ve ağ taraması dahil tüm `/api/*` uçları yalnız giriş yapmış kullanıcıya açıktır.
- CORS şu an tüm origin'lere açıktır (tek-origin kullanım için); internete açmadan önce daraltılmalıdır.
- Dosya yükleme içerikleri yedeğe girmez; `data/uploads/` ayrıca yedeklenmelidir.
