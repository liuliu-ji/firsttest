import { inferKind, parseListingFields, stripTags, type MarketKind } from "./market";

export const WATCH_USER = "xfq";
export const WATCH_CLUB = "xfq-伯恩利";

export type WatchFloor = {
  pid: string;
  tid: string;
  floor: number;
  author: string;
  postedAt: string;
  content: string;
  price: string;
  isOp: boolean;
  isWatchUser: boolean;
};

export type WatchThread = {
  tid: string;
  title: string;
  url: string;
  kind: MarketKind;
  author: string;
  startedAt: string;
  floors: WatchFloor[];
};

export type WatchFile = {
  user: string;
  club: string;
  fetchedAt: string;
  ok: boolean;
  error: string;
  threads: WatchThread[];
};

export function isWatchUser(name: string, user = WATCH_USER): boolean {
  return name.trim().toLowerCase() === user.toLowerCase();
}

export function extractBid(text: string): string {
  return (
    text.match(/(?:出价|报价|加价|跟价|顶价|底价|解约金)[:：\s]*(\d+(?:\.\d+)?)\s*(M|m|万)?/)?.[0] ??
    text.match(/(\d+(?:\.\d+)?)\s*(M|万)(?!\d)/)?.[0] ??
    ""
  );
}

function subject(html: string): string {
  const hit =
    html.match(/id="thread_subject"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
    html.match(/id="thread_subject"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
    "";
  return stripTags(hit);
}

function tidFromHtml(html: string): string {
  return (
    html.match(/name="tid"\s+value="(\d+)"/i)?.[1] ??
    html.match(/mod=viewthread&(?:amp;)?tid=(\d+)/i)?.[1] ??
    html.match(/thread-(\d+)-/i)?.[1] ??
    ""
  );
}

function lookBehind(html: string, index: number, pattern: RegExp): string {
  const window = html.slice(Math.max(0, index - 1800), index);
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let last = "";
  let match: RegExpExecArray | null = global.exec(window);
  while (match) {
    last = match[1] ?? "";
    match = global.exec(window);
  }
  return last;
}

export function parseThreadHtml(html: string, fallbackTid = ""): WatchThread | null {
  const tid = tidFromHtml(html) || fallbackTid;
  const title = subject(html);
  const floors: WatchFloor[] = [];
  const re = /id="postmessage_(\d+)"[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null = re.exec(html);
  while (match) {
    const pid = match[1];
    const start = match.index;
    const author = stripTags(
      lookBehind(html, start, /class="xw1"[^>]*>([\s\S]*?)<\/a>/i) ||
        lookBehind(html, start, /username=([^"'&]+)/i),
    );
    const postedAt = stripTags(
      lookBehind(html, start, /authorposton\d+[^>]*>([\s\S]*?)<\/em>/i) ||
        lookBehind(html, start, /发表于\s*([^<]+)/i),
    ).replace(/^发表于\s*/, "");
    const content = stripTags(match[2]).slice(0, 500);
    floors.push({
      pid,
      tid,
      floor: floors.length + 1,
      author,
      postedAt,
      content,
      price: extractBid(content) || (floors.length === 0 ? parseListingFields(title + " " + content).price : ""),
      isOp: floors.length === 0,
      isWatchUser: isWatchUser(author),
    });
    match = re.exec(html);
  }
  if (!floors.length && !title) return null;
  const author = floors[0]?.author ?? "";
  return {
    tid,
    title: title || floors[0]?.content.slice(0, 40) || `帖子 ${tid}`,
    url: tid ? `https://bbs.yhpes.com/forum.php?mod=viewthread&tid=${tid}` : "",
    kind: inferKind(title),
    author,
    startedAt: floors[0]?.postedAt ?? "",
    floors,
  };
}

export function parseSpaceHtml(html: string): WatchThread[] {
  const threads: WatchThread[] = [];
  const seen = new Set<string>();
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = linkRe.exec(html);
  while (match) {
    const href = match[1].replace(/&amp;/g, "&");
    const tid =
      href.match(/ptid=(\d+)/i)?.[1] ??
      href.match(/tid=(\d+)/i)?.[1] ??
      href.match(/thread-(\d+)/)?.[1] ??
      "";
    const title = stripTags(match[2]);
    if (!tid || !title || title.length < 2) {
      match = linkRe.exec(html);
      continue;
    }
    if (/goto=lastpost|找回|引用|编辑/.test(href + title)) {
      match = linkRe.exec(html);
      continue;
    }
    if (seen.has(tid)) {
      match = linkRe.exec(html);
      continue;
    }
    seen.add(tid);
    threads.push({
      tid,
      title,
      url: `https://bbs.yhpes.com/forum.php?mod=viewthread&tid=${tid}`,
      kind: inferKind(title),
      author: WATCH_USER,
      startedAt: "",
      floors: [],
    });
    match = linkRe.exec(html);
  }
  return threads;
}

export function parseWatchPaste(text: string): WatchThread[] {
  const threads: WatchThread[] = [];
  let current: WatchThread | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(/^(?:tid[=:：]\s*)?(\d{2,6})\s+(.+)$/i);
    const floor = line.match(/^#(\d+)\s+(\S+)\s+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\d{0,2}:?\d{0,2})?\s*(.*)$/);
    if (header && !line.startsWith("#")) {
      current = {
        tid: header[1],
        title: header[2],
        url: `https://bbs.yhpes.com/forum.php?mod=viewthread&tid=${header[1]}`,
        kind: inferKind(header[2]),
        author: "",
        startedAt: "",
        floors: [],
      };
      threads.push(current);
      continue;
    }
    if (floor && current) {
      const author = floor[2];
      const content = floor[4] ?? "";
      current.floors.push({
        pid: `${current.tid}-${floor[1]}`,
        tid: current.tid,
        floor: Number(floor[1]),
        author,
        postedAt: (floor[3] ?? "").trim(),
        content,
        price: extractBid(content),
        isOp: Number(floor[1]) === 1,
        isWatchUser: isWatchUser(author),
      });
      if (!current.author) current.author = author;
      if (!current.startedAt) current.startedAt = (floor[3] ?? "").trim();
      continue;
    }
    if (!current) {
      current = {
        tid: `paste-${threads.length + 1}`,
        title: line,
        url: "",
        kind: inferKind(line),
        author: WATCH_USER,
        startedAt: "",
        floors: [],
      };
      threads.push(current);
    }
  }
  return threads;
}

export function ingestWatchHtml(html: string): WatchThread[] {
  if (/id="postmessage_\d+"/i.test(html)) {
    const thread = parseThreadHtml(html);
    return thread ? [thread] : [];
  }
  return parseSpaceHtml(html);
}

export function mergeWatchThreads(existing: WatchThread[], incoming: WatchThread[]): WatchThread[] {
  const map = new Map<string, WatchThread>();
  for (const thread of [...existing, ...incoming]) {
    const prev = map.get(thread.tid);
    if (!prev) {
      map.set(thread.tid, thread);
      continue;
    }
    const floors = new Map<string, WatchFloor>();
    for (const floor of [...prev.floors, ...thread.floors]) {
      floors.set(`${floor.pid}|${floor.floor}|${floor.author}|${floor.content}`, floor);
    }
    map.set(thread.tid, {
      ...prev,
      title: thread.title || prev.title,
      author: thread.author || prev.author,
      startedAt: thread.startedAt || prev.startedAt,
      kind: thread.kind !== "unknown" ? thread.kind : prev.kind,
      floors: [...floors.values()].sort((a, b) => a.floor - b.floor),
    });
  }
  return [...map.values()];
}

export function summarizeThread(thread: WatchThread) {
  const replies = thread.floors.filter((floor) => !floor.isOp);
  const last = thread.floors[thread.floors.length - 1];
  const lastBid = [...thread.floors].reverse().find((floor) => floor.price)?.price ?? "";
  const xfqReplied = replies.some((floor) => floor.isWatchUser);
  return {
    replyCount: replies.length,
    lastAuthor: last?.author ?? thread.author,
    lastAt: last?.postedAt ?? thread.startedAt,
    lastBid,
    xfqReplied,
    xfqIsOp: isWatchUser(thread.author),
  };
}

export function xfqStarted(threads: WatchThread[]): WatchThread[] {
  return threads.filter((thread) => isWatchUser(thread.author) || summarizeThread(thread).xfqIsOp);
}

export function xfqFollowUps(threads: WatchThread[]): WatchFloor[] {
  return threads.flatMap((thread) =>
    thread.floors
      .filter((floor) => floor.isWatchUser && !floor.isOp)
      .map((floor) => ({ ...floor, tid: thread.tid })),
  );
}
