import { useCallback, useEffect, useMemo, useState } from "react";
import PlayerDatabaseView from "./PlayerDatabase";
import WatchDesk from "./WatchDesk";
import { readExcelFile } from "./excel";
import { parsePlayerDatabase, type PlayerDatabase } from "./playerDb";
import { attachMarketToPlayers, type MarketFile, type MarketPost } from "./market";
import { WATCH_CLUB, mergeWatchThreads, type WatchFile, type WatchThread } from "./watch";

function applyMarket(database: PlayerDatabase, posts: MarketPost[]): PlayerDatabase {
  return {
    ...database,
    players: attachMarketToPlayers(database.players, posts),
  };
}

const EMPTY_WATCH: WatchFile = {
  user: "xfq",
  club: WATCH_CLUB,
  fetchedAt: "",
  ok: false,
  error: "",
  threads: [],
};

export default function App() {
  const [database, setDatabase] = useState<PlayerDatabase | null>(null);
  const [market, setMarket] = useState<MarketFile | null>(null);
  const [watch, setWatch] = useState<WatchFile>(EMPTY_WATCH);
  const [tab, setTab] = useState<"players" | "watch">("watch");
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
        const [playersRes, marketRes, watchRes] = await Promise.all([
          fetch("/players.json"),
          fetch("/market.json"),
          fetch("/watch.json"),
        ]);
        if (!playersRes.ok) throw new Error("默认球员库加载失败");
        const playersJson = (await playersRes.json()) as PlayerDatabase;
        const marketJson = marketRes.ok ? ((await marketRes.json()) as MarketFile) : null;
        const watchJson = watchRes.ok ? ((await watchRes.json()) as WatchFile) : EMPTY_WATCH;
        if (!cancelled) {
          setMarket(marketJson);
          setWatch({ ...EMPTY_WATCH, ...watchJson, threads: watchJson.threads ?? [] });
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

  const onImportWatch = useCallback((threads: WatchThread[]) => {
    setWatch((prev) => ({
      ...prev,
      fetchedAt: new Date().toISOString(),
      ok: threads.length > 0,
      error: "",
      threads: mergeWatchThreads(prev.threads, threads),
    }));
  }, []);

  const squad = useMemo(
    () => (database?.players ?? []).filter((player) => player.club === WATCH_CLUB),
    [database],
  );

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">PES6 · 121届友好联赛</p>
        <h1>球员数据库</h1>
        <p className="lede">
          监盘 XFQ（{WATCH_CLUB}）的发帖和跟帖，并对照伯恩利阵容做筛选。
        </p>
        <div className="tabs">
          <button type="button" className={tab === "watch" ? "tab tab-active" : "tab"} onClick={() => setTab("watch")}>
            XFQ 监盘
          </button>
          <button type="button" className={tab === "players" ? "tab tab-active" : "tab"} onClick={() => setTab("players")}>
            球员库
          </button>
        </div>
      </header>
      {busy && !database && <p className="status">正在加载球员库…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {database && tab === "players" && (
        <PlayerDatabaseView
          database={database}
          market={market}
          onReplace={onFile}
          onImportMarket={onImportMarket}
          busy={busy}
        />
      )}
      {database && tab === "watch" && (
        <WatchDesk squad={squad} watch={watch} onImport={onImportWatch} />
      )}
    </div>
  );
}
