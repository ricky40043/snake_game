## 最後一次修改（2026-05-02）

### 改了什麼
- 將教學頁底下的示範從靜態格子動畫改成 canvas 小型實戰動畫
- 攻擊教學會演出射手扣自己 1 格、子彈飛出、命中對手、對手扣 3 格後死亡並變成屍體
- 碰牆教學會演出蛇移動撞牆，依本局設定顯示死亡變屍體或轉向
- 屍體、復活、吃食物、移動、加速等教學也改成會持續跑動的迷你遊戲劇本

### 為什麼改
- 使用者希望教學不是文字或閃爍提示，而是每個規則都有實際跑動的示範動畫，玩家能看懂「發生了什麼」

### 影響的檔案
- `frontend/src/pages/Game.jsx` — 新增 TutorialDemoCanvas，逐頁教學改用 canvas 實戰動畫
- `LAST_CHANGES.md` — 記錄本次教學動畫強化

## 最後一次修改（2026-05-02）

### 改了什麼
- 新增 `dev.sh` 本機開發啟動腳本，可用 `start|stop|restart|status|logs` 管理前後端
- `dev.sh start` 會先停止腳本記錄的舊前後端服務，並清掉佔用 3001/5173/5174 的 node/npm/vite 開發程序，再直接用 npm 啟動 backend 與 frontend
- 移除 Docker / docker compose 停止邏輯，避免測試啟動腳本動到其他 Docker 服務
- `.gitignore` 忽略啟動腳本產生的 `.dev-pids/` 與 `.dev-logs/`

### 為什麼改
- 使用者希望直接用本機 npm 啟動測試，不透過 Docker，也不希望腳本停止其他 Docker 服務

### 影響的檔案
- `dev.sh` — 新增本機前後端啟動、停止、重啟、狀態與 log 查詢腳本
- `.gitignore` — 忽略本機啟動腳本產生的暫存目錄
- `LAST_CHANGES.md` — 記錄本次腳本調整

## 最後一次修改（2026-05-02）

### 改了什麼
- 將子彈命中傷害從扣 5 格尾巴改成扣 3 格尾巴，太短的蛇仍會直接死亡以避免低於最小長度
- 修正計時模式攻擊設定滑桿：改為依照本局遊戲時間調整，最左邊代表完全不啟用，最右邊代表全時間啟用
- 新增「啟用教學試玩」設定；勾選後開始遊戲會先進入全員同步的逐頁規則教學，房主按下一步才會切換到下一個規則
- 教學內容拆成 8 個步驟，每步底下都有對應動畫示範，依照本局模式與勾選設定介紹顏色、長度血量、分數、移動、攻擊代價、命中傷害、屍體 10 秒、計時復活 10 秒、復活 5 秒無敵、碰牆與加速規則
- 修正復活後方向鍵偶爾無反應：移除前端 `lastDirRef` 的重複方向擋送邏輯，改由後端方向規則判斷，避免死亡/預覽期殘留方向吃掉復活後第一個按鍵

### 為什麼改
- 使用者需求調整攻擊傷害與攻擊啟用時間語意，並希望遊戲開始前能依模式用主持人控頁的動畫教學完整導覽規則
- 原本前端用最後送出的方向做節流，玩家死亡或復活預覽期間按過方向後，復活時同方向輸入可能被前端直接忽略，造成看起來像鍵盤沒反應

### 影響的檔案
- `backend/src/config.js` — 新增 tutorialEnabled 預設設定
- `backend/src/services/roomService.js` — 房間設定初始化加入 tutorialEnabled
- `backend/src/services/gameService.js` — 子彈扣血改為 3 格，新增教學頁碼狀態與教學完成後才啟動倒數
- `backend/src/sockets/gameHandlers.js` — 新增房主完成教學、上一頁、下一頁事件
- `backend/src/sockets/roomHandlers.js` — 同步教學狀態與頁碼，設定更新支援 tutorialEnabled，攻擊時間上限支援到 10 分鐘
- `frontend/src/hooks/useGameState.js` — 前端狀態加入教學啟用、教學中狀態與同步頁碼
- `frontend/src/pages/Lobby.jsx` — 新增教學勾選，修正計時模式攻擊滑桿語意與顯示
- `frontend/src/pages/Game.jsx` — 新增逐頁動畫教學覆蓋層，移除造成復活方向鍵失效的前端方向節流

## 最後一次修改（2026-04-26）

### 改了什麼
- 修正加速模式扣血邏輯：蛇的長度本身就是生命，改為每 2 秒移除尾巴一節，長度 ≤ 3 格時自動關閉加速
- 移除獨立 HP 系統（hp/maxHp 欄位）、頂部欄 HP 顯示、「加速耗盡死亡」提示訊息

### 為什麼改
- 原本錯誤地設計了獨立 HP 計數器，但正確邏輯是蛇長就是生命值，縮短才是代價

### 影響的檔案
- `backend/src/services/gameService.js` — Phase 1.5 改為 body.pop() 扣尾巴，移除 hp/maxHp 欄位
- `backend/src/sockets/gameHandlers.js` — toggle_boost 蛇長 ≤ 3 不可啟動
- `backend/src/sockets/roomHandlers.js` — game_started 同步移除 hp/maxHp
- `frontend/src/pages/Game.jsx` — 移除 HP 顯示與 boost_exhausted 死亡訊息

## 最後一次修改（2026-04-26）

### 改了什麼
- 新增加速模式（Boost）：開啟時蛇每個 tick 移動兩格（速度翻倍），每 2 秒扣 1 HP（初始 HP 10），HP 歸零即死
- 大廳進階設定新增「🚀 加速模式」開關，樣式與攻擊模式開關一致
- 遊戲中 E 鍵（桌機）或 🚀 按鈕（手機，位於 ⚡ 上方）切換加速開/關
- 頂部欄在加速模式啟用時顯示 HP 數字（HP ≤ 3 時紅字閃爍）
- 加速中的蛇頭顯示黃色脈衝光暈（對應藍色無敵光暈的設計）
- HP 耗盡死亡時顯示「💨 加速耗盡，你死了」提示訊息

### 為什麼改
- 使用者需求：加速功能開啟後速度翻倍但消耗 HP，增加策略深度

### 影響的檔案
- `backend/src/config.js` — 新增 boostEnabled 預設值（false）
- `backend/src/services/roomService.js` — settings 初始化加入 boostEnabled
- `backend/src/services/gameService.js` — Phase 1.5 boost 額外移動、HP 扣血、respawnPlayer 重置 HP、resumeGame 重置計時、game_started/tick 傳遞 boost 欄位
- `backend/src/sockets/gameHandlers.js` — 新增 toggle_boost 事件處理
- `backend/src/sockets/roomHandlers.js` — update_settings 支援 boostEnabled、game_started 同步加入 boostEnabled 及 hp/boostActive
- `frontend/src/hooks/useGameState.js` — initialState 加入 boostEnabled，game_started 解析 boostEnabled
- `frontend/src/pages/Lobby.jsx` — 進階設定加入加速模式開關
- `frontend/src/pages/Game.jsx` — E 鍵、sendBoost、🚀 手機按鈕、HP 顯示、boost_exhausted 死亡訊息
- `frontend/src/components/GameCanvas.jsx` — 加速蛇頭黃色光暈、RAF 迴圈擴展至 boostingSnake

## 最後一次修改（2026-04-26）

### 改了什麼
- 修正撞牆死亡時，頭部屍體食物座標超出地圖邊界的問題

### 為什麼改
- 每個 tick 的 Phase 2 會先把頭延伸一格（可能延伸到牆外），Phase 3 才偵測到碰牆並記錄死亡。Phase 5 轉換屍體食物時，頭的座標已經是 -1 或 gridSize 等界外值，沒有過濾就直接放進 food 陣列，造成屍體顯示在地圖外面

### 影響的檔案
- `backend/src/services/gameService.js` — Phase 5 屍體食物生成時加入邊界檢查，跳過超出格子範圍的線段
