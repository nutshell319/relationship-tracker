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

<h1 align="center">💕 Our Story</h1>

<p align="center">
  <strong>Import WeChat chat logs — AI-powered relationship development analysis & visualization</strong><br>
  Romantic Dark Theme · 12 Visualization Charts · AI 3-Stage Analysis · Zero Backend · Fully Local Data
</p>

<p align="center">
  <a href="https://nutshell319.github.io/relationship-tracker/"><strong>🔗 Live Demo</strong></a>
  &nbsp;·&nbsp;
  <a href="#-features">Features</a>
  &nbsp;·&nbsp;
  <a href="#-quick-start">Quick Start</a>
  &nbsp;·&nbsp;
  <a href="#-privacy">Privacy</a>
  &nbsp;·&nbsp;
  <a href="#-project-structure">Structure</a>
  &nbsp;·&nbsp;
  <a href="README.md">中文</a>
</p>

---

## ✨ Features

### Core Analysis Charts

| Feature | Description |
|---------|-------------|
| 📈 **Relationship Trend** | Daily message count + AI intimacy score overlay |
| 📊 **Message Volume** | Monthly stacked bar chart for both sides |
| ☁️ **Word Cloud** | Heart-shaped word cloud of most frequent terms |
| 🌡️ **Chat Heatmap** | Day-of-week × hour activity matrix |
| ⚖️ **Interaction Balance** | Back-to-back bar chart comparing message counts |
| 📅 **Calendar Heatmap** | GitHub contribution graph style annual calendar |
| 🌙 **Late Night Trends** | 10PM-2AM message ratio over time |
| 😊 **Emoji Trends** | Top 10 emoji monthly usage curves |
| 🏷️ **Nickname Evolution** | Timeline of pet name / term of endearment first appearances |
| 📝 **Annual Report** | Paginated yearly chat review, like Spotify Wrapped |

### AI Analysis Engine

| Capability | Description |
|------------|-------------|
| 🔬 **Monthly Slice Scan** | Per-month sampling — AI scores intimacy, depth, and romantic ambiguity |
| 📊 **Phase Detection** | Auto-classifies relationship stages (acquaintance → ambiguous → ...) |
| 🔑 **Milestone Mining** | Identifies key events: first deep conversation, first "goodnight", first date mention |
| 📝 **NL Summary** | Generates a 100-150 word overall relationship narrative |

---

## 🎨 Visual Style

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#0f0f1a` | Page base |
| Cards | `#1a1a2e` | Secondary containers |
| Accent | `#e85d75` | Highlights / buttons / milestone nodes |
| Secondary | `#ffb3c1` | Gradients / subtle emphasis |
| Charts | ECharts dark theme | Unified with overall style |

---

## 🔒 Privacy

| Principle | Detail |
|-----------|--------|
| 🏠 **Fully Local Data** | Chat JSON stays in browser memory only — **never uploaded** to any server |
| 🧪 **AI Only Sees Samples** | DeepSeek API calls send only statistical summaries + small message samples |
| 🔑 **Key Stored Locally** | API key lives in browser localStorage only |
| 🚫 **Zero Tracking** | No analytics, no telemetry, no third-party scripts |

---

## 🚀 Quick Start

### Online

👉 **Live site: [nutshell319.github.io/relationship-tracker](https://nutshell319.github.io/relationship-tracker/)**

### Local

```bash
git clone https://github.com/nutshell319/relationship-tracker.git
cd relationship-tracker
python -m http.server 8080
# Open http://localhost:8080 in browser
```

### Usage

1. Export WeChat chat history as JSON using [WeChatMsg](https://github.com/LC044/WeChatMsg)
2. Open the site, drag & drop the JSON file
3. (Optional) Enter your DeepSeek API Key to unlock AI analysis
4. Click "Start Analysis" and wait for results

---

## 📊 Data Source

Chat data is exported from the PC WeChat local database via [WeChatMsg](https://github.com/LC044/WeChatMsg). The parser supports multiple WeChatMsg v4.x field name variants. Choose **JSON format** when exporting.

---

## 📁 Project Structure

```
relationship-tracker/
├── index.html              # SPA entry point, CDN references + view templates
├── css/
│   └── style.css           # Global styles (romantic dark theme)
├── js/
│   ├── storage.js          # localStorage wrapper
│   ├── parser.js           # Multi-version WeChatMsg JSON parser
│   ├── stats.js            # Statistics engine (11 metrics)
│   ├── ai.js               # DeepSeek 3-round AI analyzer
│   ├── charts.js           # ECharts chart factory (8 charts)
│   ├── timeline.js         # Relationship timeline renderer
│   └── app.js              # Vue 3 app controller + view router
├── docs/                   # Design docs + implementation plan
├── README.md               # Chinese documentation
└── README_EN.md            # English documentation
```

---

## 🛠 Tech Stack

- **Vue 3** (CDN) — reactive UI, Options API
- **ECharts 5** (CDN) — data visualization
- **echarts-wordcloud** (CDN) — word cloud extension
- **DeepSeek API** (OpenAI-compatible) — AI text analysis
- **GitHub Pages** — static hosting + HTTPS
- Zero build tools, all dependencies via CDN

---

## ⚠️ Notes

- 🔐 **Never upload chat JSON files to public repos** (`.gitignore` already excludes `*.json`)
- 🔑 API key is stored in browser localStorage — clearing browser data will remove it
- 📱 WeChatMsg versions may differ in export field names — update to latest if parsing fails
- 🌐 First load requires CDN resources (Vue + ECharts); subsequent visits use browser cache
