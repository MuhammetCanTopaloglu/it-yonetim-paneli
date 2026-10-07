import { Router } from "express";
import { db } from "../db/connection.js";

const router = Router();

// Garanti bitişine 90 gün veya daha az kalan cihazlar "yaklaşıyor" sayılır.
const WARRANTY_UPCOMING_DAYS = 90;
// Lisans yenileme — garanti deseninden farklı: iki eşik. ≤14 gün "acil" (bir
// lisansın bitmesi yazılımı durdurabilir, garanti kadar tolere edilemez),
// ≤60 gün "yaklaşan". Client'taki lib/licenseRenewal.ts ile aynı sayılar.
const LICENSE_UPCOMING_DAYS = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface WarrantyRow {
  id: string;
  name: string;
  type: string;
  warranty_until: string;
}

interface WarrantyItem extends WarrantyRow {
  daysRemaining: number;
}

function countOf(sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...(params as (string | number)[])) as { c: number };
  return row.c;
}

/**
 * warranty_until boş/null olan cihazlar sorguya hiç girmiyor (uyarı üretmez).
 * Karşılaştırma, sunucunun yerel bugün tarihine göre (saat sıfırlanmış)
 * yapılır — istemcideki getDueUrgency ile aynı desen, tutarlı sınır.
 */
function computeWarrantyStatus(): { expired: WarrantyItem[]; upcoming: WarrantyItem[] } {
  const rows = db
    .prepare(
      `SELECT id, name, type, warranty_until FROM inventory WHERE warranty_until IS NOT NULL AND warranty_until != '' ORDER BY warranty_until ASC`
    )
    .all() as unknown as WarrantyRow[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expired: WarrantyItem[] = [];
  const upcoming: WarrantyItem[] = [];

  for (const row of rows) {
    const due = new Date(row.warranty_until);
    due.setHours(0, 0, 0, 0);
    const daysRemaining = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
    const item: WarrantyItem = { ...row, daysRemaining };

    if (daysRemaining < 0) {
      expired.push(item);
    } else if (daysRemaining <= WARRANTY_UPCOMING_DAYS) {
      upcoming.push(item);
    }
  }

  // En çok gecikmiş önce.
  expired.sort((a, b) => a.daysRemaining - b.daysRemaining);
  // upcoming zaten warranty_until ASC sıralı geldiği için en yakın tarih önde.

  return { expired, upcoming };
}

interface LicenseRenewalRow {
  id: string;
  product_name: string;
  renewal_date: string;
}

interface LicenseRenewalItem extends LicenseRenewalRow {
  daysRemaining: number;
}

/**
 * renewal_date boş/null olan lisanslar sorguya hiç girmiyor (uyarı üretmez).
 * Garanti fonksiyonuyla aynı bugün-karşılaştırma deseni; sadece eşik farklı
 * ve tek "upcoming" kovası ≤60 gün olan HER ŞEYİ içeriyor (acil/yaklaşan
 * ayrımı — ≤14 mü değil mi — client'ta her satırın daysRemaining'inden
 * hesaplanır, burada ayrı bir üçüncü kova açmaya gerek yok).
 */
function computeLicenseRenewalStatus(): { expired: LicenseRenewalItem[]; upcoming: LicenseRenewalItem[] } {
  const rows = db
    .prepare(
      `SELECT id, product_name, renewal_date FROM licenses WHERE renewal_date IS NOT NULL AND renewal_date != '' ORDER BY renewal_date ASC`
    )
    .all() as unknown as LicenseRenewalRow[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expired: LicenseRenewalItem[] = [];
  const upcoming: LicenseRenewalItem[] = [];

  for (const row of rows) {
    const due = new Date(row.renewal_date);
    due.setHours(0, 0, 0, 0);
    const daysRemaining = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
    const item: LicenseRenewalItem = { ...row, daysRemaining };

    if (daysRemaining < 0) {
      expired.push(item);
    } else if (daysRemaining <= LICENSE_UPCOMING_DAYS) {
      upcoming.push(item);
    }
  }

  expired.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return { expired, upcoming };
}

/**
 * Ağ Sağlığı özetinde "dikkat edilmesi gereken görevler" için: açık (tamam
 * olmayan) ve YÜKSEK öncelikli OLAN veya son tarihi geçmiş görevler. Genel
 * "Yaklaşan Görevler" listesinden (upcomingTasks, sadece due_date'e göre
 * sıralı) AYRI tutulur — burada öncelik de bir kriter.
 */
function computeCriticalTodos(): unknown[] {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT * FROM todos WHERE status != 'tamam' AND (priority = 'yuksek' OR (due_date IS NOT NULL AND due_date != '' AND due_date < ?))`
    )
    .all(today) as { due_date: string | null }[];

  // due_date bazen null yerine boş string ("") olarak saklanıyor — "" her
  // zaman herhangi bir tarihten "küçük" sayılır (lexicographic karşılaştırma),
  // bu yüzden hem null hem "" burada VE sıralamada aynı şekilde ele alınıyor.
  rows.sort((a, b) => {
    const aOverdue = !!a.due_date && a.due_date < today;
    const bOverdue = !!b.due_date && b.due_date < today;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99");
  });

  return rows;
}

router.get("/", (_req, res) => {
  const counts = {
    totalSwitches: countOf(`SELECT COUNT(*) AS c FROM switches`),
    totalInventory: countOf(`SELECT COUNT(*) AS c FROM inventory`),
    openTasks: countOf(`SELECT COUNT(*) AS c FROM todos WHERE status IN ('bekliyor', 'devam_ediyor')`),
    faultyInventory: countOf(`SELECT COUNT(*) AS c FROM inventory WHERE status = 'arizali'`),
    totalSubnets: countOf(`SELECT COUNT(*) AS c FROM subnets`),
    totalIpAssignments: countOf(`SELECT COUNT(*) AS c FROM ip_assignments`)
  };

  const upcomingTasks = db
    .prepare(
      `SELECT * FROM todos WHERE status != 'tamam' AND due_date IS NOT NULL ORDER BY due_date ASC LIMIT 8`
    )
    .all();

  const recentChangelog = db
    .prepare(`SELECT * FROM changelog ORDER BY created_at DESC LIMIT 5`)
    .all();

  const warranty = computeWarrantyStatus();
  const criticalTodos = computeCriticalTodos();
  const licenseRenewal = computeLicenseRenewalStatus();

  res.json({ counts, upcomingTasks, recentChangelog, warranty, criticalTodos, licenseRenewal });
});

export default router;
