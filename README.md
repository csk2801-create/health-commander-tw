# Health Commander V1

繁體中文、手機優先、可安裝到手機桌面的健康紀錄 PWA。V1 完全免費，不使用付費 API，資料預設只存在使用者自己的瀏覽器本機。

## 功能

- 每日早上體重、晚上體重、腰圍、飲水、精神、膝蓋狀況、備註
- 早餐、午餐、晚餐拍照與相簿上傳
- 睡眠截圖與運動截圖上傳
- 本機資料持久化：文字資料使用 `localStorage`，圖片使用 `IndexedDB`
- 每日紀錄可編輯與刪除
- 7 日與 30 日趨勢圖
- 每日摘要產生與一鍵複製
- JSON 備份匯出與匯入，包含圖片資料
- 同步碼雲端紀錄文字資料：體重、腰圍、飲水、精神、膝蓋、備註與趨勢資料
- PWA manifest 與 service worker，可安裝到手機桌面並支援基本離線開啟
- Apple Health 自動同步欄位已預留，但 V1 不會讀取 HealthKit 或要求健康權限

## 使用

```bash
npm install
npm run dev
```

## 驗證

```bash
npm run test
npm run build
npm run test:e2e
```

## 限制

- Apple Health 自動同步不在 V1 範圍內；需要原生 iOS App 與 HealthKit 權限。
- 同一瀏覽器/裝置內資料會保留；換手機或清除瀏覽器資料前請先匯出備份。
- 拍照按鈕依賴手機瀏覽器支援 `capture="environment"`；桌面瀏覽器會退回一般檔案選擇器。
- 雲端紀錄目前同步文字資料，不同步照片；照片請用完整備份檔轉移。
