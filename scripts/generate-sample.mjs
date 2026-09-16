import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "sample.xlsx");

const workbook = XLSX.utils.book_new();

const employees = XLSX.utils.aoa_to_sheet([
  ["姓名", "部门", "入职日期", "薪资"],
  ["张三", "研发", "2023-04-12", 18000],
  ["李四", "产品", "2022-11-03", 21000],
  ["王五", "设计", "2024-01-20", 16000],
  ["赵六", "运营", "2021-08-09", 15000],
]);

const summary = XLSX.utils.aoa_to_sheet([
  ["部门", "人数", "平均薪资"],
  ["研发", 1, 18000],
  ["产品", 1, 21000],
  ["设计", 1, 16000],
  ["运营", 1, 15000],
]);

XLSX.utils.book_append_sheet(workbook, employees, "员工");
XLSX.utils.book_append_sheet(workbook, summary, "汇总");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.from(XLSX.write(workbook, { type: "array", bookType: "xlsx" })));
console.log(`wrote ${output}`);
