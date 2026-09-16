export type PlayerStats = {
  进攻: number;
  防守: number;
  身体平衡: number;
  体能: number;
  极限速度: number;
  加速度: number;
  反应: number;
  敏捷性: number;
  盘带精度: number;
  盘带速度: number;
  短传精度: number;
  短传速度: number;
  长传精度: number;
  长传速度: number;
  射门精度: number;
  射门力量: number;
  射门技术: number;
  任意球精度: number;
  弧度: number;
  头球精度: number;
  弹跳: number;
  技术: number;
  进攻欲望: number;
  心理素质: number;
  守门技术: number;
  团队配合: number;
  状态持续: number;
  环境适应能力: number;
};

export const STAT_KEYS = [
  "进攻",
  "防守",
  "身体平衡",
  "体能",
  "极限速度",
  "加速度",
  "反应",
  "敏捷性",
  "盘带精度",
  "盘带速度",
  "短传精度",
  "短传速度",
  "长传精度",
  "长传速度",
  "射门精度",
  "射门力量",
  "射门技术",
  "任意球精度",
  "弧度",
  "头球精度",
  "弹跳",
  "技术",
  "进攻欲望",
  "心理素质",
  "守门技术",
  "团队配合",
  "状态持续",
  "环境适应能力",
] as const satisfies readonly (keyof PlayerStats)[];

export const STAT_GROUPS: { title: string; keys: (keyof PlayerStats)[] }[] = [
  { title: "攻防", keys: ["进攻", "防守", "进攻欲望", "心理素质", "团队配合", "守门技术"] },
  { title: "身体", keys: ["身体平衡", "体能", "极限速度", "加速度", "反应", "敏捷性", "弹跳"] },
  { title: "带传", keys: ["盘带精度", "盘带速度", "短传精度", "短传速度", "长传精度", "长传速度", "技术"] },
  { title: "射门", keys: ["射门精度", "射门力量", "射门技术", "任意球精度", "弧度", "头球精度"] },
  { title: "状态", keys: ["状态持续", "环境适应能力"] },
];

export const SKILL_KEYS = [
  "带球突破",
  "盘带控球",
  "门前感觉",
  "突前意识",
  "指挥官",
  "传球手",
  "射手天分",
  "擅长单刀",
  "柱式中锋",
  "反越位",
  "中距射门",
  "边路好手",
  "中路猛将",
  "点球专家",
  "一脚传球",
  "外脚背",
  "贴身紧逼",
  "铲断高手",
  "掩护补位",
  "后防统帅",
  "扑救点球",
  "化解单刀",
  "大力手抛球",
] as const;

export type Player = {
  id: string;
  chineseName: string;
  englishName: string;
  nation: string;
  registeredPosition: string;
  level: string;
  isStar: boolean;
  club: string;
  contract: string;
  nature: string;
  eaId: string;
  updatedAt: string;
  overall: number;
  potential: number;
  friendlyScore: number;
  age: number;
  height: number;
  weight: number;
  foot: string;
  positionGrade: string;
  weakFootAcc: number;
  weakFootFreq: number;
  allPositions: string[];
  injury: string;
  skillCount: number;
  stats: PlayerStats;
  skills: string[];
  unauthorized: boolean;
  marketPosts: {
    kind: "listing" | "renewal" | "release" | "unknown";
    title: string;
    url: string;
    author: string;
    postedAt: string;
    price: string;
    years: string;
    tid: string;
  }[];
};

export type PlayerDatabase = {
  sourceFile: string;
  players: Player[];
  unauthorizedIds: string[];
};

export type PlayerFilters = {
  query: string;
  position: string;
  level: string;
  club: string;
  nation: string;
  starsOnly: boolean;
  freeAgentsOnly: boolean;
  unauthorizedOnly: boolean;
  market: "" | "listing" | "renewal" | "release" | "onMarket";
};

export const EMPTY_FILTERS: PlayerFilters = {
  query: "",
  position: "",
  level: "",
  club: "",
  nation: "",
  starsOnly: false,
  freeAgentsOnly: false,
  unauthorizedOnly: false,
  market: "",
};

export type SortKey = "friendlyScore" | "overall" | "potential" | "age" | "chineseName";

function headerKey(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "");
}

function text(row: unknown[], index: number | undefined): string {
  if (index == null || index < 0) return "";
  return String(row[index] ?? "").trim();
}

function num(row: unknown[], index: number | undefined): number {
  const raw = text(row, index).replace(/,/g, "");
  if (!raw) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function flagOn(value: string): boolean {
  return value === "1" || value.toLowerCase() === "true" || value === "是";
}

export function buildHeaderIndex(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const key = headerKey(cell);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function col(index: Map<string, number>, ...names: string[]): number {
  for (const name of names) {
    const hit = index.get(headerKey(name));
    if (hit != null) return hit;
  }
  return -1;
}

export function parsePlayerDatabase(
  sheets: { name: string; rows: unknown[][] }[],
  sourceFile: string,
): PlayerDatabase {
  const playerSheet = sheets.find((sheet) => sheet.name === "球员库");
  if (!playerSheet || playerSheet.rows.length < 2) {
    throw new Error("未找到「球员库」工作表，请上传 121届友好联赛数据库");
  }

  const unauthorizedSheet = sheets.find((sheet) => sheet.name.includes("无授权"));
  const unauthorizedIds = new Set<string>();
  if (unauthorizedSheet && unauthorizedSheet.rows.length > 1) {
    const header = buildHeaderIndex(unauthorizedSheet.rows[0]);
    const idIndex = col(header, "球员ID");
    for (const row of unauthorizedSheet.rows.slice(1)) {
      const id = text(row, idIndex);
      if (id) unauthorizedIds.add(id);
    }
  }

  const header = buildHeaderIndex(playerSheet.rows[0]);
  const required = col(header, "球员ID");
  if (required < 0) {
    throw new Error("球员库缺少「球员ID」列");
  }

  const indexes = {
    id: col(header, "球员ID"),
    chineseName: col(header, "中文"),
    englishName: col(header, "英文"),
    nation: col(header, "国籍"),
    registeredPosition: col(header, "注册位置"),
    level: col(header, "等级"),
    star: col(header, "球星"),
    club: col(header, "俱乐部"),
    contract: col(header, "合同期"),
    nature: col(header, "球员性质"),
    eaId: col(header, "EAFCID"),
    updatedAt: col(header, "最新数据日期"),
    overall: col(header, "能力"),
    potential: col(header, "潜力"),
    friendlyScore: col(header, "友好评分"),
    age: col(header, "年龄"),
    height: col(header, "身高"),
    weight: col(header, "体重"),
    foot: col(header, "惯用脚"),
    positionGrade: col(header, "位置"),
    weakFootAcc: col(header, "逆足精度"),
    weakFootFreq: col(header, "逆足频度"),
    allPositions: col(header, "全部位置"),
    injury: col(header, "受伤耐性"),
    skillCount: col(header, "特技"),
  };

  const statIndex = Object.fromEntries(
    STAT_KEYS.map((key) => [key, col(header, key)]),
  ) as Record<keyof PlayerStats, number>;
  const skillIndex = Object.fromEntries(
    SKILL_KEYS.map((key) => [key, col(header, key)]),
  ) as Record<(typeof SKILL_KEYS)[number], number>;

  const players: Player[] = [];
  for (const row of playerSheet.rows.slice(1)) {
    const id = text(row, indexes.id);
    const chineseName = text(row, indexes.chineseName);
    if (!id && !chineseName) continue;

    const stats = Object.fromEntries(
      STAT_KEYS.map((key) => [key, num(row, statIndex[key])]),
    ) as PlayerStats;
    const skills = SKILL_KEYS.filter((key) => flagOn(text(row, skillIndex[key])));
    const club = text(row, indexes.club);
    const contract = text(row, indexes.contract);
    const starValue = text(row, indexes.star);
    const level = text(row, indexes.level);

    players.push({
      id,
      chineseName,
      englishName: text(row, indexes.englishName),
      nation: text(row, indexes.nation),
      registeredPosition: text(row, indexes.registeredPosition),
      level,
      isStar: starValue === "球星" || level === "球星",
      club,
      contract,
      nature: text(row, indexes.nature),
      eaId: text(row, indexes.eaId),
      updatedAt: text(row, indexes.updatedAt),
      overall: num(row, indexes.overall),
      potential: num(row, indexes.potential),
      friendlyScore: num(row, indexes.friendlyScore),
      age: num(row, indexes.age),
      height: num(row, indexes.height),
      weight: num(row, indexes.weight),
      foot: text(row, indexes.foot),
      positionGrade: text(row, indexes.positionGrade),
      weakFootAcc: num(row, indexes.weakFootAcc),
      weakFootFreq: num(row, indexes.weakFootFreq),
      allPositions: text(row, indexes.allPositions)
        .split(/[;；,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
      injury: text(row, indexes.injury),
      skillCount: num(row, indexes.skillCount) || skills.length,
      stats,
      skills,
      unauthorized: unauthorizedIds.has(id),
      marketPosts: [],
    });
  }

  return {
    sourceFile,
    players,
    unauthorizedIds: [...unauthorizedIds],
  };
}

export function isFreeAgent(player: Player): boolean {
  return !player.club || player.contract.includes("自由");
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function filterPlayers(
  players: Player[],
  filters: PlayerFilters,
  sortKey: SortKey,
): Player[] {
  const query = filters.query.trim().toLowerCase();
  const filtered = players.filter((player) => {
    if (filters.position && player.registeredPosition !== filters.position) return false;
    if (filters.level && player.level !== filters.level) return false;
    if (filters.club && player.club !== filters.club) return false;
    if (filters.nation && player.nation !== filters.nation) return false;
    if (filters.starsOnly && !player.isStar) return false;
    if (filters.freeAgentsOnly && !isFreeAgent(player)) return false;
    if (filters.unauthorizedOnly && !player.unauthorized) return false;
    if (filters.market) {
      const posts = player.marketPosts ?? [];
      if (filters.market === "onMarket") {
        if (!posts.some((post) => post.kind === "listing" || post.kind === "renewal")) return false;
      } else if (!posts.some((post) => post.kind === filters.market)) {
        return false;
      }
    }
    if (!query) return true;
    return (
      player.chineseName.toLowerCase().includes(query) ||
      player.englishName.toLowerCase().includes(query) ||
      player.id.includes(query) ||
      player.club.toLowerCase().includes(query) ||
      player.eaId.includes(query)
    );
  });

  const dir = sortKey === "chineseName" ? 1 : -1;
  filtered.sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    if (typeof left === "string" && typeof right === "string") {
      return dir * left.localeCompare(right, "zh-CN");
    }
    return dir * (Number(left) - Number(right));
  });
  return filtered;
}
