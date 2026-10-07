import fs from "node:fs";
import path from "node:path";

const src = path.join("src", "db", "schema.sql");
const destDir = path.join("dist", "db");
const dest = path.join(destDir, "schema.sql");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[build] ${src} -> ${dest}`);
