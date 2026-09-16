export type MarketKind = "listing" | "renewal" | "release" | "unknown";

export type MarketPost = {
  kind: MarketKind;
  title: string;
  tid: string;
  url: string;
  author: string;
  postedAt: string;
  playerId: string;
  playerName: string;
  club: string;
  price: string;
  years: string;
  board: string;
};

export type MarketFile = {
  source: string;
  fetchedAt: string;
  ok: boolean;
  error: string;
  posts: MarketPost[];
};

export const YHPES_BOARDS: { fid: number; kind: MarketKind; name: string }[] = [
  { fid: 39, kind: "listing", name: "挂牌区" },
  { fid: 38, kind: "renewal", name: "续约区" },
  { fid: 37, kind: "release", name: "解约区" },
];

type Catalog = {
  ids: Set<string>;
  names: string[];
  clubs: string[];
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function inferKind(title: string, fallback: MarketKind = "unknown"): MarketKind {
  if (/续约/.test(title)) return "renewal";
  if (/解约|买断|解聘/.test(title)) return "release";
  if (/挂牌|出售|转会|底价|流拍/.test(title)) return "listing";
  return fallback;
}

function pickLongest(haystack: string, needles: string[]): string {
  let best = "";
  for (const needle of needles) {
    if (needle && haystack.includes(needle) && needle.length > best.length) {
      best = needle;
    }
  }
  return best;
}

export function parseListingFields(
  title: string,
  catalog?: Catalog,
): Pick<MarketPost, "playerId" | "playerName" | "club" | "price" | "years"> {
  const playerId = catalog
    ? (title.match(/\d{2,6}/g) ?? []).find((id) => catalog.ids.has(id)) ?? ""
    : (title.match(/(?:ID|id|uid|UID)[:：\s]*(\d{2,6})/)?.[1] ?? "");
  const playerName = catalog ? pickLongest(title, catalog.names) : "";
  const club = catalog ? pickLongest(title, catalog.clubs) : "";
  const price =
    title.match(/(?:底价|解约金|价格|报价)[:：\s]*(\d+(?:\.\d+)?)\s*(M|m|万)?/)?.[0] ??
    title.match(/(\d+(?:\.\d+)?)\s*(M|万)(?!\d)/)?.[0] ??
    "";
  const years = title.match(/续约\s*(\d+)\s*年/)?.[0] ?? title.match(/(\d+)\s*年/)?.[0] ?? "";
  return { playerId, playerName, club, price, years };
}

function threadUrl(href: string): { tid: string; url: string } {
  const tid = href.match(/tid[=-]?(\d+)/i)?.[1] ?? href.match(/thread-(\d+)/)?.[1] ?? "";
  const absolute = href.startsWith("http")
    ? href
    : `https://bbs.yhpes.com/${href.replace(/^\.\//, "").replace(/^\/?/, "")}`;
  return { tid, url: absolute.replace(/&amp;/g, "&") };
}

function buildPost(
  title: string,
  href: string,
  kind: MarketKind,
  board: string,
  extra: Partial<MarketPost> = {},
  catalog?: Catalog,
): MarketPost | null {
  const cleaned = stripTags(title);
  if (!cleaned || cleaned.length < 2) return null;
  if (/^(最后回复|new|精华|置顶|发表于)$/i.test(cleaned)) return null;
  const { tid, url } = threadUrl(href);
  if (!tid && !cleaned) return null;
  const fields = parseListingFields(cleaned, catalog);
  return {
    kind: inferKind(cleaned, kind),
    title: cleaned,
    tid,
    url: tid ? `https://bbs.yhpes.com/forum.php?mod=viewthread&tid=${tid}` : url,
    author: extra.author ?? "",
    postedAt: extra.postedAt ?? "",
    board,
    ...fields,
  };
}

export function parseMarketHtml(
  html: string,
  options: { kind?: MarketKind; board?: string; catalog?: Catalog } = {},
): MarketPost[] {
  const kind = options.kind ?? "unknown";
  const board = options.board ?? "";
  const posts: MarketPost[] = [];
  const seen = new Set<string>();

  const xst = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*xst[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const archiver = /<a[^>]*href="([^"]*tid[-_=]\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const viewthread = /<a[^>]*href="([^"]*(?:mod=viewthread&amp;tid=|thread-)\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const regex of [xst, archiver, viewthread]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(html);
    while (match) {
      const href = decodeEntities(match[1]);
      if (/goto=lastpost|lastpost#/i.test(href)) {
        match = regex.exec(html);
        continue;
      }
      const post = buildPost(match[2], href, kind, board, {}, options.catalog);
      const key = `${post?.tid}|${post?.title}`;
      if (post && !seen.has(key)) {
        seen.add(key);
        posts.push(post);
      }
      match = regex.exec(html);
    }
  }
  return posts;
}

export function parseMarketText(
  text: string,
  options: { kind?: MarketKind; board?: string; catalog?: Catalog } = {},
): MarketPost[] {
  const kind = options.kind ?? "unknown";
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) =>
      buildPost(line, `https://bbs.yhpes.com/#pasted-${index}`, kind, options.board ?? "粘贴", {}, options.catalog),
    )
    .filter((post): post is MarketPost => Boolean(post));
}

export function buildCatalog(
  players: { id: string; chineseName: string; club: string }[],
): Catalog {
  return {
    ids: new Set(players.map((player) => player.id).filter(Boolean)),
    names: [...new Set(players.map((player) => player.chineseName).filter((name) => name.length >= 2))]
      .sort((a, b) => b.length - a.length),
    clubs: [...new Set(players.map((player) => player.club).filter((club) => club.length >= 2))]
      .sort((a, b) => b.length - a.length),
  };
}

export function matchPostsToPlayers<T extends { id: string; chineseName: string; club: string }>(
  posts: MarketPost[],
  players: T[],
): { posts: MarketPost[]; byPlayerId: Map<string, MarketPost[]> } {
  const catalog = buildCatalog(players);
  const enriched = posts.map((post) => {
    const fields = parseListingFields(post.title, catalog);
    return {
      ...post,
      playerId: post.playerId || fields.playerId,
      playerName: post.playerName || fields.playerName,
      club: post.club || fields.club,
      price: post.price || fields.price,
      years: post.years || fields.years,
    };
  });

  const byName = new Map<string, T[]>();
  for (const player of players) {
    const list = byName.get(player.chineseName) ?? [];
    list.push(player);
    byName.set(player.chineseName, list);
  }

  const byPlayerId = new Map<string, MarketPost[]>();
  for (const post of enriched) {
    let id = post.playerId;
    if (!id && post.playerName) {
      const hits = byName.get(post.playerName) ?? [];
      const clubHit = post.club ? hits.filter((player) => player.club === post.club) : hits;
      if (clubHit.length === 1) id = clubHit[0].id;
      else if (hits.length === 1) id = hits[0].id;
    }
    post.playerId = id;
    if (!id) continue;
    const list = byPlayerId.get(id) ?? [];
    list.push(post);
    byPlayerId.set(id, list);
  }
  return { posts: enriched, byPlayerId };
}

export function attachMarketToPlayers<T extends { id: string; chineseName: string; club: string }>(
  players: T[],
  posts: MarketPost[],
): (T & { marketPosts: MarketPost[] })[] {
  const { byPlayerId, posts: enriched } = matchPostsToPlayers(posts, players);
  void enriched;
  return players.map((player) => ({
    ...player,
    marketPosts: byPlayerId.get(player.id) ?? [],
  }));
}

export const KIND_LABEL: Record<MarketKind, string> = {
  listing: "挂牌",
  renewal: "续约",
  release: "解约",
  unknown: "论坛",
};
