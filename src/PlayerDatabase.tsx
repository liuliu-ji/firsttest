import { useMemo, useState } from "react";
import {
  EMPTY_FILTERS,
  STAT_GROUPS,
  filterPlayers,
  isFreeAgent,
  uniqueSorted,
  type Player,
  type PlayerDatabase,
  type PlayerFilters,
  type SortKey,
} from "./playerDb";
import { CONDITION_GUIDE, SKILL_GUIDE } from "./skillGuide";
import {
  KIND_LABEL,
  buildCatalog,
  parseMarketHtml,
  parseMarketText,
  type MarketFile,
  type MarketKind,
  type MarketPost,
} from "./market";

const PAGE_SIZE = 40;

function StatBar({ label, value }: { label: string; value: number }) {
  const max = label === "状态持续" || label === "环境适应能力" ? 8 : 99;
  const ratio = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = value >= 90 ? "hot" : value >= 80 ? "good" : value >= 70 ? "ok" : "mid";
  return (
    <div className="stat">
      <span>{label}</span>
      <div className="bar">
        <i className={tone} style={{ width: `${ratio}%` }} />
      </div>
      <b>{value}</b>
    </div>
  );
}

function PlayerDetail({
  player,
  onClose,
}: {
  player: Player;
  onClose: () => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={player.chineseName}>
        <button type="button" className="drawer-close" onClick={onClose}>
          关闭
        </button>
        <p className="eyebrow">{player.isStar ? "球星" : player.level}</p>
        <h2>{player.chineseName}</h2>
        <p className="muted">{player.englishName}</p>
        <div className="chips">
          <span>{player.registeredPosition}</span>
          <span>{player.nation}</span>
          <span>{player.age} 岁</span>
          <span>{player.height}cm / {player.weight}kg</span>
          <span>{player.foot}</span>
          <span>伤耐 {player.injury || "-"}</span>
          {player.unauthorized && <span className="warn">无授权</span>}
          {(player.marketPosts ?? []).map((post) => (
            <a key={`${post.tid}-${post.title}`} className="chip-link" href={post.url} target="_blank" rel="noreferrer">
              {KIND_LABEL[post.kind as MarketKind] || "论坛"}
            </a>
          ))}
        </div>
        <dl className="kv">
          <div><dt>能力 / 潜力</dt><dd>{player.overall} / {player.potential}</dd></div>
          <div><dt>友好评分</dt><dd>{player.friendlyScore}</dd></div>
          <div><dt>俱乐部</dt><dd>{player.club || "未注册"}</dd></div>
          <div><dt>合同</dt><dd>{player.contract || "-"}</dd></div>
          <div><dt>球员ID</dt><dd>{player.id}</dd></div>
          <div><dt>位置</dt><dd>{player.allPositions.join(" / ") || player.registeredPosition}</dd></div>
          <div><dt>逆足精度 / 频度</dt><dd>{player.weakFootAcc} / {player.weakFootFreq}</dd></div>
        </dl>
        <h3>特技 {player.skills.length ? `(${player.skills.length})` : ""}</h3>
        {player.skills.length ? (
          <div className="chips">
            {player.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        ) : (
          <p className="muted">无特技</p>
        )}
        {STAT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            {group.keys.map((key) => (
              <StatBar key={key} label={key} value={player.stats[key]} />
            ))}
          </section>
        ))}
      </aside>
    </div>
  );
}

export default function PlayerDatabaseView({
  database,
  market,
  onReplace,
  onImportMarket,
  busy,
}: {
  database: PlayerDatabase;
  market: MarketFile | null;
  onReplace: (file: File) => void;
  onImportMarket: (posts: MarketPost[]) => void;
  busy: boolean;
}) {
  const [filters, setFilters] = useState<PlayerFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("friendlyScore");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [importKind, setImportKind] = useState<MarketKind>("listing");

  const catalog = useMemo(() => buildCatalog(database.players), [database]);
  const unmatched = useMemo(
    () => (market?.posts ?? []).filter((post) => !post.playerId),
    [market],
  );

  const positions = useMemo(
    () => uniqueSorted(database.players.map((p) => p.registeredPosition)),
    [database],
  );
  const levels = useMemo(
    () => uniqueSorted(database.players.map((p) => p.level)),
    [database],
  );
  const clubs = useMemo(
    () => uniqueSorted(database.players.map((p) => p.club)),
    [database],
  );
  const nations = useMemo(
    () => uniqueSorted(database.players.map((p) => p.nation)),
    [database],
  );

  const rows = useMemo(
    () => filterPlayers(database.players, filters, sortKey),
    [database, filters, sortKey],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = database.players.find((player) => player.id === selectedId) ?? null;

  const patch = (next: Partial<PlayerFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(0);
  };

  const importText = (raw: string, kind: MarketKind, board: string) => {
    const posts = raw.includes("<") && raw.includes("href")
      ? parseMarketHtml(raw, { kind, board, catalog })
      : parseMarketText(raw, { kind, board, catalog });
    onImportMarket(posts);
  };

  const listedCount = database.players.filter((player) =>
    (player.marketPosts ?? []).some((post) => post.kind === "listing"),
  ).length;
  const renewalCount = database.players.filter((player) =>
    (player.marketPosts ?? []).some((post) => post.kind === "renewal"),
  ).length;

  return (
    <section className="db">
      <div className="toolbar">
        <div>
          <h2>121届友好联赛球员库</h2>
          <p>
            {database.sourceFile} · {database.players.length} 人 · 挂牌 {listedCount} · 续约 {renewalCount} ·
            无授权 {database.unauthorizedIds.length}
          </p>
        </div>
        <label className="replace">
          更换数据库
          <input
            className="file-input"
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv,.ods"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onReplace(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="market-import">
        <strong>bbs.yhpes.com 挂牌 / 续约</strong>
        {market?.ok ? (
          <p>已导入 {market.posts.length} 条论坛帖，可按下方「市场」筛选。</p>
        ) : (
          <p>
            {market?.error || "当前云环境连不上论坛服务器。"}
            请打开
            {" "}
            <a href="https://bbs.yhpes.com/forum.php?mod=forumdisplay&fid=39" target="_blank" rel="noreferrer">挂牌区</a>
            {" / "}
            <a href="https://bbs.yhpes.com/forum.php?mod=forumdisplay&fid=38" target="_blank" rel="noreferrer">续约区</a>
            ，把页面另存为 HTML 上传，或把帖子标题粘贴进来。
          </p>
        )}
        <div className="market-actions">
          <select value={importKind} onChange={(event) => setImportKind(event.target.value as MarketKind)}>
            <option value="listing">导入为挂牌</option>
            <option value="renewal">导入为续约</option>
            <option value="release">导入为解约</option>
          </select>
          <label className="replace replace-light">
            上传 HTML
            <input
              className="file-input"
              type="file"
              accept=".html,.htm,.txt"
              multiple
              onChange={async (event) => {
                const files = [...(event.target.files ?? [])];
                const texts = await Promise.all(files.map((file) => file.text()));
                importText(texts.join("\n"), importKind, files.map((file) => file.name).join(","));
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="replace replace-light"
            onClick={() => {
              if (paste.trim()) {
                importText(paste, importKind, "粘贴");
                setPaste("");
              }
            }}
          >
            导入粘贴
          </button>
        </div>
        <textarea
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          placeholder="每行一条，例如：【挂牌】小兵-纽卡斯尔联 哈兰德 3853 底价20M"
        />
        {unmatched.length > 0 && (
          <p className="muted">有 {unmatched.length} 条没对上球员库，可把标题改成「中文名 + 球员ID」后再导入。</p>
        )}
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="搜索中文名 / 英文名 / ID / 俱乐部"
          value={filters.query}
          onChange={(event) => patch({ query: event.target.value })}
        />
        <select value={filters.position} onChange={(event) => patch({ position: event.target.value })}>
          <option value="">全部位置</option>
          {positions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={filters.level} onChange={(event) => patch({ level: event.target.value })}>
          <option value="">全部等级</option>
          {levels.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={filters.club} onChange={(event) => patch({ club: event.target.value })}>
          <option value="">全部俱乐部</option>
          {clubs.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={filters.nation} onChange={(event) => patch({ nation: event.target.value })}>
          <option value="">全部国籍</option>
          {nations.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={filters.market} onChange={(event) => patch({ market: event.target.value as PlayerFilters["market"] })}>
          <option value="">市场不限</option>
          <option value="onMarket">挂牌或续约</option>
          <option value="listing">仅挂牌</option>
          <option value="renewal">仅续约</option>
          <option value="release">仅解约</option>
        </select>
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
          <option value="friendlyScore">友好评分</option>
          <option value="overall">能力</option>
          <option value="potential">潜力</option>
          <option value="age">年龄</option>
          <option value="chineseName">姓名</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.starsOnly}
            onChange={(event) => patch({ starsOnly: event.target.checked })}
          />
          仅球星
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.freeAgentsOnly}
            onChange={(event) => patch({ freeAgentsOnly: event.target.checked })}
          />
          自由球员
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.unauthorizedOnly}
            onChange={(event) => patch({ unauthorizedOnly: event.target.checked })}
          />
          无授权
        </label>
        <button type="button" className="linkish" onClick={() => setGuideOpen((open) => !open)}>
          {guideOpen ? "收起能力说明" : "PES6 能力说明"}
        </button>
      </div>

      {guideOpen && (
        <div className="guide">
          {CONDITION_GUIDE.map((item) => (
            <p key={item.title}><strong>{item.title}：</strong>{item.text}</p>
          ))}
          <div className="guide-grid">
            {SKILL_GUIDE.map((item) => (
              <p key={item.name}><strong>{item.name}：</strong>{item.summary}</p>
            ))}
          </div>
        </div>
      )}

      <p className="result-meta">共 {rows.length} 名球员，第 {safePage + 1}/{pageCount} 页</p>
      <div className="table-wrap">
        <table className="players">
          <thead>
            <tr>
              <th>球员</th>
              <th>位置</th>
              <th>等级</th>
              <th>能力</th>
              <th>评分</th>
              <th>俱乐部</th>
              <th>市场</th>
              <th>特技</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((player) => (
              <tr key={player.id} onClick={() => setSelectedId(player.id)}>
                <td>
                  <strong>{player.chineseName}</strong>
                  <div className="sub">{player.englishName} · {player.nation} · {player.age}岁</div>
                </td>
                <td>{player.registeredPosition}</td>
                <td>{player.level}</td>
                <td>{player.overall}<span className="sub"> / {player.potential}</span></td>
                <td>{player.friendlyScore}</td>
                <td>
                  {player.club || "未注册"}
                  {isFreeAgent(player) ? <div className="sub">自由</div> : <div className="sub">{player.contract}</div>}
                </td>
                <td>
                  {(player.marketPosts ?? []).length
                    ? [...new Set((player.marketPosts ?? []).map((post) => KIND_LABEL[post.kind as MarketKind] || post.kind))].join(" / ")
                    : "-"}
                  {(player.marketPosts ?? [])[0]?.price ? <div className="sub">{player.marketPosts![0].price}</div> : null}
                </td>
                <td>{player.skills.slice(0, 3).join("、") || "-"}{player.skills.length > 3 ? "…" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button type="button" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>上一页</button>
        <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>下一页</button>
      </div>
      {selected && <PlayerDetail player={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}
