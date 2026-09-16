import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  columnLetter,
  isAcceptedFileName,
  parseWorkbook,
  PREVIEW_ROW_LIMIT,
} from "./excel";

function workbookToBuffer(
  sheets: Record<string, unknown[][]>,
  bookType: XLSX.BookType = "xlsx",
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return XLSX.write(workbook, { type: "array", bookType }) as Uint8Array;
}

describe("isAcceptedFileName", () => {
  it("accepts common spreadsheet extensions", () => {
    expect(isAcceptedFileName("员工.xlsx")).toBe(true);
    expect(isAcceptedFileName("报表.XLS")).toBe(true);
    expect(isAcceptedFileName("data.csv")).toBe(true);
    expect(isAcceptedFileName("notes.txt")).toBe(false);
  });
});

describe("columnLetter", () => {
  it("converts 0-based indexes to Excel column letters", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
  });
});

describe("parseWorkbook", () => {
  it("reads xlsx sheets, headers, and cell values", () => {
    const buffer = workbookToBuffer({
      员工: [
        ["姓名", "年龄", "城市"],
        ["张三", 28, "北京"],
        ["李四", 32, "上海"],
      ],
      汇总: [["人数", 2]],
    });

    const result = parseWorkbook(buffer, "员工.xlsx", buffer.byteLength);
    expect(result.fileName).toBe("员工.xlsx");
    expect(result.sheets.map((sheet) => sheet.name)).toEqual(["员工", "汇总"]);
    expect(result.sheets[0].totalRows).toBe(3);
    expect(result.sheets[0].totalCols).toBe(3);
    expect(result.sheets[0].rows[0]).toEqual(["姓名", "年龄", "城市"]);
    expect(result.sheets[0].rows[1]).toEqual(["张三", "28", "北京"]);
    expect(result.sheets[1].rows[0]).toEqual(["人数", "2"]);
  });

  it("reads the legacy xls format", () => {
    const buffer = workbookToBuffer(
      { Sheet1: [["产品", "数量"], ["茶叶", 12]] },
      "xls",
    );
    const result = parseWorkbook(buffer, "库存.xls", buffer.byteLength);
    expect(result.sheets[0].rows[1]).toEqual(["茶叶", "12"]);
  });

  it("reads utf-8 csv content", () => {
    const csv = "商品,金额\n茶叶,99.5\n";
    const buffer = new TextEncoder().encode(csv);
    const result = parseWorkbook(buffer, "账单.csv", buffer.byteLength);
    expect(result.sheets[0].rows[0]).toEqual(["商品", "金额"]);
    expect(result.sheets[0].rows[1]).toEqual(["茶叶", "99.5"]);
  });

  it("rejects unsupported file names", () => {
    expect(() => parseWorkbook(new Uint8Array(), "photo.png", 10)).toThrow(
      /仅支持/,
    );
  });

  it("truncates very large sheets in the preview", () => {
    const rows = Array.from({ length: PREVIEW_ROW_LIMIT + 25 }, (_, index) => [
      index,
    ]);
    const buffer = workbookToBuffer({ 大数据: rows });
    const result = parseWorkbook(buffer, "big.xlsx", buffer.byteLength);
    expect(result.sheets[0].truncated).toBe(true);
    expect(result.sheets[0].rows).toHaveLength(PREVIEW_ROW_LIMIT);
    expect(result.sheets[0].totalRows).toBe(PREVIEW_ROW_LIMIT + 25);
  });
});
