import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { YHPES_BOARDS, parseMarketHtml, type MarketFile, type MarketPost } from "../src/market.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "market.json");
const BASES = ["https://bbs.yhpes.com"];

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(4000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; yhpes-market-reader/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

async function scrapeBoard(fid: number, kind: MarketPost["kind"], name: string): Promise<MarketPost[]> {
  const paths = [
    `/forum.php?mod=forumdisplay&fid=${fid}`,
    `/archiver/?fid-${fid}.html`,
  ];
  const errors: string[] = [];
  for (const base of BASES) {
    for (const path of paths) {
      const url = `${base}${path}`;
      try {
        const html = await fetchText(url);
        const posts = parseMarketHtml(html, { kind, board: name });
        if (posts.length) return posts;
        errors.push(`${url} 打开成功但没有帖子`);
      } catch (error) {
        errors.push(`${url} ${(error as Error).message}`);
      }
    }
  }
  throw new Error(errors.slice(0, 3).join("；"));
}

const posts: MarketPost[] = [];
const failures: string[] = [];
let unreachable = false;
for (const board of YHPES_BOARDS) {
  if (unreachable) {
    failures.push(`${board.name}: 站点不可达，已跳过`);
    continue;
  }
  try {
    posts.push(...(await scrapeBoard(board.fid, board.kind, board.name)));
  } catch (error) {
    const message = (error as Error).message;
    failures.push(`${board.name}: ${message}`);
    if (/timeout|aborted|Timeout/i.test(message)) unreachable = true;
  }
}

const unique = new Map<string, MarketPost>();
for (const post of posts) unique.set(`${post.tid}|${post.title}`, post);

const result: MarketFile = {
  source: "bbs.yhpes.com",
  fetchedAt: new Date().toISOString(),
  ok: unique.size > 0,
  error: unique.size
    ? ""
    : `当前环境访问不到 bbs.yhpes.com 挂牌/续约帖。${failures[0] ?? ""} 请把论坛页面另存为 HTML，或把标题粘贴到网页里导入。`,
  posts: [...unique.values()],
};

writeFileSync(output, JSON.stringify(result, null, 2));
console.log(result.ok ? `wrote ${unique.size} posts` : `wrote empty market.json: ${result.error}`);
