# Excel 表格读取

支持在浏览器中 **上传并读取 Excel 表格**（`.xlsx` / `.xls` / `.xlsm` / `.csv` / `.ods`），解析全部工作表后在线预览。

## 功能

- 点击选择或拖拽上传表格文件
- 读取多工作表，底部标签切换
- 按 Excel 样式展示列标（A、B、C…）和行号
- 大表仅预览前 1000 行，并显示真实总行数
- 单文件上限 20MB

## 本地运行

```bash
npm install
npm run generate:sample
npm run dev
```

打开终端提示的本地地址，上传 `public/sample.xlsx` 或任意 Excel 文件即可预览。

```bash
npm test
npm run build
```
