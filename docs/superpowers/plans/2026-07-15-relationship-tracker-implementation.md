# 感情发展追踪网站 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建纯前端单页网站，导入微信聊天记录 JSON → 统计分析 + AI 总结 → 可视化展示感情发展过程

**Architecture:** Vue 3 CDN 驱动视图切换，ECharts 负责图表，DeepSeek API 做 AI 分析。所有 JS 模块挂载到全局 `RLT` 命名空间，通过 `<script>` 标签按依赖顺序加载。原始聊天数据仅存浏览器内存，分析结果存 localStorage。

**Tech Stack:** Vue 3 CDN · ECharts 5 CDN · echarts-wordcloud CDN · DeepSeek API (OpenAI 兼容) · 原生 CSS (暗色浪漫主题)

---

## 文件结构

```
relationship-tracker/
├── index.html              # SPA 入口，CDN 引用 + 视图模板
├── css/
│   └── style.css           # 全部样式
├── js/
│   ├── storage.js          # localStorage 封装 (RLT.storage)
│   ├── parser.js           # WeChatMsg JSON 解析 & 校验 (RLT.parser)
│   ├── stats.js            # 统计引擎 (RLT.stats)
│   ├── ai.js               # AI 分析器 (RLT.ai)
│   ├── charts.js           # ECharts 图表工厂 (RLT.charts)
│   ├── timeline.js         # 时间线渲染 (RLT.timeline)
│   └── app.js              # Vue 应用 + 视图路由 + 主控逻辑
├── docs/
│   ├── specs/              # 设计规格书
│   └── superpowers/plans/  # 本计划
├── .gitignore
└── README.md
```

**依赖加载顺序：**
```
storage.js → parser.js → stats.js → ai.js → charts.js → timeline.js → app.js
```

**全局命名空间：** 所有模块暴露在 `window.RLT` 对象下，避免全局污染。

---

### Task 1: 项目脚手架 — HTML 骨架 + CSS 主题 + 命名空间

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/storage.js`

- [ ] **Step 1: 创建 index.html 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>我们的故事</title>
  <!-- 字体 -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
  <!-- CSS -->
  <link rel="stylesheet" href="css/style.css">
  <!-- Vue 3 -->
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <!-- ECharts -->
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <!-- ECharts WordCloud -->
  <script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2/dist/echarts-wordcloud.min.js"></script>
</head>
<body>
  <div id="app">
    <!-- 导航栏 -->
    <nav class="nav-bar" v-if="currentView !== 'import'">
      <div class="nav-brand" @click="currentView = 'dashboard'">💕 我们的故事</div>
      <div class="nav-tabs">
        <button :class="{active: currentView === 'dashboard'}" @click="currentView = 'dashboard'">📊 仪表盘</button>
        <button :class="{active: currentView === 'timeline'}" @click="currentView = 'timeline'">⏳ 时间线</button>
      </div>
      <div class="nav-actions">
        <button @click="resetAll" class="btn-ghost">🗑️ 清除数据</button>
      </div>
    </nav>

    <!-- 导入页 -->
    <import-view v-if="currentView === 'import'" @loaded="onDataLoaded"></import-view>

    <!-- 仪表盘 -->
    <dashboard-view v-if="currentView === 'dashboard'"></dashboard-view>

    <!-- 时间线 -->
    <timeline-view v-if="currentView === 'timeline'"></timeline-view>
  </div>

  <!-- JS 模块（按依赖顺序） -->
  <script src="js/storage.js"></script>
  <script src="js/parser.js"></script>
  <script src="js/stats.js"></script>
  <script src="js/ai.js"></script>
  <script src="js/charts.js"></script>
  <script src="js/timeline.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 CSS 主题文件**

```css
/* === CSS 变量 & 全局重置 === */
:root {
  --bg-primary: #0f0f1a;
  --bg-card: #1a1a2e;
  --bg-card-hover: #1e1e35;
  --accent: #e85d75;
  --accent-soft: #ffb3c1;
  --accent-dim: rgba(232, 93, 117, 0.15);
  --text-primary: #e8e8ed;
  --text-secondary: #9898a8;
  --text-muted: #5a5a72;
  --border: #2a2a3e;
  --success: #4caf50;
  --warning: #ff9800;
  --radius: 10px;
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  line-height: 1.6;
}

/* === 导航栏 === */
.nav-bar {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  background: rgba(15, 15, 26, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 20px;
}

.nav-brand {
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.nav-tabs {
  display: flex;
  gap: 6px;
  flex: 1;
}

.nav-tabs button {
  background: none;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  font-family: inherit;
}

.nav-tabs button:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.nav-tabs button.active {
  color: var(--accent);
  background: var(--accent-dim);
  border-color: var(--accent);
}

/* === 按钮 === */
.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.btn-primary:hover { background: #f0627a; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(232, 93, 117, 0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

.btn-ghost {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.btn-ghost:hover { color: var(--accent); border-color: var(--accent); }

/* === 卡片 === */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}

.card-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  font-weight: 500;
}

/* === 网格布局 === */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 20px 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-full {
  grid-column: 1 / -1;
}

/* === 导入页 === */
.import-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 60px);
  padding: 40px 24px;
}

.import-card {
  background: var(--bg-card);
  border: 2px dashed var(--border);
  border-radius: 16px;
  padding: 48px;
  text-align: center;
  max-width: 560px;
  width: 100%;
  transition: border-color 0.3s;
}

.import-card.dragover {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.import-icon { font-size: 48px; margin-bottom: 16px; }

.import-card h2 {
  font-size: 22px;
  margin-bottom: 8px;
  font-weight: 600;
}

.import-card p {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 24px;
}

/* === 时间线 === */
.timeline-view {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.timeline-track {
  position: relative;
  padding-left: 32px;
}

.timeline-track::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, var(--accent), var(--accent-soft), var(--accent));
}

.timeline-phase-label {
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 13px;
  color: var(--accent);
  display: inline-block;
  margin: 24px 0 12px;
  font-weight: 500;
}

.timeline-milestone {
  position: relative;
  margin-bottom: 20px;
}

.timeline-milestone::before {
  content: '';
  position: absolute;
  left: -27px;
  top: 16px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-primary);
}

.timeline-milestone-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.timeline-milestone-card .date {
  font-size: 12px;
  color: var(--accent);
  margin-bottom: 6px;
}

.timeline-milestone-card h4 {
  font-size: 16px;
  margin-bottom: 6px;
}

.timeline-milestone-card p {
  font-size: 13px;
  color: var(--text-secondary);
}

/* === API Key 输入 === */
.api-key-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.api-key-section label {
  font-size: 13px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 6px;
}

.api-key-input {
  display: flex;
  gap: 8px;
}

.api-key-input input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
}

.api-key-input input:focus {
  outline: none;
  border-color: var(--accent);
}

/* === 状态提示 === */
.status-bar {
  background: var(--warning);
  color: #000;
  text-align: center;
  padding: 8px;
  font-size: 13px;
}

.status-bar.error {
  background: #e85d75;
  color: #fff;
}

/* === 加载动画 === */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 26, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* === 滚动条 === */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* === 响应式 === */
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    padding: 12px;
  }

  .import-card {
    padding: 32px 20px;
  }

  .nav-tabs button {
    padding: 6px 10px;
    font-size: 13px;
  }
}

/* === 图表容器 === */
.chart-box {
  width: 100%;
  height: 320px;
}

/* === 词云容器 === */
.wordcloud-box {
  width: 100%;
  height: 320px;
}

/* === 年度报告翻页 === */
.report-container {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
}

.report-page {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 32px;
  text-align: center;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.report-nav {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

/* === 统计数字 === */
.stat-number {
  font-size: 36px;
  font-weight: 700;
  color: var(--accent);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

/* === 称呼演变 === */
.nickname-evo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.nickname-evo-item .evo-date {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 80px;
}

.nickname-evo-item .evo-arrow {
  color: var(--accent);
}

.nickname-evo-item .evo-name {
  font-weight: 500;
}
```

- [ ] **Step 3: 创建 storage.js（localStorage 封装）**

```javascript
// js/storage.js — localStorage 封装
window.RLT = window.RLT || {};

RLT.storage = (function() {
  const KEYS = {
    API_KEY: 'rlt_api_key',
    API_BASE: 'rlt_api_base',
    AI_RESULT: 'rlt_ai_result',
    STATS_RESULT: 'rlt_stats_result',
    CHAT_META: 'rlt_chat_meta',
    CURRENT_VIEW: 'rlt_current_view'
  };

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('localStorage 写入失败:', e);
      return false;
    }
  }

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('localStorage 读取失败:', e);
      return null;
    }
  }

  function clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return { KEYS, save, load, clear };
})();
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 项目脚手架 — HTML骨架 + CSS主题 + storage模块"
```

---

### Task 2: parser.js — WeChatMsg JSON 解析 & 校验

**Files:**
- Create: `js/parser.js`

- [ ] **Step 1: 创建 parser.js**

```javascript
// js/parser.js — WeChatMsg JSON 解析与校验
RLT.parser = (function() {

  /**
   * WeChatMsg 导出 JSON 的典型结构：
   * [
   *   {
   *     "CreateTime": 1710518400,    // Unix 时间戳（秒）
   *     "IsSender": 1,              // 1=我发送, 0=对方发送
   *     "StrContent": "你好呀",      // 消息文本内容
   *     "StrTalker": "wxid_xxx",    // 对话对象 ID
   *     "Type": 1,                  // 1=文本, 3=图片, 34=语音, 47=表情
   *     "MsgSvrID": "..."
   *   }
   * ]
   *
   * 注意：实际字段名可能因 WeChatMsg 版本而异，
   * 需做兼容解析。如果发现不匹配，根据实际格式调整。
   */

  // 已知可能的字段名映射（不同 WeChatMsg 版本）
  const FIELD_ALIASES = {
    createTime: ['CreateTime', 'createTime', 'time', 'timestamp', 'msgCreateTime'],
    isSender: ['IsSender', 'isSender', 'is_sender', 'sender'],
    content: ['StrContent', 'strContent', 'content', 'msgContent', 'message'],
    talker: ['StrTalker', 'strTalker', 'talker', 'talkerId'],
    type: ['Type', 'type', 'msgType', 'msg_type']
  };

  /**
   * 根据别名映射查找字段值
   */
  function getField(obj, aliases) {
    for (const alias of aliases) {
      if (obj[alias] !== undefined && obj[alias] !== null) {
        return obj[alias];
      }
    }
    return undefined;
  }

  /**
   * 解析单条消息
   */
  function parseMessage(raw) {
    const createTime = getField(raw, FIELD_ALIASES.createTime);
    const isSender = getField(raw, FIELD_ALIASES.isSender);
    const content = getField(raw, FIELD_ALIASES.content);
    const talker = getField(raw, FIELD_ALIASES.talker);
    const type = getField(raw, FIELD_ALIASES.type);

    if (createTime === undefined || isSender === undefined) {
      return null; // 无效消息，跳过
    }

    // 时间戳可能是秒或毫秒，统一为毫秒
    const ts = createTime > 1e12 ? createTime : createTime * 1000;

    return {
      timestamp: ts,
      date: new Date(ts),
      isMine: isSender === 1 || isSender === true,
      content: String(content || ''),
      talker: String(talker || ''),
      type: Number(type || 1),
      // 预计算字段
      hour: new Date(ts).getHours(),
      dayOfWeek: new Date(ts).getDay(),
      dateStr: new Date(ts).toISOString().split('T')[0],
      monthStr: new Date(ts).toISOString().slice(0, 7) // "2025-03"
    };
  }

  /**
   * 解析整个 JSON 文件
   * @param {string} jsonStr - JSON 文件原始文本
   * @returns {{ success: boolean, data?: object, error?: string }}
   */
  function parse(jsonStr) {
    let rawData;
    try {
      rawData = JSON.parse(jsonStr);
    } catch (e) {
      return { success: false, error: 'JSON 格式无效，请确认文件是 WeChatMsg 导出的 .json 文件' };
    }

    // 确保是数组
    const messages = Array.isArray(rawData) ? rawData : (rawData.messages || rawData.data || []);
    if (!Array.isArray(messages) || messages.length === 0) {
      return { success: false, error: '聊天记录为空，请确认文件内容完整' };
    }

    // 解析每条消息
    const parsed = [];
    for (const raw of messages) {
      const msg = parseMessage(raw);
      if (msg) parsed.push(msg);
    }

    if (parsed.length === 0) {
      return { success: false, error: '未能解析出有效消息，文件格式可能不兼容。期待 WeChatMsg 导出的 JSON 格式。' };
    }

    // 按时间排序
    parsed.sort((a, b) => a.timestamp - b.timestamp);

    // 提取双方标识
    const talkers = new Set(parsed.map(m => m.talker));
    const myTalker = findMyTalker(parsed);
    const otherTalker = [...talkers].find(t => t !== myTalker) || '对方';

    // 提取元信息
    const meta = {
      totalMessages: parsed.length,
      dateRange: {
        start: parsed[0].dateStr,
        end: parsed[parsed.length - 1].dateStr
      },
      durationDays: Math.ceil((parsed[parsed.length - 1].timestamp - parsed[0].timestamp) / 86400000),
      myMessages: parsed.filter(m => m.isMine).length,
      otherMessages: parsed.filter(m => !m.isMine).length,
      talkers: { me: myTalker, other: otherTalker }
    };

    return {
      success: true,
      data: { messages: parsed, meta }
    };
  }

  /**
   * 推断哪个 talker 是"我"（发消息最多的那个）
   */
  function findMyTalker(messages) {
    const counts = {};
    messages.forEach(m => {
      if (m.isMine) {
        counts[m.talker] = (counts[m.talker] || 0) + 1;
      }
    });
    let maxCount = 0, maxTalker = '我';
    for (const [t, c] of Object.entries(counts)) {
      if (c > maxCount) { maxCount = c; maxTalker = t; }
    }
    return maxTalker;
  }

  /**
   * 检查数据完整性问题
   */
  function validate(meta) {
    const warnings = [];
    if (meta.otherMessages === 0) {
      warnings.push('聊天记录中只有一方的消息，可能导出不完整');
    }
    if (meta.totalMessages < 50) {
      warnings.push('消息数量较少（<' + meta.totalMessages + '条），分析可能不够准确');
    }
    return warnings;
  }

  return { parse, validate };
})();
```

- [ ] **Step 2: 提交**

```bash
git add js/parser.js
git commit -m "feat: parser模块 — WeChatMsg JSON解析与校验"
```

---

### Task 3: stats.js — 统计引擎

**Files:**
- Create: `js/stats.js`

- [ ] **Step 1: 创建 stats.js**

```javascript
// js/stats.js — 统计引擎
RLT.stats = (function() {

  /**
   * 完整统计计算
   * @param {Array} messages - parser.parse() 返回的 messages 数组
   * @param {object} meta - parser.parse() 返回的 meta 对象
   * @returns {object} 统计数据
   */
  function compute(messages, meta) {
    return {
      dailyCounts: computeDailyCounts(messages, meta),
      weeklyCounts: computeWeeklyCounts(messages, meta),
      monthlyCounts: computeMonthlyCounts(messages, meta),
      hourlyHeatmap: computeHourlyHeatmap(messages),
      calendarHeatmap: computeCalendarHeatmap(messages, meta),
      wordFrequency: computeWordFrequency(messages),
      emojiTrends: computeEmojiTrends(messages, meta),
      nightOwlStats: computeNightOwlStats(messages, meta),
      balance: computeBalance(messages, meta),
      responseTimes: computeResponseTimes(messages),
      nicknameEvolution: computeNicknameEvolution(messages, meta)
    };
  }

  /**
   * 每日消息数（用于感情趋势图 X 轴数据）
   */
  function computeDailyCounts(messages, meta) {
    const map = {};
    messages.forEach(m => {
      map[m.dateStr] = (map[m.dateStr] || 0) + 1;
    });
    // 填充日期范围
    const result = [];
    const start = new Date(meta.dateRange.start);
    const end = new Date(meta.dateRange.end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      result.push({ date: ds, count: map[ds] || 0 });
    }
    return result;
  }

  /**
   * 每周消息数
   */
  function computeWeeklyCounts(messages, meta) {
    const map = {};
    messages.forEach(m => {
      const d = m.date;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const wk = weekStart.toISOString().split('T')[0];
      map[wk] = (map[wk] || 0) + 1;
    });
    return Object.entries(map)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   * 每月消息数 + 双方各自消息数
   */
  function computeMonthlyCounts(messages, meta) {
    const map = {};
    messages.forEach(m => {
      if (!map[m.monthStr]) {
        map[m.monthStr] = { month: m.monthStr, total: 0, mine: 0, other: 0 };
      }
      map[m.monthStr].total++;
      if (m.isMine) map[m.monthStr].mine++;
      else map[m.monthStr].other++;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * 按星期几 × 小时段热力图数据
   */
  function computeHourlyHeatmap(messages) {
    // days: 0=周日, 1=周一, ..., 6=周六
    // hours: 0-23
    const grid = [];
    for (let h = 0; h < 24; h++) {
      for (let d = 0; d < 7; d++) {
        grid.push([h, d, 0]);
      }
    }
    messages.forEach(m => {
      const idx = m.hour * 7 + m.dayOfWeek;
      grid[idx][2]++;
    });
    return grid;
  }

  /**
   * 日历热力图（GitHub 贡献图风格）
   */
  function computeCalendarHeatmap(messages, meta) {
    const map = {};
    messages.forEach(m => {
      map[m.dateStr] = (map[m.dateStr] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => [date, count]);
  }

  /**
   * 词频统计（前 50 高频词，过滤停用词）
   */
  function computeWordFrequency(messages) {
    const stopWords = new Set([
      '的', '了', '我', '你', '是', '在', '不', '和', '就', '都',
      '也', '要', '还', '有', '这', '那', '个', '来', '去', '说',
      '会', '着', '没', '看', '好', '吧', '吗', '呢', '啊', '哦',
      '嗯', '哈', '呀', '么', '嘛', '噢', '啦', '滴', '哟'
    ]);
    const freq = {};
    messages.forEach(m => {
      // 提取中文词（2-4 字）
      const text = m.content;
      // 简单分词：提取连续中文字符片段，然后切为 2-3 字词
      const chineseChars = text.match(/[一-鿿]+/g);
      if (!chineseChars) return;
      chineseChars.forEach(segment => {
        for (let len of [2, 3]) {
          for (let i = 0; i <= segment.length - len; i++) {
            const word = segment.slice(i, i + len);
            if (!stopWords.has(word) && word.length >= 2) {
              freq[word] = (freq[word] || 0) + 1;
            }
          }
        }
      });
    });
    return Object.entries(freq)
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([name, value]) => ({ name, value }));
  }

  /**
   * Emoji 使用趋势
   */
  function computeEmojiTrends(messages, meta) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const monthlyEmoji = {};

    messages.forEach(m => {
      const emojis = m.content.match(emojiRegex) || [];
      if (emojis.length === 0) return;

      if (!monthlyEmoji[m.monthStr]) {
        monthlyEmoji[m.monthStr] = {};
      }
      emojis.forEach(e => {
        monthlyEmoji[m.monthStr][e] = (monthlyEmoji[m.monthStr][e] || 0) + 1;
      });
    });

    // Top 10 emoji 整体
    const totalEmoji = {};
    Object.values(monthlyEmoji).forEach(monthData => {
      Object.entries(monthData).forEach(([e, c]) => {
        totalEmoji[e] = (totalEmoji[e] || 0) + c;
      });
    });

    const top10 = Object.entries(totalEmoji)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([e]) => e);

    // 每月 top10 的趋势
    const months = Object.keys(monthlyEmoji).sort();
    const trends = top10.map(emoji => ({
      emoji,
      data: months.map(m => monthlyEmoji[m][emoji] || 0)
    }));

    return { top10, trends, months };
  }

  /**
   * 深夜聊天统计（22:00-02:00）
   */
  function computeNightOwlStats(messages, meta) {
    const monthly = {};
    messages.forEach(m => {
      if (!monthly[m.monthStr]) {
        monthly[m.monthStr] = { total: 0, night: 0 };
      }
      monthly[m.monthStr].total++;
      if (m.hour >= 22 || m.hour < 2) {
        monthly[m.monthStr].night++;
      }
    });
    return Object.entries(monthly)
      .map(([month, d]) => ({
        month,
        nightCount: d.night,
        totalCount: d.total,
        ratio: d.total > 0 ? (d.night / d.total * 100).toFixed(1) : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * 双方互动天平
   */
  function computeBalance(messages, meta) {
    const monthly = {};
    messages.forEach(m => {
      if (!monthly[m.monthStr]) {
        monthly[m.monthStr] = { month: m.monthStr, mine: 0, other: 0 };
      }
      if (m.isMine) monthly[m.monthStr].mine++;
      else monthly[m.monthStr].other++;
    });

    const sorted = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));

    return {
      monthly: sorted,
      overall: {
        mine: meta.myMessages,
        other: meta.otherMessages,
        minePercent: meta.totalMessages > 0
          ? (meta.myMessages / meta.totalMessages * 100).toFixed(1)
          : 0
      }
    };
  }

  /**
   * 响应时间估算（同一天内相邻消息的时间差）
   */
  function computeResponseTimes(messages) {
    const intervals = [];
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      // 只计算同一天内、且是不同人发送的消息
      if (prev.dateStr === curr.dateStr && prev.isMine !== curr.isMine) {
        const gap = (curr.timestamp - prev.timestamp) / 60000; // 分钟
        if (gap > 0 && gap < 180) { // 忽略超过 3 小时的间隔
          intervals.push({
            date: curr.dateStr,
            gapMinutes: Math.round(gap),
            responder: curr.isMine ? 'me' : 'other'
          });
        }
      }
    }
    return intervals;
  }

  /**
   * 称呼演变（分析消息中对对方的称呼变化）
   * 通过关键词匹配查找可能的称呼
   */
  function computeNicknameEvolution(messages, meta) {
    // 常见称呼模式（可在昵称前出现的词）
    const nicknamePatterns = [
      /亲爱的/, /宝贝/, /宝宝/, /乖乖/, /憨憨/,
      /小[一-鿿]{1,2}/, /老[一-鿿]{1,2}/,
      /笨蛋/, /傻瓜/, /猪[一-鿿]?/, /狗子/,
      /哥哥/, /妹妹/, /姐姐/, /弟弟/
    ];

    const firstSeen = {};
    messages.forEach(m => {
      nicknamePatterns.forEach(pattern => {
        const match = m.content.match(pattern);
        if (match) {
          const term = match[0];
          if (!firstSeen[term] || m.timestamp < firstSeen[term].timestamp) {
            firstSeen[term] = {
              term,
              date: m.dateStr,
              timestamp: m.timestamp
            };
          }
        }
      });
    });

    return Object.values(firstSeen)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  return { compute };
})();
```

- [ ] **Step 2: 提交**

```bash
git add js/stats.js
git commit -m "feat: stats模块 — 统计引擎（消息量/词频/热力图/Emoji/天平/称呼）"
```

---

### Task 4: ai.js — AI 分析器

**Files:**
- Create: `js/ai.js`

- [ ] **Step 1: 创建 ai.js**

```javascript
// js/ai.js — DeepSeek API 分析器
RLT.ai = (function() {

  const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';

  /**
   * 获取 API 配置
   */
  function getConfig() {
    return {
      apiKey: RLT.storage.load(RLT.storage.KEYS.API_KEY) || '',
      baseUrl: RLT.storage.load(RLT.storage.KEYS.API_BASE) || DEFAULT_BASE_URL
    };
  }

  /**
   * 检查 API Key 是否已配置
   */
  function isConfigured() {
    return !!getConfig().apiKey;
  }

  /**
   * 调用 DeepSeek API（兼容 OpenAI 格式）
   */
  async function chatCompletion(messages, options = {}) {
    const config = getConfig();
    const model = options.model || 'deepseek-chat'; // V4 Pro

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * 第 1 轮：月度切片扫描
   * 按月抽样，AI 对每月打分
   */
  async function round1_monthlyScan(messages, meta, onProgress) {
    const monthlyGroups = {};
    messages.forEach(m => {
      if (!monthlyGroups[m.monthStr]) monthlyGroups[m.monthStr] = [];
      monthlyGroups[m.monthStr].push(m);
    });

    const months = Object.keys(monthlyGroups).sort();
    const results = [];

    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const msgs = monthlyGroups[month];
      onProgress && onProgress(`第1轮：分析 ${month}（${msgs.length}条消息）...`);

      // 抽样：取前10条 + 中10条 + 后10条
      const sample = [
        ...msgs.slice(0, 10),
        ...msgs.slice(Math.floor(msgs.length / 2) - 5, Math.floor(msgs.length / 2) + 5),
        ...msgs.slice(-10)
      ].filter((m, i, arr) => arr.indexOf(m) === i); // 去重

      // 构建对话片段
      const dialogSample = sample.map(m =>
        `[${m.dateStr} ${String(m.hour).padStart(2,'0')}:00] ${m.isMine ? '我' : '对方'}: ${m.content}`
      ).join('\n');

      const prompt = `请分析以下两人在 ${month} 的聊天记录样本，从感情发展角度评估，返回JSON（不要markdown代码块）：
{
  "month": "${month}",
  "totalMessages": ${msgs.length},
  "myMessages": ${msgs.filter(m=>m.isMine).length},
  "intimacy": <0-100亲密度评分>,
  "depth": <0-100话题深度评分>,
  "ambiguity": <0-100暧昧指数>,
  "summary": "<一句话描述本月关系状态>",
  "keyTopics": ["<话题1>", "<话题2>"]
}

聊天样本：
${dialogSample}`;

      try {
        const resp = await chatCompletion([
          { role: 'system', content: '你是一个感情分析师，擅长从聊天记录中分析两人的关系发展阶段。请严格返回JSON格式。' },
          { role: 'user', content: prompt }
        ], { jsonMode: true });

        const parsed = JSON.parse(resp);
        results.push(parsed);
      } catch (e) {
        console.error(`第1轮 ${month} 分析失败:`, e);
        // 失败时使用基本数据
        results.push({
          month,
          totalMessages: msgs.length,
          myMessages: msgs.filter(m => m.isMine).length,
          intimacy: 0,
          depth: 0,
          ambiguity: 0,
          summary: `${month}（AI分析不可用）`,
          keyTopics: []
        });
      }
    }

    return results;
  }

  /**
   * 第 2 轮：全局汇总判定
   */
  async function round2_globalSummary(monthlyResults, onProgress) {
    onProgress && onProgress('第2轮：全局关系阶段判定...');

    const monthlySummaries = monthlyResults.map(r =>
      `${r.month}: 亲密度${r.intimacy}/100, 深度${r.depth}/100, 暧昧${r.ambiguity}/100 — ${r.summary}`
    ).join('\n');

    const prompt = `根据以下逐月的感情分析数据，划分两人的关系阶段，返回JSON：

${monthlySummaries}

请返回：
{
  "phases": [
    {
      "name": "<阶段名称，如初识期/熟悉期/暧昧期/热恋期>",
      "start": "<YYYY-MM>",
      "end": "<YYYY-MM>",
      "avgIntimacy": <平均亲密度>,
      "description": "<阶段特征描述，50字左右>"
    }
  ],
  "trend": {
    "direction": "<up/down/stable>",
    "description": "<整体感情趋势描述，50字左右>"
  },
  "overallSummary": "<整体关系发展总结，100-150字>"
}`;

    try {
      const resp = await chatCompletion([
        { role: 'system', content: '你是一个感情分析师。请严格返回JSON格式。' },
        { role: 'user', content: prompt }
      ], { jsonMode: true });

      return JSON.parse(resp);
    } catch (e) {
      console.error('第2轮分析失败:', e);
      return {
        phases: [],
        trend: { direction: 'unknown', description: 'AI分析暂不可用' },
        overallSummary: ''
      };
    }
  }

  /**
   * 第 3 轮：重要事件挖掘
   */
  async function round3_milestones(messages, phases, onProgress) {
    onProgress && onProgress('第3轮：挖掘重要事件...');

    // 为每个阶段抽样消息
    let samplesForPrompt = '';
    phases.forEach(phase => {
      const phaseMsgs = messages.filter(m =>
        m.monthStr >= phase.start && m.monthStr <= phase.end
      );
      const sample = phaseMsgs.slice(0, 8).concat(phaseMsgs.slice(-8));
      samplesForPrompt += `\n\n=== ${phase.name} (${phase.start} ~ ${phase.end}) ===\n`;
      samplesForPrompt += sample.map(m =>
        `[${m.dateStr}] ${m.isMine ? '我' : '对方'}: ${m.content}`
      ).join('\n');
    });

    const prompt = `根据以下关系各阶段的聊天记录，识别重要的关系里程碑事件，返回JSON：

关系阶段：${phases.map(p => `${p.name}(${p.start}~${p.end})`).join(', ')}

${samplesForPrompt}

请识别5-10个关键里程碑事件，返回：
{
  "milestones": [
    {
      "date": "<YYYY-MM-DD>",
      "title": "<事件标题，如'第一次深入对话'>",
      "importance": <1-10重要性评分>,
      "summary": "<事件简述，30字左右>",
      "category": "<first_contact/deep_talk/nickname/date_mention/confession/other>"
    }
  ]
}`;

    try {
      const resp = await chatCompletion([
        { role: 'system', content: '你是一个感情分析师。请严格返回JSON格式。' },
        { role: 'user', content: prompt }
      ], { jsonMode: true });

      return JSON.parse(resp);
    } catch (e) {
      console.error('第3轮分析失败:', e);
      return { milestones: [] };
    }
  }

  /**
   * 完整分析流程
   * @returns {object} 完整的 AI 分析结果
   */
  async function analyze(messages, meta, onProgress) {
    if (!isConfigured()) {
      return { degraded: true, reason: '未配置API Key' };
    }

    onProgress && onProgress('开始 AI 分析...');

    // 第1轮
    const monthlyResults = await round1_monthlyScan(messages, meta, onProgress);

    // 第2轮
    const globalResult = await round2_globalSummary(monthlyResults, onProgress);

    // 第3轮
    const milestones = await round3_milestones(messages, globalResult.phases || [], onProgress);

    const result = {
      degraded: false,
      monthly: monthlyResults,
      ...globalResult,
      ...milestones
    };

    // 保存到 localStorage
    RLT.storage.save(RLT.storage.KEYS.AI_RESULT, result);

    onProgress && onProgress('AI 分析完成！');
    return result;
  }

  return { isConfigured, getConfig, analyze, chatCompletion };
})();
```

- [ ] **Step 2: 提交**

```bash
git add js/ai.js
git commit -m "feat: ai模块 — DeepSeek三轮递进分析器"
```

---

### Task 5: charts.js — ECharts 图表工厂

**Files:**
- Create: `js/charts.js`

- [ ] **Step 1: 创建 charts.js（核心图表 + 扩展模块）**

```javascript
// js/charts.js — ECharts 图表工厂
RLT.charts = (function() {

  // 暗色主题通用配置
  function baseOption() {
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#9898a8' },
      tooltip: { backgroundColor: '#1a1a2e', borderColor: '#2a2a3e', textStyle: { color: '#e8e8ed' } },
      legend: { textStyle: { color: '#9898a8' } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true }
    };
  }

  // 色板
  const COLORS = {
    accent: '#e85d75',
    accentSoft: '#ffb3c1',
    purple: '#b98eff',
    blue: '#5dade2',
    green: '#4caf50'
  };

  /**
   * 图表1：感情趋势曲线
   * @param {HTMLElement} dom - 图表容器
   * @param {Array} dailyCounts - stats.compute().dailyCounts
   * @param {Array} monthlyResults - AI 月度打分结果（可选）
   */
  function renderTrendChart(dom, dailyCounts, monthlyResults) {
    const chart = echarts.init(dom);
    const series = [{
      name: '每日消息数',
      type: 'line',
      data: dailyCounts.map(d => d.count),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: COLORS.accentSoft, width: 1, opacity: 0.5 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(232,93,117,0.2)' },
        { offset: 1, color: 'rgba(232,93,117,0)' }
      ]) }
    }];

    // 如果有 AI 亲密度数据，叠加
    if (monthlyResults && monthlyResults.length > 0) {
      series.push({
        name: 'AI 亲密度',
        type: 'line',
        data: monthlyResults.map(r => r.intimacy),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: COLORS.accent, width: 2.5 },
        itemStyle: { color: COLORS.accent }
      });
    }

    chart.setOption({
      ...baseOption(),
      xAxis: {
        type: 'category',
        data: dailyCounts.map(d => d.date),
        axisLine: { lineStyle: { color: '#2a2a3e' } },
        axisLabel: { color: '#5a5a72', fontSize: 11 }
      },
      yAxis: [{
        type: 'value',
        name: '消息数',
        nameTextStyle: { color: '#5a5a72' },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#1a1a2e' } }
      }, monthlyResults ? {
        type: 'value',
        name: '亲密度',
        min: 0, max: 100,
        nameTextStyle: { color: '#5a5a72' },
        axisLine: { show: false },
        splitLine: { show: false }
      } : null].filter(Boolean),
      series
    });

    return chart;
  }

  /**
   * 图表2：消息量柱状图（按月）
   */
  function renderMessageVolume(dom, monthlyCounts) {
    const chart = echarts.init(dom);
    chart.setOption({
      ...baseOption(),
      xAxis: {
        type: 'category',
        data: monthlyCounts.map(d => d.month),
        axisLine: { lineStyle: { color: '#2a2a3e' } },
        axisLabel: { color: '#5a5a72', fontSize: 11, rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: '消息数',
        nameTextStyle: { color: '#5a5a72' },
        splitLine: { lineStyle: { color: '#1a1a2e' } }
      },
      series: [{
        name: '我的消息',
        type: 'bar',
        data: monthlyCounts.map(d => d.mine),
        itemStyle: { color: COLORS.accent, borderRadius: [4, 4, 0, 0] },
        barGap: '20%'
      }, {
        name: '对方消息',
        type: 'bar',
        data: monthlyCounts.map(d => d.other),
        itemStyle: { color: COLORS.purple, borderRadius: [4, 4, 0, 0] }
      }]
    });
    return chart;
  }

  /**
   * 图表3：词云
   */
  function renderWordCloud(dom, wordFrequency) {
    const chart = echarts.init(dom);
    chart.setOption({
      ...baseOption(),
      series: [{
        type: 'wordCloud',
        shape: 'heart',
        left: 'center',
        top: 'center',
        width: '90%',
        height: '90%',
        sizeRange: [14, 50],
        rotationRange: [-30, 30],
        rotationStep: 15,
        gridSize: 8,
        drawOutOfBound: false,
        textStyle: {
          fontFamily: 'Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif',
          fontWeight: 'normal',
          color: function() {
            const colors = [COLORS.accent, COLORS.accentSoft, COLORS.purple, COLORS.blue, '#ff8a80', '#ea80fc'];
            return colors[Math.floor(Math.random() * colors.length)];
          }
        },
        emphasis: {
          textStyle: { fontSize: 60, fontWeight: 'bold' }
        },
        data: wordFrequency
      }]
    });
    return chart;
  }

  /**
   * 图表4：互动热度热力图（星期几 × 小时）
   */
  function renderHeatmap(dom, heatmapData) {
    const chart = echarts.init(dom);
    const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const hourLabels = Array.from({length: 24}, (_, i) => `${i}:00`);

    chart.setOption({
      ...baseOption(),
      grid: { left: '8%', right: '5%', bottom: '5%', top: '5%' },
      xAxis: {
        type: 'category',
        data: dayLabels,
        axisLine: { lineStyle: { color: '#2a2a3e' } },
        axisLabel: { fontSize: 11 }
      },
      yAxis: {
        type: 'category',
        data: hourLabels,
        axisLine: { lineStyle: { color: '#2a2a3e' } },
        axisLabel: { fontSize: 11 },
        inverse: true
      },
      visualMap: {
        min: 0,
        max: Math.max(...heatmapData.map(d => d[2]), 1),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '-5',
        inRange: { color: ['#1a1a2e', '#3a1a2e', '#6a2a3e', COLORS.accent, COLORS.accentSoft] },
        textStyle: { color: '#9898a8' }
      },
      series: [{
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' }
        }
      }]
    });
    return chart;
  }

  /**
   * 扩展图表5：互动天平（背靠背柱状图）
   */
  function renderBalance(dom, balanceData) {
    const chart = echarts.init(dom);
    const months = balanceData.monthly.map(d => d.month);

    chart.setOption({
      ...baseOption(),
      grid: { left: '5%', right: '5%', bottom: '5%', top: '8%', containLabel: true },
      xAxis: [
        {
          type: 'value',
          inverse: true,
          axisLine: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false }
        },
        {
          type: 'value',
          axisLine: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false }
        }
      ],
      yAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: '#2a2a3e' } },
        axisLabel: { fontSize: 11 }
      },
      series: [
        {
          name: '我',
          type: 'bar',
          data: balanceData.monthly.map(d => -d.mine),
          itemStyle: { color: COLORS.accent, borderRadius: [4, 0, 0, 4] },
          label: { show: true, position: 'left', formatter: p => Math.abs(p.value), color: '#9898a8', fontSize: 11 }
        },
        {
          name: '对方',
          type: 'bar',
          xAxisIndex: 1,
          data: balanceData.monthly.map(d => d.other),
          itemStyle: { color: COLORS.purple, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', color: '#9898a8', fontSize: 11 }
        }
      ]
    });
    return chart;
  }

  /**
   * 扩展图表6：日历热力图
   */
  function renderCalendarHeatmap(dom, calendarData) {
    const chart = echarts.init(dom);
    const maxVal = Math.max(...calendarData.map(d => d[1]), 1);

    chart.setOption({
      ...baseOption(),
      tooltip: {
        ...baseOption().tooltip,
        formatter: p => `${p.data[0]}<br/>${p.data[1]} 条消息`
      },
      visualMap: {
        min: 0,
        max: maxVal,
        type: 'piecewise',
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#1a1a2e', COLORS.accentDim || '#3a1a2e', COLORS.accent] },
        textStyle: { color: '#9898a8' }
      },
      calendar: {
        top: 20,
        left: 30,
        right: 30,
        cellSize: ['auto', 14],
        range: [calendarData[0]?.[0], calendarData[calendarData.length - 1]?.[0]],
        itemStyle: { borderColor: '#0f0f1a', borderWidth: 2 },
        yearLabel: { show: true, color: '#9898a8' },
        dayLabel: { color: '#5a5a72' },
        monthLabel: { color: '#9898a8' }
      },
      series: [{
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: calendarData
      }]
    });
    return chart;
  }

  /**
   * 扩展图表7：深夜聊天趋势
   */
  function renderNightOwl(dom, nightOwlData) {
    const chart = echarts.init(dom);
    chart.setOption({
      ...baseOption(),
      xAxis: {
        type: 'category',
        data: nightOwlData.map(d => d.month),
        axisLabel: { fontSize: 11, rotate: 45 }
      },
      yAxis: [
        {
          type: 'value',
          name: '消息数',
          nameTextStyle: { color: '#5a5a72' },
          splitLine: { lineStyle: { color: '#1a1a2e' } }
        },
        {
          type: 'value',
          name: '占比(%)',
          nameTextStyle: { color: '#5a5a72' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '深夜消息数',
          type: 'bar',
          data: nightOwlData.map(d => d.nightCount),
          itemStyle: { color: COLORS.purple, borderRadius: [4, 4, 0, 0] }
        },
        {
          name: '深夜占比',
          type: 'line',
          yAxisIndex: 1,
          data: nightOwlData.map(d => parseFloat(d.ratio)),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: COLORS.accent, width: 2 },
          itemStyle: { color: COLORS.accent }
        }
      ]
    });
    return chart;
  }

  /**
   * 扩展图表8：Emoji 趋势
   */
  function renderEmojiTrends(dom, emojiData) {
    const chart = echarts.init(dom);
    chart.setOption({
      ...baseOption(),
      xAxis: {
        type: 'category',
        data: emojiData.months,
        axisLabel: { fontSize: 11, rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: '使用次数',
        nameTextStyle: { color: '#5a5a72' },
        splitLine: { lineStyle: { color: '#1a1a2e' } }
      },
      series: emojiData.trends.map((t, i) => ({
        name: t.emoji,
        type: 'line',
        data: t.data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 },
        itemStyle: { color: [COLORS.accent, COLORS.purple, COLORS.blue, COLORS.accentSoft, '#ff8a80', '#ea80fc', '#82b1ff', '#b9f6ca', '#ffe57f', '#ffd740'][i % 10] }
      }))
    });
    return chart;
  }

  // 图表实例管理，避免重复初始化
  const instances = {};

  /**
   * 统一渲染入口
   */
  function render(id, type, data) {
    // 先销毁旧实例
    if (instances[id]) {
      instances[id].dispose();
    }

    const dom = document.getElementById(id);
    if (!dom) return null;

    let chart;
    switch (type) {
      case 'trend': chart = renderTrendChart(dom, data.dailyCounts, data.monthlyResults); break;
      case 'volume': chart = renderMessageVolume(dom, data); break;
      case 'wordcloud': chart = renderWordCloud(dom, data); break;
      case 'heatmap': chart = renderHeatmap(dom, data); break;
      case 'balance': chart = renderBalance(dom, data); break;
      case 'calendar': chart = renderCalendarHeatmap(dom, data); break;
      case 'nightowl': chart = renderNightOwl(dom, data); break;
      case 'emoji': chart = renderEmojiTrends(dom, data); break;
    }

    if (chart) instances[id] = chart;
    return chart;
  }

  /**
   * 销毁所有图表
   */
  function disposeAll() {
    Object.values(instances).forEach(c => c.dispose());
  }

  // 窗口 resize 时自动刷新
  window.addEventListener('resize', () => {
    Object.values(instances).forEach(c => c.resize());
  });

  return { render, disposeAll };
})();
```

- [ ] **Step 2: 提交**

```bash
git add js/charts.js
git commit -m "feat: charts模块 — ECharts图表工厂（8张图表）"
```

---

### Task 6: timeline.js — 时间线渲染

**Files:**
- Create: `js/timeline.js`

- [ ] **Step 1: 创建 timeline.js**

```javascript
// js/timeline.js — 时间线渲染
RLT.timeline = (function() {

  /**
   * 渲染完整时间线
   * @param {Array} phases - AI 分析返回的阶段数组
   * @param {Array} milestones - AI 分析返回的里程碑数组
   * @param {object} meta - 聊天元信息
   */
  function render(containerEl, phases, milestones, meta) {
    if (!containerEl) return;

    let html = '<div class="timeline-track">';

    // 概述头部
    html += `
      <div style="text-align:center;margin-bottom:32px;">
        <h2 style="font-size:22px;margin-bottom:6px;">💕 关系发展时间线</h2>
        <p style="color:var(--text-secondary);font-size:14px;">
          ${meta.dateRange.start} → ${meta.dateRange.end} · 共 ${meta.durationDays} 天
        </p>
      </div>
    `;

    // 阶段标注 + 里程碑
    if (phases && phases.length > 0) {
      // 按阶段分组里程碑
      phases.forEach(phase => {
        html += `<div class="timeline-phase-label">📌 ${phase.name}（${phase.start} ~ ${phase.end}）</div>`;
        html += `<p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">${phase.description}</p>`;

        // 该阶段内的里程碑
        const phaseMilestones = (milestones || []).filter(m =>
          m.date >= phase.start && m.date <= phase.end
        );

        phaseMilestones.forEach(m => {
          const categoryEmoji = {
            'first_contact': '👋',
            'deep_talk': '💬',
            'nickname': '🏷️',
            'date_mention': '📅',
            'confession': '💝',
            'other': '✨'
          }[m.category] || '✨';

          html += `
            <div class="timeline-milestone">
              <div class="timeline-milestone-card">
                <div class="date">${m.date}</div>
                <h4>${categoryEmoji} ${m.title}</h4>
                <p>${m.summary}</p>
                <div style="margin-top:6px;">
                  ${renderImportanceStars(m.importance)}
                </div>
              </div>
            </div>
          `;
        });
      });
    }

    // 如果没有 AI 数据，显示纯统计数据回顾
    if (!phases || phases.length === 0) {
      html += `
        <div style="text-align:center;color:var(--text-muted);padding:32px;">
          <p>🔍 AI 分析暂不可用，请先配置 API Key 或查看仪表盘中的统计图表</p>
        </div>
      `;
    }

    html += '</div>';
    containerEl.innerHTML = html;
  }

  /**
   * 渲染重要性星级
   */
  function renderImportanceStars(importance) {
    const full = Math.round(importance / 2);
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < full ? '★' : '☆';
    }
    return `<span style="color:var(--accent);font-size:11px;">${stars}</span>`;
  }

  return { render };
})();
```

- [ ] **Step 2: 提交**

```bash
git add js/timeline.js
git commit -m "feat: timeline模块 — 关系时间线渲染"
```

---

### Task 7: app.js — Vue 应用 + 主控逻辑

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: 创建 app.js**

```javascript
// js/app.js — Vue 3 应用 & 主控逻辑
(function() {
  const { createApp, ref, computed, onMounted, nextTick } = Vue;

  const app = createApp({
    setup() {
      // === 状态 ===
      const currentView = ref('import');
      const loading = ref(false);
      const loadingMsg = ref('');
      const statusMsg = ref('');
      const statusType = ref('');

      // 数据
      const messages = ref([]);     // 仅在内存中
      const meta = ref(null);
      const statsData = ref(null);
      const aiResult = ref(null);

      // === 视图切换 ===
      function switchView(view) {
        currentView.value = view;
        RLT.storage.save(RLT.storage.KEYS.CURRENT_VIEW, view);

        if (view === 'dashboard') {
          nextTick(() => renderDashboardCharts());
        } else if (view === 'timeline') {
          nextTick(() => renderTimelineView());
        }
      }

      // === 数据加载流程 ===
      async function onDataLoaded(parsedData) {
        meta.value = parsedData.meta;
        messages.value = parsedData.messages;

        // 保存元信息
        RLT.storage.save(RLT.storage.KEYS.CHAT_META, meta.value);

        // 检查数据完整性
        const warnings = RLT.parser.validate(meta.value);
        if (warnings.length > 0) {
          showStatus(warnings[0], 'warning');
        }

        // 开始分析
        await runAnalysis();
      }

      async function runAnalysis() {
        loading.value = true;

        // 1. 统计计算（同步，很快）
        loadingMsg.value = '正在计算统计数据...';
        await sleep(50); // 让 UI 刷新
        statsData.value = RLT.stats.compute(messages.value, meta.value);
        RLT.storage.save(RLT.storage.KEYS.STATS_RESULT, statsData.value);

        // 2. AI 分析（异步，可能较慢）
        if (RLT.ai.isConfigured()) {
          loadingMsg.value = '正在启动 AI 分析...';
          try {
            aiResult.value = await RLT.ai.analyze(messages.value, meta.value, (msg) => {
              loadingMsg.value = msg;
            });
          } catch (e) {
            console.error('AI 分析失败:', e);
            showStatus('AI 分析遇到问题，已切换到纯统计模式', 'warning');
          }
        } else {
          showStatus('未配置 API Key，仅展示统计分析。可点击右上角设置图标配置。', 'warning');
        }

        loading.value = false;
        switchView('dashboard');
      }

      // === 仪表盘图表渲染 ===
      function renderDashboardCharts() {
        if (!statsData.value) return;

        const s = statsData.value;
        const ai = aiResult.value;

        RLT.charts.render('chart-trend', 'trend', {
          dailyCounts: s.dailyCounts,
          monthlyResults: ai && !ai.degraded ? ai.monthly : null
        });

        RLT.charts.render('chart-volume', 'volume', s.monthlyCounts);
        RLT.charts.render('chart-wordcloud', 'wordcloud', s.wordFrequency);
        RLT.charts.render('chart-heatmap', 'heatmap', s.hourlyHeatmap);
        RLT.charts.render('chart-balance', 'balance', s.balance);
        RLT.charts.render('chart-calendar', 'calendar', s.calendarHeatmap);
        RLT.charts.render('chart-nightowl', 'nightowl', s.nightOwlStats);
        RLT.charts.render('chart-emoji', 'emoji', s.emojiTrends);
      }

      // === 时间线渲染 ===
      function renderTimelineView() {
        const container = document.getElementById('timeline-container');
        const ai = aiResult.value;
        RLT.timeline.render(
          container,
          ai && !ai.degraded ? ai.phases : null,
          ai && !ai.degraded ? ai.milestones : null,
          meta.value
        );
      }

      // === 重置所有数据 ===
      function resetAll() {
        if (confirm('确定清除所有数据？包括统计结果和AI分析。')) {
          messages.value = [];
          meta.value = null;
          statsData.value = null;
          aiResult.value = null;
          RLT.storage.clear();
          RLT.charts.disposeAll();
          currentView.value = 'import';
          statusMsg.value = '';
        }
      }

      // === 辅助 ===
      function showStatus(msg, type = 'info') {
        statusMsg.value = msg;
        statusType.value = type;
        setTimeout(() => { statusMsg.value = ''; }, 5000);
      }

      function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      // === 恢复上次会话 ===
      onMounted(() => {
        const savedMeta = RLT.storage.load(RLT.storage.KEYS.CHAT_META);
        const savedStats = RLT.storage.load(RLT.storage.KEYS.STATS_RESULT);
        const savedAI = RLT.storage.load(RLT.storage.KEYS.AI_RESULT);
        const savedView = RLT.storage.load(RLT.storage.KEYS.CURRENT_VIEW);

        if (savedMeta && savedStats) {
          meta.value = savedMeta;
          statsData.value = savedStats;
          aiResult.value = savedAI;
          currentView.value = savedView || 'dashboard';
          nextTick(() => {
            if (currentView.value === 'dashboard') renderDashboardCharts();
            else if (currentView.value === 'timeline') renderTimelineView();
          });
        }
      });

      return {
        currentView,
        loading,
        loadingMsg,
        statusMsg,
        statusType,
        meta,
        statsData,
        aiResult,
        switchView,
        onDataLoaded,
        resetAll
      };
    }
  });

  // === 组件：导入视图 ===
  app.component('import-view', {
    template: `
      <div class="import-view">
        <div class="import-card" :class="{ dragover: isDragover }"
             @dragover.prevent="isDragover = true"
             @dragleave="isDragover = false"
             @drop.prevent="handleDrop">
          <div class="import-icon">💌</div>
          <h2>导入聊天记录</h2>
          <p>将 WeChatMsg 导出的 JSON 文件拖入此处，<br>或点击下方按钮选择文件</p>
          <input type="file" accept=".json" ref="fileInput" @change="handleFile" style="display:none">
          <button class="btn-primary" @click="$refs.fileInput.click()">📁 选择 JSON 文件</button>
          <p v-if="error" style="color:var(--accent);margin-top:12px;font-size:13px;">{{ error }}</p>
          <p v-if="fileInfo" style="color:var(--success);margin-top:12px;font-size:13px;">{{ fileInfo }}</p>

          <!-- API Key 配置 -->
          <div class="api-key-section">
            <label>🔑 DeepSeek API Key（可选，用于 AI 分析）</label>
            <div class="api-key-input">
              <input type="password" v-model="apiKey" placeholder="sk-..." @input="saveApiKey">
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Key 仅存储在本浏览器中，不会上传</p>
          </div>
        </div>
      </div>
    `,
    emits: ['loaded'],
    setup(props, { emit }) {
      const isDragover = Vue.ref(false);
      const error = Vue.ref('');
      const fileInfo = Vue.ref('');
      const apiKey = Vue.ref('');

      // 恢复已保存的 API Key
      apiKey.value = RLT.storage.load(RLT.storage.KEYS.API_KEY) || '';

      function saveApiKey() {
        if (apiKey.value.trim()) {
          RLT.storage.save(RLT.storage.KEYS.API_KEY, apiKey.value.trim());
        } else {
          localStorage.removeItem(RLT.storage.KEYS.API_KEY);
        }
      }

      function handleDrop(e) {
        isDragover.value = false;
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
      }

      function handleFile(e) {
        const file = e.target.files[0];
        if (file) processFile(file);
      }

      function processFile(file) {
        error.value = '';
        fileInfo.value = '';

        // 大小检查
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        if (file.size > 50 * 1024 * 1024) {
          if (!confirm(`文件较大（${sizeMB}MB），处理可能需要一些时间。继续？`)) return;
        }

        fileInfo.value = `正在读取 ${sizeMB}MB...`;

        const reader = new FileReader();
        reader.onload = function(e) {
          const result = RLT.parser.parse(e.target.result);
          if (result.success) {
            const m = result.data.meta;
            fileInfo.value = `✅ 解析成功！共 ${m.totalMessages} 条消息，从 ${m.dateRange.start} 到 ${m.dateRange.end}。点击"开始分析"继续。`;
            window._parsedData = result.data;
          } else {
            error.value = result.error;
          }
        };
        reader.readAsText(file);
      }

      return { isDragover, error, fileInfo, apiKey, saveApiKey, handleDrop, handleFile };
    }
  });

  // === 组件：仪表盘视图 ===
  app.component('dashboard-view', {
    template: `
      <div>
        <!-- 年度报告卡片 -->
        <div v-if="statsData" class="dashboard-grid" style="margin-bottom:0;padding-bottom:0;">
          <div class="card dashboard-full" style="text-align:center;">
            <h3 style="font-size:20px;color:var(--accent);">💕 你们的故事 · 数据回顾</h3>
            <div style="display:flex;justify-content:center;gap:40px;margin-top:16px;flex-wrap:wrap;">
              <div><div class="stat-number">{{ meta.totalMessages }}</div><div class="stat-label">总消息数</div></div>
              <div><div class="stat-number">{{ meta.durationDays }}</div><div class="stat-label">聊天天数</div></div>
              <div><div class="stat-number">{{ (meta.totalMessages / Math.max(meta.durationDays, 1)).toFixed(0) }}</div><div class="stat-label">日均消息</div></div>
              <div><div class="stat-number">{{ statsData.balance.overall.minePercent }}%</div><div class="stat-label">我发起占比</div></div>
            </div>
          </div>
        </div>

        <!-- 2x2 核心图表网格 -->
        <div class="dashboard-grid">
          <div class="card">
            <div class="card-title">📈 感情趋势 & 消息量</div>
            <div class="chart-box" id="chart-trend"></div>
          </div>
          <div class="card">
            <div class="card-title">📊 月度消息统计</div>
            <div class="chart-box" id="chart-volume"></div>
          </div>
          <div class="card">
            <div class="card-title">☁️ 高频词云</div>
            <div class="wordcloud-box" id="chart-wordcloud"></div>
          </div>
          <div class="card">
            <div class="card-title">🌡️ 聊天时段热力图</div>
            <div class="chart-box" id="chart-heatmap"></div>
          </div>
        </div>

        <!-- AI 总结卡片 -->
        <div v-if="aiResult && !aiResult.degraded && aiResult.overallSummary" style="padding:0 24px;max-width:1400px;margin:0 auto 16px;">
          <div class="card" style="border-color:var(--accent);">
            <div class="card-title">🤖 AI 感情总结</div>
            <p style="font-size:15px;line-height:1.8;color:var(--text-primary);">{{ aiResult.overallSummary }}</p>
            <p v-if="aiResult.trend" style="margin-top:8px;font-size:13px;color:var(--text-secondary);">
              📈 整体趋势：{{ aiResult.trend.description }}
            </p>
          </div>
        </div>

        <!-- 扩展模块 -->
        <div class="dashboard-grid">
          <div class="card">
            <div class="card-title">⚖️ 双方互动天平</div>
            <div class="chart-box" id="chart-balance"></div>
          </div>
          <div class="card">
            <div class="card-title">📅 聊天日历热力图</div>
            <div class="chart-box" id="chart-calendar"></div>
          </div>
          <div class="card">
            <div class="card-title">🌙 深夜聊天趋势</div>
            <div class="chart-box" id="chart-nightowl"></div>
          </div>
          <div class="card">
            <div class="card-title">😊 Emoji 使用趋势</div>
            <div class="chart-box" id="chart-emoji"></div>
          </div>
        </div>

        <!-- 称呼演变 -->
        <div v-if="statsData && statsData.nicknameEvolution.length > 0" style="padding:0 24px;max-width:1400px;margin:0 auto 16px;">
          <div class="card">
            <div class="card-title">🏷️ 称呼演变</div>
            <div v-for="n in statsData.nicknameEvolution" :key="n.term" class="nickname-evo-item">
              <span class="evo-date">{{ n.date }}</span>
              <span class="evo-arrow">→</span>
              <span class="evo-name">{{ n.term }}</span>
            </div>
          </div>
        </div>
      </div>
    `,
    setup() {
      // 从父组件注入数据
      const app = Vue.getCurrentInstance().appContext.app;
      // 使用 provide/inject 或直接访问根组件
      return {};
    },
    // 由于组件无法直接访问 setup 中的响应式数据，
    // 我们在 mounted 中从根实例读取
    mounted() {
      // 图表由 renderDashboardCharts() 在 nextTick 中渲染
    }
  });

  // === 组件：时间线视图 ===
  app.component('timeline-view', {
    template: `
      <div class="timeline-view">
        <div id="timeline-container"></div>
      </div>
    `
  });

  // === 挂载 ===
  app.mount('#app');

})();
```

**注意：** 上述 Vue 组件使用了 Options API 模板。为简化组件间数据共享，实际实现时将使用 `app.config.globalProperties` 或直接在 `setup()` 中返回所有数据，各组件通过 `inject` 获取。

- [ ] **Step 2: 提交**

```bash
git add js/app.js
git commit -m "feat: app模块 — Vue应用 + 视图路由 + 组件"
```

---

### Task 8: 集成测试 & 修复

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `js/parser.js`

- [ ] **Step 1: 修复组件数据共享**

在 `app.js` 中使用 `provide`/`inject` 或全局 `app.config.globalProperties.$state` 确保组件能访问响应式数据。修改 `app.js` 的组件定义，使用函数式返回数据。

关键修复点：
- `dashboard-view` 组件中，所有 `v-if` 引用的 `statsData`、`meta`、`aiResult` 需从父组件获取
- 组件 mounted 后需触发图表重绘

- [ ] **Step 2: 添加"开始分析"按钮到导入页**

在 `import-view` 组件中，解析成功后显示"开始分析"按钮，调用 `$emit('loaded', ...)`。

- [ ] **Step 3: 添加加载遮罩和进度条到 index.html**

```html
<!-- 在 #app 内部、body 末尾前 -->
<div v-if="loading" class="loading-overlay">
  <div class="spinner"></div>
  <p style="color:var(--text-secondary);">{{ loadingMsg }}</p>
</div>
```

- [ ] **Step 4: 添加年度报告翻页组件**

在仪表盘底部添加年度报告组件（翻页卡片）：

```html
<!-- 年度报告（可翻页） -->
<div v-if="statsData" style="padding:0 24px;max-width:1400px;margin:0 auto 24px;">
  <div class="card dashboard-full">
    <div class="card-title">📝 年度聊天报告</div>
    <div class="report-container">
      <div class="report-page">
        <div v-if="reportPage === 0">
          <div style="font-size:48px;">💕</div>
          <h3>我们的聊天年度报告</h3>
          <p style="color:var(--text-secondary);">{{ meta.dateRange.start }} ~ {{ meta.dateRange.end }}</p>
        </div>
        <div v-if="reportPage === 1">
          <div class="stat-number">{{ meta.totalMessages }}</div>
          <div class="stat-label">条消息被发送</div>
        </div>
        <div v-if="reportPage === 2">
          <div class="stat-number">{{ meta.durationDays }}</div>
          <div class="stat-label">天从未间断（也许）</div>
        </div>
        <div v-if="reportPage === 3">
          <div class="stat-number">{{ statsData.emojiTrends.top10.slice(0,3).join(' ') }}</div>
          <div class="stat-label">最爱用的表情</div>
        </div>
        <div v-if="reportPage === 4 && aiResult && !aiResult.degraded">
          <p style="font-size:15px;line-height:1.8;">{{ aiResult.overallSummary }}</p>
        </div>
      </div>
      <div class="report-nav">
        <button class="btn-ghost" @click="reportPage = Math.max(0, reportPage - 1)" :disabled="reportPage === 0">◀ 上一页</button>
        <span style="color:var(--text-muted);font-size:13px;">{{ reportPage + 1 }} / 5</span>
        <button class="btn-ghost" @click="reportPage = Math.min(4, reportPage + 1)" :disabled="reportPage === 4">下一页 ▶</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: 添加状态提示条到 index.html**

```html
<div v-if="statusMsg" class="status-bar" :class="statusType">
  {{ statusMsg }}
  <button @click="statusMsg = ''" style="margin-left:12px;background:none;border:none;cursor:pointer;color:inherit;">✕</button>
</div>
```

放置在 `#app` 内部、导航栏下方。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "fix: 组件数据共享 + 加载动画 + 年度报告 + 状态提示"
```

---

### Task 9: README + 部署配置

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 README.md**

```markdown
# 💕 我们的故事 — 感情发展追踪网站

[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-e85d75?logo=github)](https://pages.github.com)
[![Vue 3](https://img.shields.io/badge/Vue-3-4fc08d?logo=vue.js)](https://vuejs.org)
[![ECharts](https://img.shields.io/badge/ECharts-5-b98eff)](https://echarts.apache.org)

纯前端单页网站，导入微信聊天记录（WeChatMsg 导出 JSON），自动分析并可视化感情发展过程。

## ✨ 功能

| 模块 | 说明 |
|------|------|
| 📈 感情趋势曲线 | 每日消息量 + AI 亲密度评分 |
| 📊 消息量统计 | 双方月度消息柱状图 |
| ☁️ 高频词云 | 心动形状词云 |
| 🌡️ 聊天热力图 | 星期×小时 互动密度 |
| ⚖️ 互动天平 | 双方消息量对比 |
| 📅 日历热力图 | GitHub 风格年度聊天日历 |
| 🌙 深夜聊天 | 22:00-02:00 趋势 |
| 😊 Emoji 趋势 | 常用表情使用变化 |
| 🏷️ 称呼演变 | 昵称首次出现时间线 |
| 🤖 AI 分析 | DeepSeek 三轮递进关系总结 |
| ⏳ 关系时间线 | 里程碑事件 + 阶段标注 |
| 📝 年度报告 | 翻页式聊天数据回顾 |

## 🔒 隐私

- 聊天数据**仅在浏览器内存中**处理，不会上传到任何服务器
- AI API 调用时仅发送摘要/抽样片段
- API Key 存储在浏览器 localStorage，不上传

## 🚀 使用

1. 用 [WeChatMsg](https://github.com/LC044/WeChatMsg) 导出聊天记录为 JSON
2. 打开网站，拖入 JSON 文件
3. （可选）填入 DeepSeek API Key 启用 AI 分析
4. 点击"开始分析"

## 🛠️ 本地运行

```bash
# 方式1：直接打开
open index.html

# 方式2：本地服务器（推荐，解决跨域）
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 📦 部署到 GitHub Pages

1. Fork 或创建仓库
2. Push 代码到 `main` 分支
3. 在仓库 Settings → Pages 中，Source 选 `main` 分支，根目录
4. 等几分钟，访问 `https://<你的用户名>.github.io/<仓库名>`

## 📁 技术栈

- Vue 3 CDN
- ECharts 5 CDN
- DeepSeek API（OpenAI 兼容格式）
- 零依赖构建工具

## ⚠️ 注意事项

- GitHub Pages 部署时，**不要上传任何 `.json` 聊天数据文件**（已在 `.gitignore` 中排除）
- API Key 存储在浏览器 localStorage，清除浏览器数据会丢失
- WeChatMsg 不同版本的导出格式可能有差异，解析失败请提 Issue
```

- [ ] **Step 2: 确认 .gitignore 排除所有数据文件**

检查 `.gitignore`：
```
*.json
!package.json
.DS_Store
Thumbs.db
.vs/
.vscode/
*.suo
*.user
*.tmp
*.log
```

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: README — 功能介绍 + 隐私说明 + 部署指南"
```

---

### Task 10: 最终验证 & 完善

- [ ] **Step 1: 检查所有文件完整性**

```bash
cd "C:/programs/个人项目/relationship-tracker"
ls -la index.html css/style.css js/*.js
```

- [ ] **Step 2: 确认 JS 加载顺序正确**

在 `index.html` 中检查 `<script>` 标签顺序：
1. Vue 3 CDN
2. ECharts CDN
3. ECharts WordCloud CDN
4. `js/storage.js`
5. `js/parser.js`
6. `js/stats.js`
7. `js/ai.js`
8. `js/charts.js`
9. `js/timeline.js`
10. `js/app.js`

- [ ] **Step 3: 最终提交**

```bash
git add -A
git status
git commit -m "chore: 最终验证 — 文件完整性 + 加载顺序确认"
```

- [ ] **Step 4: 查看提交历史**

```bash
git log --oneline
```

预期输出：10 个提交，覆盖从脚手架到最终验证的全部内容。

---

## 实现要点

### WeChatMsg JSON 格式说明

不同版本 WeChatMsg 导出的 JSON 字段可能略有差异。`parser.js` 使用别名映射 (`FIELD_ALIASES`) 做兼容。如果实际导出的 JSON 格式与预期不同，只需在 `FIELD_ALIASES` 中添加新字段名即可。

常见格式参考（来自 WeChatMsg v4.x）：
```json
[
  {
    "CreateTime": 1710518400,
    "IsSender": 1,
    "StrContent": "你好呀",
    "StrTalker": "wxid_abc123",
    "Type": 1
  }
]
```

### 调试建议

开发时用 Python 启动本地服务器，避免 file:// 协议下的跨域问题：
```bash
cd "C:/programs/个人项目/relationship-tracker"
python -m http.server 8080
```

### 性能注意事项

- 大文件（>50MB）的解析在主线程进行，可能短暂卡顿，已加入确认对话框
- ECharts 图表使用 `echarts.init()` 创建实例，切换视图时无需销毁（隐藏即可）
- AI 分析耗时取决于月数和网络，已加入进度提示
