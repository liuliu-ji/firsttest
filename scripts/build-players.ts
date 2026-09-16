import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorkbook } from "../src/excel.ts";
import { parsePlayerDatabase } from "../src/playerDb.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "data", "121届友好联赛数据库(核对版).xlsx");
const output = join(root, "public", "players.json");

const buffer = readFileSync(source);
const workbook = parseWorkbook(
  buffer,
  "121届友好联赛数据库(核对版).xlsx",
  buffer.byteLength,
  { rowLimit: 0 },
);
const database = parsePlayerDatabase(
  workbook.sheets.map((sheet) => ({ name: sheet.name, rows: sheet.rows })),
  workbook.fileName,
);

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(database));
console.log(
  `wrote ${output} (${database.players.length} players, ${database.unauthorizedIds.length} unauthorized)`,
);
