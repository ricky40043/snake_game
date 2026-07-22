# 🐍 貪吃蛇 Online

多人線上即時對戰貪吃蛇遊戲。支援最多 7 人同房競技，最後存活的蛇獲勝。

---

## 玩法規則

### 基本操作
| 控制 | 鍵盤 | 手機 |
|------|------|------|
| 向上 | `↑` 或 `W` | 螢幕上方按鈕 |
| 向下 | `↓` 或 `S` | 螢幕下方按鈕 |
| 向左 | `←` 或 `A` | 螢幕左方按鈕 |
| 向右 | `→` 或 `D` | 螢幕右方按鈕 |

> 不能直接 180° 掉頭（例如正在往右就不能立刻往左）

### 遊戲流程
1. 輸入暱稱，**建立房間**或**輸入 6 位代碼加入房間**
2. 等待大廳：將房間代碼或連結分享給其他玩家
3. 房主按下「開始遊戲」，所有玩家同時開始
4. 吃掉紅色食物讓蛇變長，每顆 **+10 分**
5. 最後存活的蛇獲勝；同時撞死則平局

### 死亡條件
- 撞到**地圖邊界**
- 撞到**任何一條蛇的身體**（包含自己）
- 與其他蛇**正面碰頭**（兩者同時死亡）

### 斷線處理
- 遊戲中斷線 → 該玩家的蛇**立即死亡**
- 重新連線後可進入觀戰模式直到本局結束
- 等待大廳中斷線 → 自動從房間移除

### 再來一局
遊戲結束後，房主可點擊「再來一局」重置回大廳，所有在線玩家保留座位直接重賽。

---

## 本地開發

### 環境需求
- Node.js 20+
- npm

### 啟動步驟

```bash
# 安裝後端套件
cd backend && npm install

# 安裝前端套件
cd ../frontend && npm install

# 終端機 1：啟動後端
cd backend && npm run dev

# 終端機 2：啟動前端
cd frontend && npm run dev
```

前端：`http://localhost:5173`
後端：`http://localhost:3001`

---

## Docker 部署

### 本地測試
```bash
docker-compose up --build
```
開啟 `http://localhost:10000`

### 部署到 Render

1. 登入 [Render](https://render.com) → **New Web Service**
2. 連接此 GitHub Repository
3. Runtime 選擇 **Docker**
4. 設定環境變數：
   ```
   NODE_ENV=production
   PORT=10000
   ```
5. Health Check Path：`/api/health`
6. 點擊 **Deploy**

部署完成後即可透過 Render 提供的網址分享給朋友遊玩。

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS |
| 後端 | Node.js + Express + Socket.io |
| 即時通訊 | WebSocket（Socket.io） |
| 遊戲邏輯 | 伺服器主控（120ms/tick），防作弊 |
| 資料儲存 | 純記憶體（無需資料庫） |
| 部署 | Docker 單容器 |

### Socket.io 事件
```
Client → Server          Server → Client
──────────────────       ─────────────────────
create_room              room_created
join_room                room_joined
rejoin_host              room_updated
start_game               game_started
change_direction         game_tick
play_again               player_died
leave_room               game_over
                         game_reset
```
