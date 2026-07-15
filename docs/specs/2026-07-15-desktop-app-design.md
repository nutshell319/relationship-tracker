# 感情追踪桌面应用 — 设计规格书

> 日期：2026-07-15 | 状态：已确认 | 基于现有网站 v1.0

## 1. 项目概述

### 1.1 目标

在现有纯前端网站基础上，构建 WPF 桌面应用，实现**一键从微信本地数据库提取聊天记录 → 自动分析 → 可视化**的完整闭环。用户不再需要手动用 WeChatMsg 导出 JSON 再拖入网页。

### 1.2 核心约束

| 约束 | 说明 |
|------|------|
| 数据隐私 | 所有数据（聊天记录、分析结果）全程不离开用户电脑 |
| 内嵌渲染 | 不在外部浏览器打开，所有 UI 在应用窗口内的 WebView2 控件中渲染 |
| 零手动导出 | 无需安装 WeChatMsg 或手动操作数据库 |
| 兼容现有网站 | 复用全部前端代码（HTML/CSS/JS），新增会话选择页，保持风格统一 |
| 降级兜底 | 自动解密失败时保留手动拖入 JSON 的入口 |

---

## 2. 技术方案

### 2.1 技术栈

| 层 | 选型 | 原因 |
|----|------|------|
| 桌面框架 | WPF (.NET Framework 4.8) | 用户主力技术栈，Windows 原生 API 调用便利 |
| 内嵌浏览器 | WebView2 | 微软官方控件，Chromium 内核，支持现代 CSS/JS |
| 微信DB解密 | Python 脚本（基于 PyWxDump/wdecipher） | 社区成熟方案，多版本兼容，C# 通过 Process 调用 |
| 打包 | Python 运行时嵌入 + MSIX | 用户无感安装 |
| UI | 全屏 WebView2 + 现有浪漫暗色 CSS 主题 | WPF 仅为窗口壳，所有界面为 HTML/CSS |

### 2.2 架构

```
┌──────────────────────────────────────────────┐
│              WPF 桌面应用                      │
│                                              │
│  C# 后台（MainWindow.xaml.cs）                 │
│  ┌──────────────────────────────────────┐    │
│  │ WeChatService                        │    │
│  │  ├─ FindWeChatProcess()              │    │
│  │  ├─ RunDecryptScript() → Process     │    │
│  │  ├─ GetSessions() → List<Session>    │    │
│  │  └─ ExportChat(wxid) → string (JSON) │    │
│  ├──────────────────────────────────────┤    │
│  │ WebViewBridge                        │    │
│  │  ├─ RegisterJsHandler("scanSessions")│    │
│  │  ├─ RegisterJsHandler("exportChat")  │    │
│  │  └─ RegisterJsHandler("readApiKey")  │    │
│  └──────────────────────────────────────┘    │
│                    ↕ WebMessage + ExecuteScript│
│  ┌──────────────────────────────────────┐    │
│  │ WebView2（全屏，填满整个窗口）          │    │
│  │                                      │    │
│  │ 加载本地 wwwroot/index.html            │    │
│  │                                      │    │
│  │ 视图：                                │    │
│  │  ├─ 会话选择页 [新增]                  │    │
│  │  ├─ 导入页（有手动拖入入口）[已有]      │    │
│  │  ├─ 分析仪表盘 [已有]                  │    │
│  │  └─ 关系时间线 [已有]                  │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 2.3 数据流

```
启动应用
  → WebView2 加载 index.html → UI 就绪
  → JS 调用 C# scanSessions()
  → C# 启动 Python：python decrypt_chat.py --mode list
  → Python 解密微信DB → 读取所有会话 → 返回 JSON [{wxid, nickname, msgCount, dateRange}]
  → C# 通过 ExecuteScript 推送给 JS → 渲染会话卡片

用户点击某人
  → JS 调用 C# exportChat(wxid)
  → C# 启动 Python：python decrypt_chat.py --mode export --wxid xxx
  → Python 解密 + 导出该会话全部消息 → 返回完整 JSON
  → C# 通过 ExecuteScript 推送给 JS
  → JS 调用 RLT.parser.parse() → RLT.stats.compute() → RLT.ai.analyze() → RLT.charts.render()
```

---

## 3. 新增功能：会话选择页

### 3.1 页面设计

在现有网站视图中新增一个视图 `sessions`，作为应用启动后的默认首页。

- 顶部：标题 "选择要分析的聊天" + 自动解密状态指示器
- 中部：会话卡片列表，每张卡片显示头像占位、昵称、消息数、时间跨度
- 每张卡片可点击，点击后自动导出并进入仪表盘
- 底部：手动导入入口（"或手动拖入 JSON 文件"）
- 风格：复用现有 CSS 变量和暗色主题，与仪表盘/时间线视觉统一

### 3.2 状态指示器

| 状态 | 显示 |
|------|------|
| 扫描中 | `🔍 正在扫描微信聊天记录...` + spinner |
| 成功 | `✅ 已找到 X 个聊天会话` |
| 微信未安装 | `⚠️ 未检测到微信客户端，请先安装微信PC版` |
| 微信未登录 | `⚠️ 微信未运行或未登录，请先登录微信PC版` |
| 解密失败 | `❌ 数据库读取失败（版本可能已更新）。仍可手动导入 JSON：` + 文件选择按钮 |

---

## 4. C# ↔ JavaScript 通信接口

### 4.1 JS → C#（通过 chrome.webview.hostObjects）

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `scanSessions()` | 无 | `Session[]` | 扫描微信DB，返回会话列表 |
| `exportChat(wxid)` | `string` | `string` (JSON) | 导出指定会话完整消息 |
| `readApiKey()` | 无 | `string` | 从 C# 侧读取 API Key（兼容） |

### 4.2 C# → JS（通过 ExecuteScriptAsync）

| 调用时机 | 方法 | 数据 |
|----------|------|------|
| 扫描完成 | `window.RLT.onSessionsReady(json)` | 会话列表 JSON |
| 导出完成 | `window.RLT.onChatExported(json)` | 聊天消息 JSON |
| 扫描失败 | `window.RLT.onError(type, message)` | 错误类型 + 信息 |

### 4.3 Session 数据模型

```csharp
public class ChatSession
{
    public string WxId { get; set; }        // 微信ID
    public string Nickname { get; set; }     // 昵称/备注
    public int MessageCount { get; set; }    // 消息总数
    public string DateStart { get; set; }    // 最早消息日期
    public string DateEnd { get; set; }      // 最晚消息日期
    public string AvatarPath { get; set; }   // 头像本地路径（可选）
}
```

---

## 5. Python 解密脚本

### 5.1 功能

脚本 `decrypt_chat.py` 封装微信数据库的解密和导出逻辑。

```bash
# 列出所有会话
python decrypt_chat.py --mode list

# 导出指定会话的全部消息
python decrypt_chat.py --mode export --wxid wxid_xxxxx

# 输出均为标准 JSON，C# 通过 stdout 读取
```

### 5.2 依赖

```
pywxdump>=3.0
```

### 5.3 打包

开发阶段通过 pip 安装依赖。发布时使用 PyInstaller 打包为独立 exe，随应用一起分发，用户无需安装 Python。

---

## 6. 项目结构

```
relationship-tracker/
│
├── index.html                  # 网站（不变）
├── css/ / js/                  # 前端模块（不变）
├── README.md / README_EN.md    # 文档（不变）
│
├── desktop/                    # 新增：WPF 桌面应用
│   ├── RelationshipTracker.sln
│   ├── RelationshipTracker/
│   │   ├── App.xaml / App.xaml.cs
│   │   ├── MainWindow.xaml     # 窗口：仅包含一个全屏 WebView2 控件
│   │   ├── MainWindow.xaml.cs  # 注册 JS Handler，管理 WebView2 生命周期
│   │   ├── Services/
│   │   │   ├── WeChatService.cs      # 调用 Python 脚本，解析返回 JSON
│   │   │   └── WebViewBridge.cs      # C# ↔ JS 双向通信封装
│   │   ├── Models/
│   │   │   └── ChatSession.cs        # 会话数据模型
│   │   ├── wwwroot/                  # 构建时从根目录复制
│   │   │   ├── index.html
│   │   │   ├── css/
│   │   │   └── js/
│   │   └── python/
│   │       ├── decrypt_chat.py       # 微信DB解密脚本
│   │       └── requirements.txt
│   └── RelationshipTracker.Package/  # MSIX 打包项目
│       └── ...
│
└── docs/
    ├── specs/                 # 设计规格书
    └── superpowers/plans/    # 实现计划
```

---

## 7. 异常处理

| 场景 | 处理 |
|------|------|
| 微信未安装 | 会话页显示提示信息 + 手动导入入口 |
| 微信未运行 | 同上 |
| Python 环境缺失 | 首次启动检测，引导安装（打包后此问题消失） |
| 数据库解密失败 | 显示错误详情 + 手动导入入口 + "可能因微信版本更新"提示 |
| 会话为空 | 显示"未找到聊天记录" |
| WebView2 Runtime 缺失 | 安装程序自动检测并提示安装 |

降级策略：任何自动解密步骤失败时，**手动拖入 JSON 的入口始终可用**。

---

## 8. 开发优先级

| 阶段 | 内容 | 产出 |
|------|------|------|
| Phase 1 | Python 解密脚本 | 能在命令行成功导出 JSON |
| Phase 2 | WPF 壳 + WebView2 加载本地页面 | 应用窗口内看到仪表盘 |
| Phase 3 | C# ↔ JS 通信桥 | 调用 Python → 返回数据 → 前端消费 |
| Phase 4 | 会话选择页（前端新增） | 美观的会话列表 UI |
| Phase 5 | 打包 + 异常处理 | MSIX 安装包，异常兜底 |

---

## 9. 与现有网站的关系

- 网站代码（`index.html`/`css/`/`js/`）是**唯一前端源码**
- WPF 构建时将前端文件**复制到 `wwwroot/`** 下，WebView2 通过本地路径加载
- 前端新增的会话选择页、C# 通信层以 `window.RLT.desktop` 命名空间存在，在普通浏览器中自动跳过
- 网站 GitHub Pages 部署不受影响，继续独立运行
