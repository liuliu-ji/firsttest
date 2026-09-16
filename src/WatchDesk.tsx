import { useMemo, useState } from "react";
import { KIND_LABEL } from "./market";
import {
  WATCH_CLUB,
  WATCH_USER,
  ingestWatchHtml,
  mergeWatchThreads,
  parseWatchPaste,
  summarizeThread,
  xfqFollowUps,
  xfqStarted,
  type WatchFile,
  type WatchThread,
} from "./watch";
import type { Player } from "./playerDb";

function importWatch(raw: string, existing: WatchThread[]): WatchThread[] {
  const incoming = raw.includes("<") ? ingestWatchHtml(raw) : parseWatchPaste(raw);
  return mergeWatchThreads(existing, incoming);
}

export default function WatchDesk({
  squad,
  watch,
  onImport,
}: {
  squad: Player[];
  watch: WatchFile;
  onImport: (threads: WatchThread[]) => void;
}) {
  const [paste, setPaste] = useState("");
  const [openTid, setOpenTid] = useState<string | null>(null);

  const started = useMemo(() => xfqStarted(watch.threads), [watch]);
  const followUps = useMemo(() => xfqFollowUps(watch.threads), [watch]);
  const all = watch.threads;

  const ingest = async (files: FileList | null) => {
    const list = [...(files ?? [])];
    if (!list.length) return;
    const texts = await Promise.all(list.map((file) => file.text()));
    onImport(importWatch(texts.join("\n"), watch.threads));
  };

  return (
    <section className="db">
      <div className="toolbar">
        <div>
          <h2>XFQ 监盘</h2>
          <p>
            用户 {WATCH_USER} · 俱乐部 {WATCH_CLUB} · 阵容 {squad.length} 人 · 监盘帖 {all.length} ·
            他发的帖 {started.length} · 他跟的帖 {followUps.length}
          </p>
        </div>
      </div>

      <div className="market-import">
        <strong>导入 XFQ 的主题帖 / 跟帖</strong>
        <p>
          把 XFQ 的
          {" "}
          <a href={`https://bbs.yhpes.com/home.php?mod=space&username=${WATCH_USER}&do=thread&view=me`} target="_blank" rel="noreferrer">主题</a>
          、
          <a href={`https://bbs.yhpes.com/home.php?mod=space&username=${WATCH_USER}&do=reply&view=me`} target="_blank" rel="noreferrer">回复</a>
          或整帖页面另存为 HTML 上传；也可以按下格式粘贴楼层。
        </p>
        <div className="market-actions">
          <label className="replace replace-light">
            上传 HTML
            <input className="file-input" type="file" accept=".html,.htm,.txt" multiple onChange={(event) => {
              void ingest(event.target.files);
              event.target.value = "";
            }} />
          </label>
          <button
            type="button"
            className="replace replace-light"
            onClick={() => {
              if (!paste.trim()) return;
              onImport(importWatch(paste, watch.threads));
              setPaste("");
            }}
          >
            导入粘贴
          </button>
        </div>
        <textarea
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          placeholder={"88 【挂牌】伯卡特 227 底价12M\n#1 xfq 2026-05-12 10:00 底价12M\n#2 ANDY 2026-05-12 11:00 出价13M\n#3 xfq 2026-05-12 12:00 收到"}
        />
        {watch.error && !watch.ok && <p className="muted">{watch.error}</p>}
      </div>

      <div className="watch-grid">
        <div>
          <h3 className="watch-h">XFQ 发帖</h3>
          <div className="table-wrap">
            <table className="players">
              <thead>
                <tr>
                  <th>帖子</th>
                  <th>类型</th>
                  <th>跟帖</th>
                  <th>最新报价</th>
                  <th>最后发言</th>
                </tr>
              </thead>
              <tbody>
                {started.length === 0 && (
                  <tr><td colSpan={5} className="muted">还没有 XFQ 的主题帖。导入他的主题列表或整帖 HTML。</td></tr>
                )}
                {started.map((thread) => {
                  const summary = summarizeThread(thread);
                  return (
                    <tr key={thread.tid} onClick={() => setOpenTid(thread.tid)}>
                      <td>
                        <strong>{thread.title}</strong>
                        <div className="sub">tid {thread.tid}{summary.xfqReplied ? " · XFQ已回" : ""}</div>
                      </td>
                      <td>{KIND_LABEL[thread.kind]}</td>
                      <td>{summary.replyCount}</td>
                      <td>{summary.lastBid || "-"}</td>
                      <td>
                        {summary.lastAuthor || "-"}
                        <div className="sub">{summary.lastAt}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="watch-h">XFQ 跟帖</h3>
          <div className="table-wrap">
            <table className="players">
              <thead>
                <tr>
                  <th>帖子</th>
                  <th>楼层</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                {followUps.length === 0 && (
                  <tr><td colSpan={3} className="muted">还没有抓到 XFQ 在别人帖下的跟帖。</td></tr>
                )}
                {followUps.map((floor) => {
                  const thread = all.find((item) => item.tid === floor.tid);
                  return (
                    <tr key={`${floor.tid}-${floor.pid}`} onClick={() => setOpenTid(floor.tid)}>
                      <td><strong>{thread?.title ?? floor.tid}</strong></td>
                      <td>#{floor.floor}</td>
                      <td>
                        {floor.content || "-"}
                        {floor.price ? <div className="sub">{floor.price}</div> : null}
                        <div className="sub">{floor.postedAt}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h3 className="watch-h">xfq-伯恩利阵容</h3>
      <div className="table-wrap">
        <table className="players">
          <thead>
            <tr>
              <th>球员</th>
              <th>位置</th>
              <th>等级</th>
              <th>能力</th>
              <th>合同</th>
            </tr>
          </thead>
          <tbody>
            {squad.map((player) => (
              <tr key={player.id}>
                <td>
                  <strong>{player.chineseName}</strong>
                  <div className="sub">{player.englishName} · {player.id}</div>
                </td>
                <td>{player.registeredPosition}</td>
                <td>{player.level}</td>
                <td>{player.overall}</td>
                <td>{player.contract}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openTid && (
        <ThreadDrawer
          thread={all.find((item) => item.tid === openTid) ?? null}
          onClose={() => setOpenTid(null)}
        />
      )}
    </section>
  );
}

function ThreadDrawer({
  thread,
  onClose,
}: {
  thread: WatchThread | null;
  onClose: () => void;
}) {
  if (!thread) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="drawer-close" onClick={onClose}>关闭</button>
        <p className="eyebrow">{KIND_LABEL[thread.kind]} · tid {thread.tid}</p>
        <h2>{thread.title}</h2>
        {thread.url && (
          <p><a href={thread.url} target="_blank" rel="noreferrer">打开原帖</a></p>
        )}
        <ol className="floors">
          {thread.floors.map((floor) => (
            <li key={floor.pid} className={floor.isWatchUser ? "floor-xfq" : undefined}>
              <strong>#{floor.floor} {floor.author}</strong>
              {floor.isOp ? " · 楼主" : ""}
              {floor.isWatchUser ? " · XFQ" : ""}
              <div className="sub">{floor.postedAt}{floor.price ? ` · ${floor.price}` : ""}</div>
              <p>{floor.content || "（无正文）"}</p>
            </li>
          ))}
        </ol>
        {thread.floors.length === 0 && <p className="muted">只有标题，还没有楼层。请再导入整帖 HTML。</p>}
      </aside>
    </div>
  );
}
