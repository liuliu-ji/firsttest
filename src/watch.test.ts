import { describe, expect, it } from "vitest";
import {
  WATCH_USER,
  extractBid,
  ingestWatchHtml,
  isWatchUser,
  mergeWatchThreads,
  parseThreadHtml,
  parseWatchPaste,
  summarizeThread,
  xfqFollowUps,
  xfqStarted,
} from "./watch";

const threadHtml = `
<span id="thread_subject">【挂牌】xfq-伯恩利 伯卡特 227 底价12M</span>
<input type="hidden" name="tid" value="88" />
<div class="authi"><a href="space-username-xfq.html" class="xw1">xfq</a></div>
<em id="authorposton1">发表于 2026-5-12 10:00</em>
<td class="t_f" id="postmessage_11">底价 12M，合同剩余1赛季</td>
<div class="authi"><a href="space-username-andy.html" class="xw1">ANDY</a></div>
<em id="authorposton2">发表于 2026-5-12 11:00</em>
<td class="t_f" id="postmessage_22">出价 13M</td>
<div class="authi"><a href="space-username-xfq.html" class="xw1">xfq</a></div>
<em id="authorposton3">发表于 2026-5-12 12:00</em>
<td class="t_f" id="postmessage_33">收到，再看看</td>
`;

describe("watch parsers", () => {
  it("identifies the xfq username", () => {
    expect(isWatchUser("xfq")).toBe(true);
    expect(isWatchUser("XFQ")).toBe(true);
    expect(isWatchUser("ANDY")).toBe(false);
    expect(WATCH_USER).toBe("xfq");
  });

  it("parses a Discuz thread with XFQ post and follow-ups", () => {
    const thread = parseThreadHtml(threadHtml);
    expect(thread?.tid).toBe("88");
    expect(thread?.author).toBe("xfq");
    expect(thread?.floors).toHaveLength(3);
    expect(thread?.floors[0].isOp).toBe(true);
    expect(thread?.floors[0].isWatchUser).toBe(true);
    expect(thread?.floors[1].author).toBe("ANDY");
    expect(thread?.floors[1].price).toContain("13");
    expect(thread?.floors[2].isWatchUser).toBe(true);
    expect(thread?.floors[2].isOp).toBe(false);
  });

  it("summarizes bids and XFQ follow-ups", () => {
    const thread = parseThreadHtml(threadHtml)!;
    const summary = summarizeThread(thread);
    expect(summary.replyCount).toBe(2);
    expect(summary.lastBid).toContain("13");
    expect(summary.xfqReplied).toBe(true);
    expect(xfqStarted([thread])).toHaveLength(1);
    expect(xfqFollowUps([thread]).map((floor) => floor.author)).toEqual(["xfq"]);
  });

  it("parses pasted watch logs", () => {
    const threads = parseWatchPaste(`88 【挂牌】伯卡特 227
#1 xfq 2026-05-12 10:00 底价12M
#2 ANDY 2026-05-12 11:00 出价13M
#3 xfq 2026-05-12 12:00 跟帖确认`);
    expect(threads[0].author).toBe("xfq");
    expect(threads[0].floors[1].price).toContain("13");
    expect(extractBid("出价 15M")).toContain("15");
  });

  it("merges later replies into the same thread", () => {
    const first = ingestWatchHtml(threadHtml);
    const extra = parseWatchPaste(`88 【挂牌】伯卡特 227
#4 MU 2026-05-12 13:00 出价14M`);
    const merged = mergeWatchThreads(first, extra);
    expect(merged).toHaveLength(1);
    expect(merged[0].floors).toHaveLength(4);
  });
});
