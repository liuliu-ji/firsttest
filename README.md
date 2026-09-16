# 121届友好联赛球员库

读取仓库中的《121届友好联赛数据库（核对版）》Excel，在浏览器里搜索、筛选并查看球员能力和特技。

## 数据

- `data/121届友好联赛数据库(核对版).xlsx`：完整球员库（球员库约 3821 人，另含位置分表和无授权表）
- `data/pes6 状态影响与能力解析.docx`：PES6 状态 / 特技说明
- `public/players.json`：给网页用的解析结果

## 本地运行

```bash
npm install
npm run generate:players
npm run dev
```

导入 bbs.yhpes.com 挂牌区（fid=39）和续约区（fid=38）后，可按「仅挂牌 / 仅续约」筛选。

## XFQ 监盘

页面默认打开 **XFQ 监盘**：跟踪 `xfq` 发帖、跟帖，以及别人在他帖下的出价，并对照 `xfq-伯恩利` 22 人阵容。

当前云环境通常连不上该论坛。把 XFQ 的主题/回复页或整帖另存为 HTML 上传，或粘贴：

```
88 【挂牌】伯卡特 227 底价12M
#1 xfq 2026-05-12 10:00 底价12M
#2 ANDY 2026-05-12 11:00 出价13M
#3 xfq 2026-05-12 12:00 收到
```

```bash
npm run scrape:yhpes
npm run dev
```

```bash
npm test
npm run build
```
