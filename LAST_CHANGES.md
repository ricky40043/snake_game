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
