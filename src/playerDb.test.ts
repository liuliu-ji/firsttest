import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "./excel";
import { filterPlayers, parsePlayerDatabase } from "./playerDb";

function workbookSheets(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
  return parseWorkbook(buffer, "test.xlsx", buffer.byteLength).sheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rows,
  }));
}

const headers = [
  "国籍",
  "注册\n位置",
  "球员\nID",
  "中文",
  "等级",
  "球星",
  "俱乐部",
  "合同期",
  "球员性质",
  "EA FCID",
  "能力",
  "潜力",
  "英文",
  "友好评分",
  "年龄",
  "惯用脚",
  "全部位置",
  "进攻",
  "防守",
  "门前感觉",
  "射手天分",
];

describe("parsePlayerDatabase", () => {
  it("maps 球员库 rows and unauthorized ids", () => {
    const sheets = workbookSheets({
      球员库: [
        headers,
        [
          "挪威",
          "中锋",
          "3853",
          "哈兰德",
          "球星",
          "球星",
          "小兵-纽卡斯尔联",
          "剩余1赛季",
          "现役球员",
          "239085",
          "91",
          "93",
          "Erling Haaland",
          "101.1",
          "25",
          "左脚",
          "CF",
          "97",
          "45",
          "1",
          "1",
        ],
        [
          "阿根廷",
          "前腰",
          "1033",
          "梅西",
          "2等",
          "球员",
          "",
          "自由",
          "现役球员",
          "158023",
          "86",
          "86",
          "Lionel Messi",
          "92.2",
          "38",
          "左脚",
          "AMF;CF",
          "86",
          "48",
          "0",
          "1",
        ],
      ],
      "无授权球员表": [
        ["球员\nID", "中文"],
        ["1033", "梅西"],
      ],
    });

    const db = parsePlayerDatabase(sheets, "test.xlsx");
    expect(db.players).toHaveLength(2);
    expect(db.players[0].chineseName).toBe("哈兰德");
    expect(db.players[0].isStar).toBe(true);
    expect(db.players[0].stats.进攻).toBe(97);
    expect(db.players[0].skills).toEqual(["门前感觉", "射手天分"]);
    expect(db.players[1].unauthorized).toBe(true);
    expect(db.unauthorizedIds).toEqual(["1033"]);
  });

  it("filters by query, position and free agents", () => {
    const sheets = workbookSheets({
      球员库: [
        headers,
        ["挪威", "中锋", "1", "哈兰德", "球星", "球星", "纽卡", "1", "", "", "91", "93", "Haaland", "101", "25", "左脚", "CF", "97", "45", "1", "1"],
        ["阿根廷", "前腰", "2", "梅西", "2等", "球员", "", "自由", "", "", "86", "86", "Messi", "92", "38", "左脚", "AMF", "86", "48", "0", "1"],
      ],
    });
    const { players } = parsePlayerDatabase(sheets, "test.xlsx");
    expect(
      filterPlayers(players, {
        query: "messi",
        position: "",
        level: "",
        club: "",
        nation: "",
        starsOnly: false,
        freeAgentsOnly: false,
        unauthorizedOnly: false,
        market: "",
      }, "friendlyScore").map((p) => p.chineseName),
    ).toEqual(["梅西"]);
    expect(
      filterPlayers(players, {
        query: "",
        position: "中锋",
        level: "",
        club: "",
        nation: "",
        starsOnly: false,
        freeAgentsOnly: false,
        unauthorizedOnly: false,
        market: "",
      }, "overall").map((p) => p.chineseName),
    ).toEqual(["哈兰德"]);
    expect(
      filterPlayers(players, {
        query: "",
        position: "",
        level: "",
        club: "",
        nation: "",
        starsOnly: false,
        freeAgentsOnly: true,
        unauthorizedOnly: false,
        market: "",
      }, "chineseName").map((p) => p.chineseName),
    ).toEqual(["梅西"]);
  });
});
