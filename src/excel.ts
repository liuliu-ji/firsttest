import * as XLSX from "xlsx";

export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".csv", ".ods"] as const;
export const PREVIEW_ROW_LIMIT = 1000;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export type SheetData = {
  name: string;
  rows: string[][];
  totalRows: number;
  totalCols: number;
  truncated: boolean;
};

export type WorkbookData = {
  fileName: string;
  fileSize: number;
  sheets: SheetData[];
};

export function isAcceptedFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trimEnd();
}

function normalizeMatrix(matrix: unknown[][]): string[][] {
  const lastUsedRow = matrix.reduce((last, row, index) => {
    const hasValue = Array.isArray(row) && row.some((cell) => cell != null && String(cell).trim() !== "");
    return hasValue ? index : last;
  }, -1);

  if (lastUsedRow < 0) return [];

  const used = matrix.slice(0, lastUsedRow + 1);
  const totalCols = used.reduce((max, row) => {
    if (!Array.isArray(row)) return max;
    let lastCol = -1;
    row.forEach((cell, index) => {
      if (cell != null && String(cell).trim() !== "") lastCol = index;
    });
    return Math.max(max, lastCol + 1);
  }, 0);

  return used.map((row) => {
    const next = Array.from({ length: totalCols }, () => "");
    if (Array.isArray(row)) {
      for (let i = 0; i < Math.min(row.length, totalCols); i += 1) {
        next[i] = cellToString(row[i]);
      }
    }
    return next;
  });
}

export function parseWorkbook(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
  fileSize: number,
): WorkbookData {
  if (!isAcceptedFileName(fileName)) {
    throw new Error("仅支持 .xlsx、.xls、.xlsm、.csv、.ods 表格文件");
  }
  if (fileSize > MAX_FILE_BYTES) {
    throw new Error("文件过大，请上传不超过 20MB 的表格");
  }

  let workbook: XLSX.WorkBook;
  try {
    if (fileName.toLowerCase().endsWith(".csv")) {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const text = new TextDecoder("utf-8").decode(bytes);
      workbook = XLSX.read(text, { type: "string", cellDates: true });
    } else {
      workbook = XLSX.read(data, {
        type: "array",
        cellDates: true,
        dense: true,
      });
    }
  } catch {
    throw new Error("无法解析该文件，请确认是有效的 Excel / CSV 表格");
  }

  if (!workbook.SheetNames.length) {
    throw new Error("该文件不包含任何工作表");
  }

  const sheets: SheetData[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
    });
    const allRows = normalizeMatrix(matrix);
    const totalRows = allRows.length;
    const totalCols = allRows[0]?.length ?? 0;
    const truncated = totalRows > PREVIEW_ROW_LIMIT;

    return {
      name,
      rows: truncated ? allRows.slice(0, PREVIEW_ROW_LIMIT) : allRows,
      totalRows,
      totalCols,
      truncated,
    };
  });

  return { fileName, fileSize, sheets };
}

export async function readExcelFile(file: File): Promise<WorkbookData> {
  if (!isAcceptedFileName(file.name)) {
    throw new Error("仅支持 .xlsx、.xls、.xlsm、.csv、.ods 表格文件");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("文件过大，请上传不超过 20MB 的表格");
  }
  const buffer = await file.arrayBuffer();
  return parseWorkbook(buffer, file.name, file.size);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
