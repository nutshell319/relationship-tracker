# 💕 关系追踪器 / Relationship Tracker

<p align="center">
  <img src="https://img.shields.io/badge/GitHub_Pages-Deployed-success?logo=github" alt="GitHub Pages">
  <img src="https://img.shields.io/badge/Vue_3-CDN-4FC08D?logo=vuedotjs" alt="Vue 3">
  <img src="https://img.shields.io/badge/ECharts-5-AA344D?logo=apacheecharts" alt="ECharts">
  <img src="https://img.shields.io/badge/DeepSeek-AI_Analysis-4D6BFE" alt="DeepSeek">
  <img src="https://img.shields.io/badge/Privacy_First-Local_Only-00C853" alt="Privacy First">
</p>

基于 Vue 3 + ECharts 的纯前端 SPA，导入微信聊天记录，可视化分析关系发展历程。数据完全留在浏览器内存，不上传任何服务器。

---

## ✨ 功能一览

| # | 功能 | 说明 |
|---|------|------|
| 📈 | **关系趋势图** | 按时间维度展示双方互动频率、消息数的变化曲线 |
| 📊 | **消息量统计** | 总消息数、按发送人分组的柱状图，一眼看清谁更主动 |
| ☁️ | **词云** | 高频词汇云图，捕捉聊天中的核心话题 |
| 🔥 | **互动热力图** | 按日期 x 小时的热力矩阵，找到最活跃的时间段 |
| ⚖️ | **关系天平** | 主动发消息占比、回复速度、消息长度对比，量化双方的投入度 |
| 📅 | **日历视图** | GitHub 贡献图风格的日历面板，标记每一天的聊天密度 |
| 🦉 | **夜猫子检测** | 统计 0:00-6:00 的消息占比，看看谁是深夜倾诉型 |
| 😊 | **表情趋势** | 常用表情包排行与时间趋势，发现 emoji 使用习惯的演化 |
| 🏷️ | **昵称演变** | 追踪双方对彼此的备注/称呼随时间的变化轨迹 |
| 🤖 | **AI 深度分析** | 接入 DeepSeek API，对聊天内容进行情感分析、关系阶段判定、关键转折点识别 |
| ⏳ | **时间线** | 以时间轴形式展示关系中的里程碑事件（第一次深夜聊天、最长通话日等） |
| 📋 | **年度报告** | 一键生成年度关系总结，涵盖数据亮点、关键词、AI 点评 |

---

## 🔒 隐私保护

本项目将隐私放在首位，设计原则如下：

| 原则 | 说明 |
|------|------|
| 🏠 **数据完全本地** | 聊天记录 JSON 解析后仅存在于浏览器内存中，**绝不**上传到任何服务器 |
| 🧪 **AI 仅获取样本** | 调用 DeepSeek API 时仅发送脱敏后的**统计摘要和少量样本消息**，不发送完整记录 |
| 🔑 **API Key 本地保存** | DeepSeek API Key 仅存储在浏览器 `localStorage`，用户完全可控 |
| 🚫 **零埋点** | 无任何分析/统计/埋点脚本，你自己就是数据的唯一拥有者 |

---

## 🚀 使用方法

### 第一步：导出聊天记录

使用 [WeChatMsg](https://github.com/LC044/WeChatMsg) 工具导出微信聊天记录为 JSON 格式。

1. 下载并运行 WeChatMsg
2. 选择目标聊天会话
3. 导出格式选择 **JSON**
4. 保存导出文件到本地

### 第二步：打开页面

直接访问部署好的 GitHub Pages 地址，或本地打开 `index.html`。

### 第三步：导入数据

将导出的 JSON 文件**拖拽**到页面上的导入区域，数据即被解析并可视化。

### 第四步（可选）：启用 AI 分析

在页面设置中输入你的 [DeepSeek API Key](https://platform.deepseek.com/api_keys)，解锁 AI 深度分析功能。

---

## 💻 本地开发

```bash
# 方式一：直接打开（适用于简单调试）
# 在浏览器中打开 index.html 即可

# 方式二：本地 HTTP 服务（推荐，避免跨域问题）
cd "C:\programs\个人项目\relationship-tracker"
python -m http.server 8080

# 然后访问 http://localhost:8080
```

纯前端项目，无需 `npm install`，无需构建工具，开箱即用。

---

## 🚢 部署到 GitHub Pages

### 1. 创建仓库

在 GitHub 上创建一个新仓库，例如 `relationship-tracker`。

### 2. 推送代码

```bash
cd "C:\programs\个人项目\relationship-tracker"
git init
git add .
git commit -m "初始化关系追踪器"
git remote add origin https://github.com/<你的用户名>/relationship-tracker.git
git branch -M main
git push -u origin main
```

### 3. 启用 GitHub Pages

在仓库 **Settings → Pages** 中：
- **Source** 选择 `Deploy from a branch`
- **Branch** 选择 `main`，目录选择 `/ (root)`
- 点击 **Save**

### 4. 访问

几分钟后，访问 `https://<你的用户名>.github.io/relationship-tracker/` 即可使用。

---

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **Vue 3** (CDN) | 响应式 UI 框架，选项式 API |
| **ECharts 5** (CDN) | 数据可视化图表库 |
| **DeepSeek API** | AI 文本分析与情感识别 |
| **GitHub Pages** | 静态站点托管，免费 + HTTPS |
| **WeChatMsg** | 微信聊天记录导出工具 |

所有依赖均通过 CDN 引入，无需构建步骤。

---

## ⚠️ 注意事项

- 🔐 **切勿将聊天记录 JSON 文件上传到公开仓库** —— 已在 `.gitignore` 中排除 `*.json`，但仍请自行留意
- 🔑 **DeepSeek API Key 仅保存在你自己的浏览器 `localStorage` 中**，清除浏览器数据会导致 Key 丢失，需重新输入
- 📱 WeChatMsg 不同版本导出的 JSON 字段名可能略有差异，若解析失败请尝试更新到最新版
- 🌐 首次加载需联网下载 Vue 3 和 ECharts CDN 资源，后续可利用浏览器缓存
- 💬 目前仅支持微信聊天记录（WeChatMsg JSON 格式），暂不支持 QQ、Telegram 等其他平台
