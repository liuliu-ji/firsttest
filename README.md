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

打开终端提示的本地地址即可浏览。页面支持更换新的 Excel 数据库。

```bash
npm test
npm run build
```
