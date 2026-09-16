import { describe, expect, it } from "vitest";
import {
  matchPostsToPlayers,
  parseListingFields,
  parseMarketHtml,
  parseMarketText,
} from "./market";

const catalog = {
  ids: new Set(["3853", "1033"]),
  names: ["劳塔罗.马丁内斯", "哈兰德", "梅西"],
  clubs: ["小兵-纽卡斯尔联", "king-桑德兰"],
};

describe("parseListingFields", () => {
  it("extracts id, name, club and price from a listing title", () => {
    const fields = parseListingFields(
      "【挂牌】小兵-纽卡斯尔联 哈兰德 3853 底价20M",
      catalog,
    );
    expect(fields.playerId).toBe("3853");
    expect(fields.playerName).toBe("哈兰德");
    expect(fields.club).toBe("小兵-纽卡斯尔联");
    expect(fields.price).toContain("20");
  });
});

describe("parseMarketHtml", () => {
  it("reads Discuz thread titles from 挂牌区", () => {
    const html = `
      <tbody id="normalthread_88">
        <tr>
          <th>
            <a href="forum.php?mod=viewthread&amp;tid=88" class="s xst">【挂牌】小兵-纽卡斯尔联 哈兰德 3853 底价20M</a>
          </th>
        </tr>
      </tbody>
      <li><a href="?tid-91.html">续约 梅西 1033 1年</a></li>
    `;
    const posts = parseMarketHtml(html, { kind: "listing", board: "挂牌区", catalog });
    expect(posts.some((post) => post.tid === "88" && post.kind === "listing")).toBe(true);
    expect(posts.some((post) => post.tid === "91" && post.kind === "renewal")).toBe(true);
  });
});

describe("parseMarketText and match", () => {
  it("matches pasted titles to players", () => {
    const posts = parseMarketText(
      "挂牌 哈兰德 3853 底价15\n续约 梅西 1年",
      { catalog },
    );
    const players = [
      { id: "3853", chineseName: "哈兰德", club: "小兵-纽卡斯尔联" },
      { id: "1033", chineseName: "梅西", club: "king-桑德兰" },
    ];
    const matched = matchPostsToPlayers(posts, players);
    expect(matched.byPlayerId.get("3853")?.[0].kind).toBe("listing");
    expect(matched.byPlayerId.get("1033")?.[0].kind).toBe("renewal");
  });
});
