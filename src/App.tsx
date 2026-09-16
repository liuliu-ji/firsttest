import { useCallback, useEffect, useState } from "react";
import PlayerDatabaseView from "./PlayerDatabase";
import { readExcelFile } from "./excel";
import { parsePlayerDatabase, type PlayerDatabase } from "./playerDb";

export default function App() {
  const [database, setDatabase] = useState<PlayerDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const applyWorkbook = useCallback((fileName: string, sheets: { name: string; rows: string[][] }[]) => {
    const next = parsePlayerDatabase(sheets, fileName);
    setDatabase(next);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/players.json");
        if (!response.ok) throw new Error("默认球员库加载失败");
        const json = (await response.json()) as PlayerDatabase;
        if (!cancelled) {
          setDatabase(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "默认球员库加载失败");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const workbook = await readExcelFile(file);
      applyWorkbook(workbook.fileName, workbook.sheets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    } finally {
      setBusy(false);
    }
  }, [applyWorkbook]);

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">PES6 · 121届友好联赛</p>
        <h1>球员数据库</h1>
        <p className="lede">
          已读取仓库中的《121届友好联赛数据库（核对版）》。可按名字、位置、俱乐部筛选，点击球员查看完整能力和特技。
        </p>
      </header>
      {busy && !database && <p className="status">正在加载球员库…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {database && <PlayerDatabaseView database={database} onReplace={onFile} busy={busy} />}
    </div>
  );
}
