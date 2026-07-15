<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/ECharts_5-AA344D?style=for-the-badge&logo=apacheecharts&logoColor=white" alt="ECharts 5">
  <img src="https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=for-the-badge" alt="DeepSeek">
  <img src="https://img.shields.io/badge/GitHub_Pages-Deployed-222222?style=for-the-badge&logo=github" alt="GitHub Pages">
  <img src="https://img.shields.io/badge/Zero_Dependencies-✓-brightgreen?style=for-the-badge" alt="Zero Dependencies">
</p>

<h1 align="center">💕 我们的故事</h1>

<p align="center">
  <strong>导入微信聊天记录，AI 自动分析 & 可视化感情发展过程</strong><br>
  浪漫暗色主题 · 12 张可视化图表 · AI 三阶段分析 · 零后端纯前端 · 数据完全本地
</p>

<p align="center">
  <a href="https://nutshell319.github.io/relationship-tracker/"><strong>🔗 立即体验</strong></a>
  &nbsp;·&nbsp;
  <a href="#-功能特性">功能特性</a>
  &nbsp;·&nbsp;
  <a href="#-快速开始">快速开始</a>
  &nbsp;·&nbsp;
  <a href="#-隐私保护">隐私保护</a>
  &nbsp;·&nbsp;
  <a href="#-项目结构">项目结构</a>
  &nbsp;·&nbsp;
  <a href="README_EN.md">English</a>
</p>

---

## ✨ 功能特性

### 核心分析图表

| 功能 | 说明 |
|------|------|
| 📈 **感情趋势曲线** | 每日消息量 + AI 亲密度评分叠加图，一眼看懂感情升温降温 |
| 📊 **消息量统计** | 双方月度消息堆叠柱状图，谁更主动一目了然 |
| ☁️ **高频词云** | 爱心形状词云，提取聊天中最常出现的词语 |
| 🌡️ **聊天时段热力图** | 星期 × 小时热力矩阵，发现你们的"专属聊天时间" |
| ⚖️ **互动天平** | 背靠背柱状图对比双方消息量，量化互动平衡度 |
| 📅 **日历热力图** | GitHub 贡献图风格的年度聊天日历 |
| 🌙 **深夜聊天趋势** | 22:00-02:00 消息占比变化，深夜对话往往是关系深入的信号 |
| 😊 **Emoji 使用趋势** | Top 10 常用表情的月度使用变化曲线 |
| 🏷️ **称呼演变追踪** | 追踪昵称/爱称首次出现的时间线 |
| 📝 **年度聊天报告** | 翻页式数据回顾，类似年度听歌报告 |

### AI 分析引擎

| 能力 | 说明 |
|------|------|
| 🔬 **月度切片扫描** | 按月抽样分析，AI 对亲密度/话题深度/暧昧指数逐月打分 |
| 📊 **全局阶段判定** | 基于月度数据自动划分关系阶段（初识期→暧昧期→…） |
| 🔑 **重要事件挖掘** | 自动识别里程碑事件：第一次深入对话、第一次互道晚安等 |
| 📝 **自然语言总结** | 生成 100-150 字的关系发展整体描述 |

---

## 🎨 视觉风格

| 元素 | 色值 | 用途 |
|------|------|------|
| 背景 | `#0f0f1a` | 页面底色 |
| 卡片 | `#1a1a2e` | 次级容器 |
| 主强调 | `#e85d75` | 高亮/按钮/里程碑节点 |
| 辅助色 | `#ffb3c1` | 渐变/次要强调 |
| 图表 | ECharts 暗色主题 | 与整体风格统一 |

---

## 🔒 隐私保护

| 原则 | 说明 |
|------|------|
| 🏠 **数据完全本地** | 聊天 JSON 仅存浏览器内存，关闭页面即消失，**绝不上传**任何服务器 |
| 🧪 **AI 仅见样本** | DeepSeek API 调用时仅发送统计摘要+少量抽样，不发完整记录 |
| 🔑 **Key 本地保存** | API Key 仅存浏览器 localStorage，不上传 |
| 🚫 **零埋点** | 无任何分析/统计/埋点脚本 |

---

## 🚀 快速开始

### 在线使用

👉 **直接访问：[nutshell319.github.io/relationship-tracker](https://nutshell319.github.io/relationship-tracker/)**

### 本地运行

```bash
git clone https://github.com/nutshell319/relationship-tracker.git
cd relationship-tracker
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

### 使用流程

1. 用 [WeChatMsg](https://github.com/LC044/WeChatMsg) 导出聊天记录为 JSON
2. 打开网站，拖入 JSON 文件
3. （可选）填入 DeepSeek API Key 解锁 AI 分析
4. 点击"开始分析"，等待结果

---

## 📊 数据来源

聊天数据通过 [WeChatMsg](https://github.com/LC044/WeChatMsg) 从 PC 微信本地数据库导出为 JSON。解析器兼容 WeChatMsg v4.x 的多种字段名变体，导出时选择 **JSON 格式**即可。

---

## 📁 项目结构

```
relationship-tracker/
├── index.html              # SPA 入口，CDN 引用 + 视图模板
├── css/
│   └── style.css           # 全局样式（暗色浪漫主题）
├── js/
│   ├── storage.js          # localStorage 封装
│   ├── parser.js           # WeChatMsg JSON 多版本兼容解析
│   ├── stats.js            # 统计引擎（11 项统计指标）
│   ├── ai.js               # DeepSeek 三轮递进 AI 分析器
│   ├── charts.js           # ECharts 图表工厂（8 张图表）
│   ├── timeline.js         # 关系时间线渲染
│   └── app.js              # Vue 3 应用主控 + 视图路由
├── docs/                   # 设计文档 + 实现计划
└── README.md
```

---

## 🛠 技术栈

- **Vue 3** (CDN) — 响应式 UI，选项式 API
- **ECharts 5** (CDN) — 数据可视化
- **echarts-wordcloud** (CDN) — 词云扩展
- **DeepSeek API** (OpenAI 兼容格式) — AI 文本分析
- **GitHub Pages** — 静态托管 + HTTPS
- 零构建工具，所有依赖 CDN 引入

---

## ⚠️ 注意事项

- 🔐 **不要将聊天 JSON 上传到公开仓库**（`.gitignore` 已排除 `*.json`）
- 🔑 API Key 存在浏览器 localStorage，清除浏览器数据会丢失
- 📱 WeChatMsg 不同版本导出字段名可能有差异，解析失败请更新到最新版
- 🌐 首次加载需联网下载 CDN 资源（Vue + ECharts），后续利用浏览器缓存
