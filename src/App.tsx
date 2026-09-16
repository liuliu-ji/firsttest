import { useCallback, useRef, useState } from "react";
import {
  ACCEPTED_EXTENSIONS,
  columnLetter,
  formatFileSize,
  readExcelFile,
  type SheetData,
  type WorkbookData,
} from "./excel";

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");

function DropZone({
  busy,
  compact,
  onFile,
}: {
  busy: boolean;
  compact?: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <button
      type="button"
      className={`dropzone ${compact ? "dropzone-compact" : ""} ${dragOver ? "dropzone-active" : ""}`}
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept={ACCEPT}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {compact ? (
        <strong>重新上传</strong>
      ) : (
        <>
          <span className="dropzone-icon" aria-hidden="true">
            📄
          </span>
          <strong>点击或拖拽上传 Excel 表格</strong>
          <p>支持 .xlsx、.xls、.xlsm、.csv、.ods，单文件不超过 20MB</p>
        </>
      )}
    </button>
  );
}

function SheetTable({ sheet }: { sheet: SheetData }) {
  const colCount = Math.max(sheet.totalCols, 1);
  const letters = Array.from({ length: colCount }, (_, index) => columnLetter(index));

  if (sheet.totalRows === 0) {
    return <div className="empty-sheet">该工作表没有数据</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="row-head" />
            {letters.map((letter) => (
              <th key={letter}>{letter}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === 0 ? "header-row" : undefined}>
              <th className="row-head">{rowIndex + 1}</th>
              {letters.map((_, colIndex) => (
                <td key={colIndex}>{row[colIndex] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const next = await readExcelFile(file);
      setWorkbook(next);
      setActiveSheet(0);
    } catch (err) {
      setWorkbook(null);
      setError(err instanceof Error ? err.message : "读取失败");
    } finally {
      setBusy(false);
    }
  }, []);

  const sheet = workbook?.sheets[activeSheet];

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">表格预览</p>
        <h1>Excel 表格上传读取</h1>
        <p className="lede">
          选择本地 Excel 文件后即可在线解析并预览全部工作表，无需安装 Office。
        </p>
      </header>

      {!workbook && (
        <>
          <DropZone busy={busy} onFile={onFile} />
          <p className="sample-link">
            没有现成文件？
            <a href="/sample.xlsx" download="sample.xlsx">
              下载示例表格
            </a>
          </p>
        </>
      )}

      {busy && <p className="status">正在读取表格…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {workbook && sheet && (
        <section className="viewer">
          <div className="toolbar">
            <div>
              <h2>{workbook.fileName}</h2>
              <p>
                {formatFileSize(workbook.fileSize)} · {workbook.sheets.length} 个工作表 ·
                共 {sheet.totalRows} 行 / {sheet.totalCols} 列
                {sheet.truncated ? ` · 仅预览前 ${sheet.rows.length} 行` : ""}
              </p>
            </div>
            <DropZone busy={busy} compact onFile={onFile} />
          </div>
          <SheetTable sheet={sheet} />
          <nav className="sheet-tabs" aria-label="工作表">
            {workbook.sheets.map((item, index) => (
              <button
                key={`${item.name}-${index}`}
                type="button"
                className={index === activeSheet ? "tab tab-active" : "tab"}
                onClick={() => setActiveSheet(index)}
              >
                {item.name}
              </button>
            ))}
          </nav>
        </section>
      )}
    </div>
  );
}
