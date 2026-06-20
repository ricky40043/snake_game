## 最後一次修改（2026-06-20）

### 改了什麼
- 新增遊戲數據上報：每場遊戲開始（game_start）與結束（game_end）會送一筆事件到共用的 game-stats 收集服務
- game_start 記錄房間、開局人數、模式；game_end 記錄房間、人數、本局時長、模式與冠軍名
- 上報為 fire-and-forget（背景送出、2 秒逾時、任何錯誤一律吞掉），完全不影響遊戲流程

### 為什麼改
- 原本貪食蛇是純記憶體運行、不留任何資料，無法得知有沒有人玩、玩多少
- 改用輕量事件上報，集中到一個共用後台（admin-games.ricky-nova.com）看所有遊戲的使用數據，不必為每個遊戲各做一套後台

### 影響的檔案
- `backend/src/services/stats.js` — 新增，fire-and-forget 上報模組（可用 STATS_URL / STATS_GAME 環境變數覆寫）
- `backend/src/services/gameService.js` — startGame 記 statStartAt 並送 game_start；endGame 送 game_end（含時長）

## 最後一次修改（2026-05-02）

### 改了什麼
- 新增計時模式勝利方式設定，可在進階設定中切換為「最後長度」或「最後分數」
- 計時模式勝利方式預設改為「最後長度」
- 遊戲預設模式改為「計時模式」
- 計時模式結算、結算畫面與遊戲內右側排行會依照設定的勝利方式改用長度或分數排序
- 修正加速卡位教學路徑，改成逐格連續超車、上切、卡位，不再突然跳位
- 修正屍體教學，明確演出吃到屍體後尾巴保留、蛇身變長
- 修正自撞教學時序，先明確演出蛇頭真正撞進自己身體那一格，下一拍才變成屍體
- 修正子彈命中保底判斷：4 格蛇被打改為只扣 3 格並剩 1 格存活，3 格蛇才會被一槍打死
- 攻擊教學示範同步改正，不再用 4 格對手演出「命中 -3 直接死亡」
- 教學步驟從 8 頁增加為 9 頁，新增「自撞也會死亡」示範
- 第一頁顏色教學改為在動畫中畫出上方小蛇、玩家列表圓點與地圖蛇頭外框，讓「上方」位置明確可見
- 吃食物教學改為演出頭吃到食物後尾巴保留，明確呈現蛇是因為尾巴不消失而變長
- 加速教學改為普通蛇與加速蛇同時跑，讓速度差距和每 2 秒扣 1 格更明顯
- 手機版示範區改為吃滿剩餘可用空間，不再固定成過小的 150px 方格
- 教學示範改用正式 `GameCanvas` 渲染 scripted mini-game 狀態，讓格線、蛇、食物、子彈、屍體與正式遊戲一致
- 移動教學加入可點的上下左右方向鍵，玩家可直接切換示範蛇的移動方向
- 自撞教學改為更長的蛇與更完整的繞回路徑，讓「頭撞到自己的身體」更清楚
- 屍體教學改為固定由藍色蛇吃屍體，避免看起來像吃完後蛇的顏色從藍色變綠色
- 加速教學改為加速蛇繞到對手前方卡位，讓對手撞到自己身體後死亡
- 頂部顏色小蛇改為直線，與教學中「上方小蛇」示意一致
- 修正教學 overlay 只覆蓋棋盤容器的問題，改為 `fixed inset-0` 滿版覆蓋整個手機 viewport
- 修正教學規則覆蓋層在手機與低高度畫面上的 RWD：modal 高度限制在 viewport 內，內容區可捲動
- 將教學「上一步 / 下一步 / 開始倒數」控制列固定在 modal 底部，並加入手機 safe-area padding，避免按鈕被擠出或無法點擊
- 調整教學 canvas、文字卡片、進度資訊在手機上的尺寸，避免首幾頁教學把按鈕推到畫面外
- 教學與倒數期間隱藏手機方向鍵、閃電與加速按鈕，避免控制列佔用高度導致整頁需要上下滑動
- 進一步縮小手機版教學 canvas、header、文字卡與底部按鈕高度，讓教學畫面可一次完整顯示
- 將手機教學改成真正全螢幕版面，移除規則文字卡的裁切，確保進度、重點與規則文字都可直接看到
- 手機版教學改為規則文字在上、動畫在下，並再縮小動畫區，避免玩家需要往下找規則內容
- 手機與桌機教學版面拆成兩套結構：手機固定為「進度/重點 → 規則 → 進度條 → 小動畫 → 按鈕」，避免同一個 grid 在不同尺寸下重排錯亂

### 為什麼改
- 使用者發現目前實際效果仍是 4 格蛇被一槍打死，與規則「扣 3 格」不一致；教學示範也因此誤導玩家
- 使用者指出教學動畫必須精準對應實際規則，不能只放抽象示意；原本漏掉自撞死亡、顏色位置不清楚、吃食物變長方向不準、加速速度差不明顯
- 手刻 canvas 容易跟正式遊戲畫法不一致，改用正式畫布元件降低教學與實際遊戲的落差
- 使用者指出移動、顏色、自撞、吃屍體、加速卡位等教學與實際理解仍有落差，因此逐項補足示範細節
- 使用者實機截圖顯示教學 modal 被限制在遊戲棋盤區塊內，上方仍露出遊戲 UI，導致看起來不是滿版且版面混亂
- 手機或較矮螢幕上教學內容高度太高，導致下一步按鈕可能在畫面外或不好點
- 教學期間不需要立即顯示操作按鈕，優先保證教學內容和下一步按鈕完整可見
- 原版為了壓高度使用 `overflow-hidden`，造成規則文字被裁掉，改為縮小動畫與周邊 UI，而不是裁切內容
- 使用者回報規則文字在動畫下方不好閱讀，因此調整手機版閱讀順序，優先呈現規則文字
- 前一版同時使用 grid rows 與 order 切換，造成手機版面混亂，因此改成手機/桌機分離渲染

### 影響的檔案
- `backend/src/services/gameService.js` — 修正子彈命中保底條件，4 格蛇被打會剩 1 格存活
- `frontend/src/pages/Game.jsx` — 攻擊教學示範改成 3 格對手被命中才死亡，避免與正式規則不一致
- `LAST_CHANGES.md` — 記錄本次 RWD 修正

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
