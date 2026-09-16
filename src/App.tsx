import { useCallback, useEffect, useState } from "react";
import PlayerDatabaseView from "./PlayerDatabase";
import { readExcelFile } from "./excel";
import { parsePlayerDatabase, type PlayerDatabase } from "./playerDb";
import { attachMarketToPlayers, type MarketFile, type MarketPost } from "./market";

function applyMarket(database: PlayerDatabase, posts: MarketPost[]): PlayerDatabase {
  return {
    ...database,
    players: attachMarketToPlayers(database.players, posts),
  };
}

export default function App() {
  const [database, setDatabase] = useState<PlayerDatabase | null>(null);
  const [market, setMarket] = useState<MarketFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const applyWorkbook = useCallback((fileName: string, sheets: { name: string; rows: string[][] }[], posts: MarketPost[]) => {
    const next = applyMarket(parsePlayerDatabase(sheets, fileName), posts);
    setDatabase(next);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [playersRes, marketRes] = await Promise.all([
          fetch("/players.json"),
          fetch("/market.json"),
        ]);
        if (!playersRes.ok) throw new Error("默认球员库加载失败");
        const playersJson = (await playersRes.json()) as PlayerDatabase;
        const marketJson = marketRes.ok ? ((await marketRes.json()) as MarketFile) : null;
        if (!cancelled) {
          setMarket(marketJson);
          setDatabase(applyMarket(playersJson, marketJson?.posts ?? []));
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
      applyWorkbook(workbook.fileName, workbook.sheets, market?.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    } finally {
      setBusy(false);
    }
  }, [applyWorkbook, market]);

  const onImportMarket = useCallback((posts: MarketPost[]) => {
    setMarket((prev) => {
      const merged = new Map<string, MarketPost>();
      for (const post of [...(prev?.posts ?? []), ...posts]) {
        merged.set(`${post.tid}|${post.title}`, post);
      }
      const next: MarketFile = {
        source: "bbs.yhpes.com",
        fetchedAt: new Date().toISOString(),
        ok: merged.size > 0,
        error: "",
        posts: [...merged.values()],
      };
      setDatabase((db) => (db ? applyMarket(db, next.posts) : db));
      return next;
    });
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">PES6 · 121届友好联赛</p>
        <h1>球员数据库</h1>
        <p className="lede">
          已读取《121届友好联赛数据库（核对版）》。导入 bbs.yhpes.com 挂牌/续约后，即可按你的条件筛选。
        </p>
      </header>
      {busy && !database && <p className="status">正在加载球员库…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {database && (
        <PlayerDatabaseView
          database={database}
          market={market}
          onReplace={onFile}
          onImportMarket={onImportMarket}
          busy={busy}
        />
      )}
    </div>
  );
}
