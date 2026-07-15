# 感情追踪桌面应用 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有网站基础上构建 WPF + WebView2 桌面应用，实现从微信数据库自动解密到分析可视化的完整闭环

**Architecture:** WPF .NET Framework 4.8 窗口承载全屏 WebView2 控件，C# 通过 Process 调用 Python 脚本解密微信 SQLCipher 数据库，解密后的 JSON 通过 ExecuteScriptAsync 注入前端，前端新增会话选择页作为启动首页

**Tech Stack:** WPF .NET Framework 4.8 · WebView2 · Python (pywxdump) · Newtonsoft.Json · MSIX 打包

---

## 文件结构

```
relationship-tracker/
├── desktop/                              # 新增目录
│   ├── RelationshipTracker.sln
│   ├── RelationshipTracker/
│   │   ├── RelationshipTracker.csproj    # WPF项目文件
│   │   ├── App.xaml                      # 应用入口
│   │   ├── App.xaml.cs
│   │   ├── MainWindow.xaml               # 全屏WebView2窗口
│   │   ├── MainWindow.xaml.cs
│   │   ├── Services/
│   │   │   ├── WeChatService.cs          # Python进程管理
│   │   │   └── WebViewBridge.cs          # C#↔JS双向通信
│   │   ├── Models/
│   │   │   └── ChatSession.cs            # 会话数据模型
│   │   ├── wwwroot/                      # 从根目录复制的前端文件
│   │   │   ├── index.html
│   │   │   ├── css/style.css
│   │   │   └── js/*.js
│   │   └── python/
│   │       ├── decrypt_chat.py
│   │       └── requirements.txt
│   └── RelationshipTracker.Package/      # MSIX打包项目
│       └── ...
├── index.html                            # 网站入口（新增sessions视图支持）
├── js/
│   └── desktop.js                        # 新增：桌面专属JS模块
└── ...
```

---

### Task 1: Python 解密脚本 — 微信数据库读取与导出

**Files:**
- Create: `desktop/RelationshipTracker/python/decrypt_chat.py`
- Create: `desktop/RelationshipTracker/python/requirements.txt`

- [ ] **Step 1: 创建 requirements.txt**

```
pywxdump>=3.0.0
```

- [ ] **Step 2: 创建 decrypt_chat.py — list 模式**

```python
#!/usr/bin/env python3
"""
微信数据库解密与导出脚本
用法：
  python decrypt_chat.py --mode list              # 列出所有会话
  python decrypt_chat.py --mode export --wxid xxx  # 导出指定会话

输出为标准JSON到stdout，错误信息到stderr
"""
import sys
import json
import argparse


def get_sessions():
    """
    扫描微信数据库，返回所有聊天会话列表
    返回格式：[{wxid, nickname, msgCount, dateStart, dateEnd, avatarPath}]
    """
    try:
        from pywxdump import wx_dump
    except ImportError:
        # pywxdump 未安装时，先尝试安装
        print(json.dumps({
            "error": True,
            "type": "python_env",
            "message": "pywxdump 未安装。请运行: pip install pywxdump"
        }), flush=True)
        sys.exit(1)

    # pywxdump 的核心流程：解密DB → 读取会话信息
    # 注意：pywxdump 的 API 可能随版本变化，以下为典型调用方式

    try:
        # 获取微信进程信息和解密密钥
        wx_info = wx_dump.get_wechat_info()
        if not wx_info or not wx_info.get('wxid'):
            return {
                "error": True,
                "type": "not_running",
                "message": "微信未运行或未登录，请先登录微信PC版"
            }

        # 解密数据库
        db_paths = wx_dump.decrypt_databases(wx_info)

        # 读取所有会话
        sessions = wx_dump.get_all_sessions(db_paths)

        # 转换为标准格式
        result = []
        for s in sessions:
            result.append({
                "wxId": s.get("wxid", ""),
                "nickname": s.get("nickname", s.get("remark", "")),
                "messageCount": s.get("msg_count", 0),
                "dateStart": s.get("first_msg_time", ""),
                "dateEnd": s.get("last_msg_time", ""),
                "avatarPath": s.get("avatar_path", "")
            })

        return {"sessions": result}

    except FileNotFoundError:
        return {
            "error": True,
            "type": "not_installed",
            "message": "未检测到微信客户端，请先安装微信PC版"
        }
    except Exception as e:
        return {
            "error": True,
            "type": "decrypt_failed",
            "message": f"数据库读取失败: {str(e)}（微信版本可能已更新，请等待应用更新）"
        }


def export_chat(wxid):
    """
    导出指定会话的全部聊天消息
    返回格式：[{CreateTime, IsSender, StrContent, StrTalker, Type}, ...]
    """
    try:
        from pywxdump import wx_dump
    except ImportError:
        print(json.dumps({"error": True, "message": "pywxdump 未安装"}))
        sys.exit(1)

    try:
        wx_info = wx_dump.get_wechat_info()
        db_paths = wx_dump.decrypt_databases(wx_info)
        messages = wx_dump.get_chat_messages(db_paths, wxid)

        # 转换为 WeChatMsg 兼容格式（与前端 parser.js 预期一致）
        result = []
        for m in messages:
            result.append({
                "CreateTime": m.get("create_time", 0),
                "IsSender": 1 if m.get("is_sender", False) else 0,
                "StrContent": m.get("content", ""),
                "StrTalker": m.get("talker", wxid),
                "Type": m.get("msg_type", 1)
            })

        return {"messages": result}

    except Exception as e:
        return {"error": True, "message": str(e)}


def main():
    parser = argparse.ArgumentParser(description="微信聊天记录解密导出工具")
    parser.add_argument("--mode", required=True, choices=["list", "export"])
    parser.add_argument("--wxid", help="要导出的会话wxid（仅export模式需要）")

    args = parser.parse_args()

    if args.mode == "list":
        result = get_sessions()
    elif args.mode == "export":
        if not args.wxid:
            print(json.dumps({"error": True, "message": "export模式需要指定 --wxid"}))
            sys.exit(1)
        result = export_chat(args.wxid)

    # 输出JSON到stdout（C#通过Process.StandardOutput读取）
    print(json.dumps(result, ensure_ascii=False, default=str), flush=True)


if __name__ == "__main__":
    main()
```

**注意：** 以上代码基于 pywxdump 库的预期 API。实际 pywxdump 的精确 API 函数名（`wx_dump.get_wechat_info()`, `wx_dump.decrypt_databases()`, `wx_dump.get_all_sessions()`, `wx_dump.get_chat_messages()`）需要在开发时通过 `pip show pywxdump` + 阅读其源码确认精确调用方式。如果 API 有差异，以实际库为准调整函数名。

- [ ] **Step 3: 安装依赖并验证脚本**

```bash
cd "C:/programs/个人项目/relationship-tracker/desktop/RelationshipTracker/python"
pip install -r requirements.txt
python decrypt_chat.py --mode list
# 预期：输出JSON会话列表或错误信息
```

- [ ] **Step 4: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add desktop/RelationshipTracker/python/
git commit -m "feat: Python解密脚本 — pywxdump封装 + list/export两种模式"
```

---

### Task 2: 创建 WPF 项目骨架

**Files:**
- Create: `desktop/RelationshipTracker.sln`
- Create: `desktop/RelationshipTracker/RelationshipTracker.csproj`
- Create: `desktop/RelationshipTracker/App.xaml`
- Create: `desktop/RelationshipTracker/App.xaml.cs`

- [ ] **Step 1: 创建解决方案文件**

文件：`desktop/RelationshipTracker.sln`
```
Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.0.31903.59
MinimumVisualStudioVersion = 10.0.40219.1
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "RelationshipTracker", "RelationshipTracker\RelationshipTracker.csproj", "{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}"
EndProject
Global
	GlobalSection(SolutionConfigurationPlatforms) = preSolution
		Debug|x86 = Debug|x86
		Release|x86 = Release|x86
	EndGlobalSection
	GlobalSection(ProjectConfigurationPlatforms) = postSolution
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Debug|x86.ActiveCfg = Debug|x86
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Debug|x86.Build.0 = Debug|x86
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Release|x86.ActiveCfg = Release|x86
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Release|x86.Build.0 = Release|x86
	EndGlobalSection
EndGlobal
```

- [ ] **Step 2: 创建项目文件**

文件：`desktop/RelationshipTracker/RelationshipTracker.csproj`
```xml
<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="15.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <Import Project="$(MSBuildExtensionsPath)\$(MSBuildToolsVersion)\Microsoft.Common.props" />
  <PropertyGroup>
    <Configuration Condition=" '$(Configuration)' == '' ">Debug</Configuration>
    <Platform Condition=" '$(Platform)' == '' ">x86</Platform>
    <ProjectGuid>{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}</ProjectGuid>
    <OutputType>WinExe</OutputType>
    <RootNamespace>RelationshipTracker</RootNamespace>
    <AssemblyName>RelationshipTracker</AssemblyName>
    <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
    <FileAlignment>512</FileAlignment>
    <ProjectTypeGuids>{60dc8134-eba5-43b8-bcc9-bb4bc16c2548};{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}</ProjectTypeGuids>
    <WarningLevel>4</WarningLevel>
    <UseWPF>true</UseWPF>
    <AutoGenerateBindingRedirects>true</AutoGenerateBindingRedirects>
    <Deterministic>true</Deterministic>
  </PropertyGroup>
  <PropertyGroup Condition=" '$(Configuration)|$(Platform)' == 'Debug|x86' ">
    <PlatformTarget>x86</PlatformTarget>
    <DebugSymbols>true</DebugSymbols>
    <DebugType>full</DebugType>
    <Optimize>false</Optimize>
    <OutputPath>bin\Debug\</OutputPath>
    <DefineConstants>DEBUG;TRACE</DefineConstants>
    <ErrorReport>prompt</ErrorReport>
    <WarningLevel>4</WarningLevel>
  </PropertyGroup>
  <PropertyGroup Condition=" '$(Configuration)|$(Platform)' == 'Release|x86' ">
    <PlatformTarget>x86</PlatformTarget>
    <DebugType>pdbonly</DebugType>
    <Optimize>true</Optimize>
    <OutputPath>bin\Release\</OutputPath>
    <DefineConstants>TRACE</DefineConstants>
    <ErrorReport>prompt</ErrorReport>
    <WarningLevel>4</WarningLevel>
  </PropertyGroup>

  <!-- 构建时将根目录前端文件复制到wwwroot -->
  <Target Name="CopyWebAssets" BeforeTargets="BeforeBuild">
    <ItemGroup>
      <WebFiles Include="..\..\index.html" />
      <WebCss Include="..\..\css\**\*" />
      <WebJs Include="..\..\js\**\*" />
    </ItemGroup>
    <Copy SourceFiles="@(WebFiles)" DestinationFolder="wwwroot\" SkipUnchangedFiles="true" />
    <Copy SourceFiles="@(WebCss)" DestinationFolder="wwwroot\css\%(RecursiveDir)" SkipUnchangedFiles="true" />
    <Copy SourceFiles="@(WebJs)" DestinationFolder="wwwroot\js\%(RecursiveDir)" SkipUnchangedFiles="true" />
  </Target>

  <ItemGroup>
    <Reference Include="System" />
    <Reference Include="System.Core" />
    <Reference Include="System.Xaml" />
    <Reference Include="WindowsBase" />
    <Reference Include="PresentationCore" />
    <Reference Include="PresentationFramework" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2903.40" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>

  <ItemGroup>
    <Page Include="App.xaml" />
    <Page Include="MainWindow.xaml" />
    <Compile Include="App.xaml.cs" />
    <Compile Include="MainWindow.xaml.cs" />
    <Compile Include="Models\ChatSession.cs" />
    <Compile Include="Services\WeChatService.cs" />
    <Compile Include="Services\WebViewBridge.cs" />
  </ItemGroup>

  <ItemGroup>
    <Content Include="wwwroot\**\*">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </Content>
    <Content Include="python\**\*">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </Content>
  </ItemGroup>
</Project>
```

- [ ] **Step 3: 创建 App.xaml**

```xml
<Application x:Class="RelationshipTracker.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
    <Application.Resources>
        <!-- 暗色主题资源（用于WPF原生控件的后备样式） -->
        <SolidColorBrush x:Key="BgPrimary" Color="#0f0f1a" />
        <SolidColorBrush x:Key="AccentColor" Color="#e85d75" />
    </Application.Resources>
</Application>
```

- [ ] **Step 4: 创建 App.xaml.cs**

```csharp
using System.Windows;

namespace RelationshipTracker
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // 确保 WebView2 Runtime 可用
            // WebView2 控件初始化时会自动检测，这里仅做提前检测
            try
            {
                var version = Microsoft.Web.WebView2.Core.CoreWebView2Environment
                    .GetAvailableBrowserVersionString();
            }
            catch (Microsoft.Web.WebView2.Core.WebView2RuntimeNotFoundException)
            {
                MessageBox.Show(
                    "未检测到 WebView2 运行时。\n\n" +
                    "请下载并安装：https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                    "缺少运行时",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
                Shutdown();
            }
        }
    }
}
```

- [ ] **Step 5: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add desktop/RelationshipTracker.sln desktop/RelationshipTracker/RelationshipTracker.csproj
git add desktop/RelationshipTracker/App.xaml desktop/RelationshipTracker/App.xaml.cs
git commit -m "feat: WPF项目骨架 — .NET Framework 4.8 + WebView2引用"
```

---

### Task 3: MainWindow — 全屏 WebView2 窗口

**Files:**
- Create: `desktop/RelationshipTracker/MainWindow.xaml`
- Create: `desktop/RelationshipTracker/MainWindow.xaml.cs`

- [ ] **Step 1: 创建 MainWindow.xaml**

```xml
<Window x:Class="RelationshipTracker.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:wv2="clr-namespace:Microsoft.Web.WebView2.Wpf;assembly=Microsoft.Web.WebView2.Wpf"
        Title="💕 我们的故事"
        Width="1400" Height="900"
        MinWidth="960" MinHeight="640"
        WindowStartupLocation="CenterScreen"
        Background="#0f0f1a"
        Loaded="MainWindow_Loaded"
        Closing="MainWindow_Closing">

    <!-- 全屏无边框内容区：仅一个WebView2控件 -->
    <Grid>
        <wv2:WebView2 x:Name="WebView"
                       HorizontalAlignment="Stretch"
                       VerticalAlignment="Stretch" />
    </Grid>
</Window>
```

- [ ] **Step 2: 创建 MainWindow.xaml.cs**

```csharp
using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using RelationshipTracker.Services;

namespace RelationshipTracker
{
    public partial class MainWindow : Window
    {
        private WebViewBridge _bridge;
        private WeChatService _weChatService;

        public MainWindow()
        {
            InitializeComponent();

            _weChatService = new WeChatService();
            _bridge = new WebViewBridge();
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await InitializeWebViewAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            // 初始化 WebView2 环境（用户数据目录在 AppData）
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "RelationshipTracker",
                "WebView2"
            );

            var env = await CoreWebView2Environment.CreateAsync(
                userDataFolder: userDataFolder
            );
            await WebView.EnsureCoreWebView2Async(env);

            // 注册 C# -> JS 通信桥
            _bridge.Initialize(WebView, _weChatService);

            // 找到 wwwroot/index.html 的路径
            var wwwrootPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "wwwroot"
            );
            var indexPath = Path.Combine(wwwrootPath, "index.html");

            if (File.Exists(indexPath))
            {
                // 通过 file:// 协议加载本地文件
                WebView.CoreWebView2.Navigate(new Uri(indexPath).AbsoluteUri);
            }
            else
            {
                // wwwroot 不存在：可能首次运行，显示兜底页面或引导
                WebView.CoreWebView2.NavigateToString(
                    "<html><body style='background:#0f0f1a;color:#e8e8ed;font-family:sans-serif;" +
                    "display:flex;align-items:center;justify-content:center;height:100vh;'>" +
                    "<div style='text-align:center;'><h2>⚠️ 前端资源未找到</h2>" +
                    "<p>请确保 wwwroot 目录存在于应用目录下</p></div>" +
                    "</body></html>"
                );
            }

            // 设置 WebView2 背景色与主题一致
            WebView.CoreWebView2.Profile.PreferredColorScheme =
                CoreWebView2PreferredColorScheme.Dark;
        }

        private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            // 清理资源
            WebView?.Dispose();
        }
    }
}
```

- [ ] **Step 3: 创建占位 Model 和 Service 文件**

文件：`desktop/RelationshipTracker/Models/ChatSession.cs`
```csharp
using Newtonsoft.Json;

namespace RelationshipTracker.Models
{
    /// <summary>
    /// 微信聊天会话数据模型
    /// </summary>
    public class ChatSession
    {
        [JsonProperty("wxId")]
        public string WxId { get; set; }

        [JsonProperty("nickname")]
        public string Nickname { get; set; }

        [JsonProperty("messageCount")]
        public int MessageCount { get; set; }

        [JsonProperty("dateStart")]
        public string DateStart { get; set; }

        [JsonProperty("dateEnd")]
        public string DateEnd { get; set; }

        [JsonProperty("avatarPath")]
        public string AvatarPath { get; set; }
    }

    /// <summary>
    /// 会话列表响应
    /// </summary>
    public class SessionListResponse
    {
        [JsonProperty("sessions")]
        public ChatSession[] Sessions { get; set; }

        [JsonProperty("error")]
        public bool Error { get; set; }

        [JsonProperty("type")]
        public string ErrorType { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }
    }

    /// <summary>
    /// 消息导出响应
    /// </summary>
    public class ExportResponse
    {
        [JsonProperty("messages")]
        public object[] Messages { get; set; }

        [JsonProperty("error")]
        public bool Error { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }
    }
}
```

- [ ] **Step 4: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add desktop/RelationshipTracker/MainWindow.xaml desktop/RelationshipTracker/MainWindow.xaml.cs
git add desktop/RelationshipTracker/Models/ChatSession.cs
git commit -m "feat: MainWindow — 全屏WebView2 + index.html加载"
```

---

### Task 4: WeChatService — Python 进程管理

**Files:**
- Create: `desktop/RelationshipTracker/Services/WeChatService.cs`

- [ ] **Step 1: 创建 WeChatService.cs**

```csharp
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using Newtonsoft.Json;

namespace RelationshipTracker.Services
{
    /// <summary>
    /// 微信数据库解密服务
    /// 通过启动Python子进程调用pywxdump实现数据库读取
    /// </summary>
    public class WeChatService
    {
        private string PythonScriptPath =>
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "python", "decrypt_chat.py");

        /// <summary>
        /// Python可执行文件路径。
        /// 优先使用嵌入的Python运行时，其次使用系统PATH中的python。
        /// </summary>
        private string PythonExePath
        {
            get
            {
                // 嵌入的Python（打包后）
                var embedded = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory, "python", "runtime", "python.exe");
                if (File.Exists(embedded)) return embedded;

                // 调试阶段：优先使用系统python3，其次python
                return "python";
            }
        }

        /// <summary>
        /// 执行Python脚本并返回stdout输出
        /// </summary>
        private string RunScript(string arguments)
        {
            var psi = new ProcessStartInfo
            {
                FileName = PythonExePath,
                Arguments = $"\"{PythonScriptPath}\" {arguments}",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(PythonScriptPath)
            };

            using (var process = Process.Start(psi))
            {
                var output = process.StandardOutput.ReadToEnd();
                var error = process.StandardError.ReadToEnd();
                process.WaitForExit(30000); // 30秒超时

                if (!string.IsNullOrEmpty(error))
                {
                    // stderr 中的非错误日志当作调试信息处理
                    Debug.WriteLine($"[Python stderr] {error}");
                }

                return output;
            }
        }

        /// <summary>
        /// 扫描所有微信聊天会话
        /// </summary>
        public Models.SessionListResponse GetSessions()
        {
            try
            {
                var json = RunScript("--mode list");
                return JsonConvert.DeserializeObject<Models.SessionListResponse>(json)
                       ?? new Models.SessionListResponse { Error = true, Message = "解析响应失败" };
            }
            catch (Win32Exception ex) when (ex.Message.Contains("python"))
            {
                return new Models.SessionListResponse
                {
                    Error = true,
                    ErrorType = "python_missing",
                    Message = "Python环境未配置，请确保已安装Python 3"
                };
            }
            catch (Exception ex)
            {
                return new Models.SessionListResponse
                {
                    Error = true,
                    ErrorType = "unknown",
                    Message = $"扫描失败: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// 导出指定会话的全部聊天消息
        /// </summary>
        public Models.ExportResponse ExportChat(string wxid)
        {
            try
            {
                var json = RunScript($"--mode export --wxid {wxid}");
                return JsonConvert.DeserializeObject<Models.ExportResponse>(json)
                       ?? new Models.ExportResponse { Error = true, Message = "解析响应失败" };
            }
            catch (Exception ex)
            {
                return new Models.ExportResponse
                {
                    Error = true,
                    Message = $"导出失败: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// 检查系统是否安装了Python
        /// </summary>
        public bool IsPythonAvailable()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = PythonExePath,
                    Arguments = "--version",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };
                using (var p = Process.Start(psi))
                {
                    p.WaitForExit(5000);
                    return p.ExitCode == 0;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
```

- [ ] **Step 2: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add desktop/RelationshipTracker/Services/WeChatService.cs
git commit -m "feat: WeChatService — Python子进程管理 + 会话扫描/导出"
```

---

### Task 5: WebViewBridge — C# ↔ JS 双向通信

**Files:**
- Create: `desktop/RelationshipTracker/Services/WebViewBridge.cs`

- [ ] **Step 1: 创建 WebViewBridge.cs**

```csharp
using System;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Newtonsoft.Json;

namespace RelationshipTracker.Services
{
    /// <summary>
    /// C# ↔ JavaScript 双向通信桥
    /// 注册 C# 方法供 JS 调用，提供方法向 JS 推送数据
    /// </summary>
    public class WebViewBridge
    {
        private WebView2 _webView;
        private WeChatService _weChatService;
        private bool _isInitialized;

        /// <summary>
        /// 初始化通信桥，注册所有 JS→C# 的 handler
        /// </summary>
        public void Initialize(WebView2 webView, WeChatService weChatService)
        {
            _webView = webView;
            _weChatService = weChatService;

            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            _isInitialized = true;
        }

        /// <summary>
        /// 处理来自 JS 的消息
        /// 消息格式：{ "action": "scanSessions|exportChat|checkPython", "wxid": "..." }
        /// </summary>
        private async void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var json = e.TryGetWebMessageAsString();
                var msg = JsonConvert.DeserializeObject<JsMessage>(json);

                switch (msg.Action)
                {
                    case "scanSessions":
                        await HandleScanSessions();
                        break;

                    case "exportChat":
                        await HandleExportChat(msg.WxId);
                        break;

                    case "checkPython":
                        await HandleCheckPython();
                        break;
                }
            }
            catch (Exception ex)
            {
                await PushToJs("RLT.onError",
                    JsonConvert.SerializeObject(new { type = "bridge_error", message = ex.Message }));
            }
        }

        /// <summary>
        /// 处理扫描会话请求
        /// </summary>
        private async Task HandleScanSessions()
        {
            // 通知前端：开始扫描
            await PushToJs("RLT.desktop.onScanStart");

            // 在后台线程执行 Python 调用（避免阻塞UI）
            var result = await Task.Run(() => _weChatService.GetSessions());

            // 推送结果给JS
            var json = JsonConvert.SerializeObject(result);
            await PushToJs("RLT.desktop.onSessionsReady", json);
        }

        /// <summary>
        /// 处理导出聊天请求
        /// </summary>
        private async Task HandleExportChat(string wxid)
        {
            if (string.IsNullOrEmpty(wxid))
            {
                await PushToJs("RLT.desktop.onChatExportError",
                    "\"wxid 不能为空\"");
                return;
            }

            // 通知前端：开始导出
            await PushToJs("RLT.desktop.onExportStart", $"\"{wxid}\"");

            // 在后台线程执行
            var result = await Task.Run(() => _weChatService.ExportChat(wxid));

            if (result.Error)
            {
                await PushToJs("RLT.desktop.onChatExportError",
                    JsonConvert.SerializeObject(result.Message));
            }
            else
            {
                // 推送完整消息JSON给前端
                var json = JsonConvert.SerializeObject(result.Messages);
                await PushToJs("RLT.desktop.onChatExported", json);
            }
        }

        /// <summary>
        /// 检查Python是否可用
        /// </summary>
        private async Task HandleCheckPython()
        {
            var available = _weChatService.IsPythonAvailable();
            await PushToJs("RLT.desktop.onPythonCheck",
                available ? "true" : "false");
        }

        /// <summary>
        /// 向JS端推送数据
        /// 调用 window.RLT.desktop.onXxx(data) 方法
        /// </summary>
        private async Task PushToJs(string functionName, string jsonArg = null)
        {
            if (!_isInitialized || _webView?.CoreWebView2 == null) return;

            var script = jsonArg != null
                ? $"{functionName}({jsonArg})"
                : $"{functionName}()";

            await _webView.CoreWebView2.ExecuteScriptAsync(script);
        }

        /// <summary>
        /// JS→C# 消息格式
        /// </summary>
        private class JsMessage
        {
            [JsonProperty("action")]
            public string Action { get; set; }

            [JsonProperty("wxid")]
            public string WxId { get; set; }
        }
    }
}
```

- [ ] **Step 2: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add desktop/RelationshipTracker/Services/WebViewBridge.cs
git commit -m "feat: WebViewBridge — C#↔JS双向通信 + 异步Python调用"
```

---

### Task 6: desktop.js — 桌面专属前端模块

**Files:**
- Create: `js/desktop.js`

- [ ] **Step 1: 创建 desktop.js**

```javascript
// js/desktop.js — 桌面应用专属模块
// 仅在 WebView2 环境中激活，普通浏览器中自动跳过
window.RLT = window.RLT || {};

RLT.desktop = (function() {

  // 检测是否在 WebView2 环境中运行
  var isDesktop = (function() {
    try {
      return window.chrome && window.chrome.webview !== undefined;
    } catch (e) {
      return false;
    }
  })();

  /**
   * 向 C# 后台发送消息
   * @param {string} action - 动作名称
   * @param {string} wxid - 可选，微信ID
   */
  function sendToHost(action, wxid) {
    if (!isDesktop) return;
    var msg = { action: action };
    if (wxid) msg.wxid = wxid;
    window.chrome.webview.postMessage(JSON.stringify(msg));
  }

  /**
   * 扫描微信会话列表
   */
  function scanSessions() {
    sendToHost('scanSessions');
  }

  /**
   * 导出指定会话的聊天记录
   * @param {string} wxid - 微信ID
   */
  function exportChat(wxid) {
    sendToHost('exportChat', wxid);
  }

  /**
   * 检查Python环境
   */
  function checkPython() {
    sendToHost('checkPython');
  }

  // ============================================================
  // C# → JS 回调函数（由 WebViewBridge.ExecuteScriptAsync 调用）
  // ============================================================

  /**
   * 扫描开始回调
   */
  RLT.desktop.onScanStart = function() {
    var event = new CustomEvent('desktop:scanStart');
    window.dispatchEvent(event);
  };

  /**
   * 会话列表就绪回调
   * @param {object} response - { sessions: [...], error: bool, message: string }
   */
  RLT.desktop.onSessionsReady = function(response) {
    var event = new CustomEvent('desktop:sessionsReady', { detail: response });
    window.dispatchEvent(event);
  };

  /**
   * 导出开始回调
   */
  RLT.desktop.onExportStart = function(wxid) {
    var event = new CustomEvent('desktop:exportStart', { detail: wxid });
    window.dispatchEvent(event);
  };

  /**
   * 聊天数据导出完成回调
   * @param {Array} messages - WeChatMsg兼容格式的消息数组
   */
  RLT.desktop.onChatExported = function(messages) {
    var event = new CustomEvent('desktop:chatExported', { detail: messages });
    window.dispatchEvent(event);

    // 自动触发分析流程（复用现有的 onDataLoaded 逻辑）
    var result = RLT.parser.parse(JSON.stringify(messages));
    if (result.success && window.__appState) {
      // 通知 Vue 应用进行数据分析
      window.__appState.meta = result.data.meta;
      window.__appState.messages = result.data.messages;
      window.__appState.runAnalysis();
    }
  };

  /**
   * 导出错误回调
   */
  RLT.desktop.onChatExportError = function(message) {
    var event = new CustomEvent('desktop:error', {
      detail: { type: 'export', message: message }
    });
    window.dispatchEvent(event);
  };

  /**
   * Python检查回调
   */
  RLT.desktop.onPythonCheck = function(available) {
    var event = new CustomEvent('desktop:pythonCheck', { detail: available });
    window.dispatchEvent(event);
  };

  // 全局错误处理
  RLT.onError = function(type, message) {
    var event = new CustomEvent('desktop:error', {
      detail: { type: type, message: message }
    });
    window.dispatchEvent(event);
  };

  return {
    isDesktop: isDesktop,
    scanSessions: scanSessions,
    exportChat: exportChat,
    checkPython: checkPython
  };
})();
```

- [ ] **Step 2: 更新 index.html 添加 desktop.js 引用**

在 `index.html` 的 JS 加载顺序中，`desktop.js` 应该在 `app.js` **之前**加载（因为 app.js 需要在 mounted 时检测桌面环境并调用 scanSessions）。

`index.html` 的 script 标签顺序更新为：
```html
<script src="js/storage.js"></script>
<script src="js/parser.js"></script>
<script src="js/stats.js"></script>
<script src="js/ai.js"></script>
<script src="js/charts.js"></script>
<script src="js/timeline.js"></script>
<script src="js/desktop.js"></script>    <!-- 新增 -->
<script src="js/app.js"></script>
```

- [ ] **Step 3: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add js/desktop.js
git commit -m "feat: desktop.js — 桌面专属JS模块 + C#↔JS通信层"
```

---

### Task 7: 前端会话选择页

**Files:**
- Modify: `js/app.js` — 新增 sessions 视图 + 桌面启动逻辑
- Modify: `index.html` — 新增 desktop.js 引用 + sessions 视图模板
- Modify: `css/style.css` — 新增会话卡片样式

- [ ] **Step 1: 新增 CSS 会话卡片样式**

追加到 `css/style.css` 末尾：

```css
/* === 会话选择页 === */
.sessions-view {
  padding: 40px 24px;
  max-width: 720px;
  margin: 0 auto;
}

.sessions-header {
  text-align: center;
  margin-bottom: 32px;
}

.sessions-header h2 {
  font-size: 24px;
  margin-bottom: 8px;
}

.sessions-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  margin-top: 12px;
}

.sessions-status.scanning {
  background: var(--accent-dim);
  color: var(--accent);
}

.sessions-status.success {
  background: rgba(76, 175, 80, 0.15);
  color: var(--success);
}

.sessions-status.error {
  background: rgba(232, 93, 117, 0.15);
  color: var(--accent);
}

.session-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 20px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.session-card:hover {
  border-color: var(--accent);
  background: var(--bg-card-hover, #1e1e35);
  transform: translateX(4px);
}

.session-card .avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.session-card .session-info {
  flex: 1;
  min-width: 0;
}

.session-card .session-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.session-card .session-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.session-card .session-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  text-align: right;
  white-space: nowrap;
}

.session-card .session-arrow {
  color: var(--text-muted);
  font-size: 18px;
}

/* 手动导入入口 */
.manual-import-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  text-align: center;
}

.manual-import-section p {
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 12px;
}
```

- [ ] **Step 2: 在 app.js 中新增 sessions 视图逻辑**

在 `app.js` 的 Vue setup 中新增：

```javascript
// 新增状态
const currentView = ref(RLT.desktop && RLT.desktop.isDesktop ? 'sessions' : 'import');
const sessionsLoading = ref(false);
const sessions = ref([]);
const sessionsStatus = ref('');
const sessionsError = ref('');
const sessionsStatusType = ref('scanning'); // scanning | success | error

// 桌面环境下，启动时自动扫描会话
onMounted(() => {
  // ... 原有恢复逻辑 ...

  // 如果是在桌面环境，自动扫描微信会话
  if (RLT.desktop && RLT.desktop.isDesktop) {
    // 先检查是否已有之前的分析数据
    const savedMeta = RLT.storage.load(RLT.storage.KEYS.CHAT_META);
    if (savedMeta) {
      // 有历史数据，直接进入仪表盘
      currentView.value = 'dashboard';
    } else {
      // 首次启动，显示会话选择页并自动扫描
      currentView.value = 'sessions';
      scanWeChatSessions();
    }
  }
});

// 扫描微信会话
function scanWeChatSessions() {
  sessionsLoading.value = true;
  sessionsStatus.value = '正在扫描微信聊天记录...';
  sessionsStatusType.value = 'scanning';

  // 监听扫描结果
  window.addEventListener('desktop:sessionsReady', function onReady(e) {
    window.removeEventListener('desktop:sessionsReady', onReady);
    sessionsLoading.value = false;

    var response = e.detail;
    if (response.error) {
      sessionsStatus.value = response.message || '扫描失败';
      sessionsStatusType.value = 'error';
      sessionsError.value = response.type || 'unknown';
    } else if (!response.sessions || response.sessions.length === 0) {
      sessionsStatus.value = '未找到聊天记录';
      sessionsStatusType.value = 'error';
    } else {
      sessions.value = response.sessions;
      sessionsStatus.value = '已找到 ' + response.sessions.length + ' 个聊天会话';
      sessionsStatusType.value = 'success';
    }
  });

  window.addEventListener('desktop:error', function onErr(e) {
    window.removeEventListener('desktop:error', onErr);
    sessionsLoading.value = false;
    sessionsStatus.value = e.detail.message;
    sessionsStatusType.value = 'error';
  });

  RLT.desktop.scanSessions();
}

// 选择会话并导出
function selectSession(wxid) {
  // 通知前端开始导出
  sessionsStatus.value = '正在导出聊天记录...';
  sessionsStatusType.value = 'scanning';
  sessionsLoading.value = true;
  RLT.desktop.exportChat(wxid);
}

// 导出完成后由 RLT.desktop.onChatExported 自动触发分析
// 并切换到仪表盘视图
```

在 return 中暴露新增状态：
```javascript
return {
  // ... 原有 ...
  sessions, sessionsLoading, sessionsStatus, sessionsStatusType, sessionsError,
  scanWeChatSessions, selectSession
};
```

- [ ] **Step 3: 在 index.html 中新增 sessions 视图模板**

```html
<!-- 会话选择页 -->
<div v-if="currentView === 'sessions'" class="sessions-view">
  <div class="sessions-header">
    <h2>💌 选择要分析的聊天</h2>
    <div class="sessions-status" :class="sessionsStatusType">
      <span v-if="sessionsLoading" class="spinner" style="width:16px;height:16px;border-width:2px;"></span>
      {{ sessionsStatus }}
    </div>
  </div>

  <!-- 会话卡片列表 -->
  <div>
    <div v-for="s in sessions" :key="s.wxId"
         class="session-card"
         @click="selectSession(s.wxId)">
      <div class="avatar">🧑</div>
      <div class="session-info">
        <div class="session-name">{{ s.nickname }}</div>
        <div class="session-meta">📅 {{ s.dateStart }} ~ {{ s.dateEnd }}</div>
      </div>
      <div class="session-count">{{ s.messageCount.toLocaleString() }} 条</div>
      <div class="session-arrow">›</div>
    </div>
  </div>

  <!-- 手动导入入口 -->
  <div class="manual-import-section">
    <p>或手动拖入 WeChatMsg 导出的 JSON 文件</p>
    <button class="btn-primary" @click="currentView = 'import'" style="font-size:14px;">📁 导入 JSON 文件</button>
  </div>
</div>
```

- [ ] **Step 4: 更新 index.html 的 JS 加载顺序**

在 `index.html` 底部，`desktop.js` 必须在 `app.js` 之前：
```html
<script src="js/storage.js"></script>
<script src="js/parser.js"></script>
<script src="js/stats.js"></script>
<script src="js/ai.js"></script>
<script src="js/charts.js"></script>
<script src="js/timeline.js"></script>
<script src="js/desktop.js"></script>
<script src="js/app.js"></script>
```

- [ ] **Step 5: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add -A
git commit -m "feat: 会话选择页 — sessions视图 + 卡片UI + 桌面自动扫描"
```

---

### Task 8: 集成联调 & 错误处理

**Files:**
- Modify: `desktop/RelationshipTracker/MainWindow.xaml.cs`
- Modify: `desktop/RelationshipTracker/Services/WeChatService.cs`

- [ ] **Step 1: 增强 WeChatService 的异常分类**

在 `WeChatService.GetSessions()` 中，针对不同错误类型返回更精确的 `errorType`：

| errorType | 触发条件 | 前端显示 |
|-----------|---------|---------|
| `not_installed` | Python 脚本返回 FileNotFoundError | "未检测到微信客户端" |
| `not_running` | 微信进程未运行 | "微信未运行或未登录" |
| `decrypt_failed` | 数据库解密异常 | "版本可能已更新" + 手动入口 |
| `python_missing` | Python 未安装 | "Python环境缺失" |
| `python_env` | pywxdump 未安装 | "缺少依赖: pywxdump" |

- [ ] **Step 2: 添加 Python/pip 自动安装引导**

在 `WeChatService` 中添加：

```csharp
/// <summary>
/// 尝试安装Python依赖
/// </summary>
public bool TryInstallDependencies()
{
    try
    {
        var psi = new ProcessStartInfo
        {
            FileName = PythonExePath,
            Arguments = $"-m pip install -r \"{Path.Combine(Path.GetDirectoryName(PythonScriptPath), "requirements.txt")}\"",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            CreateNoWindow = true
        };
        using (var p = Process.Start(psi))
        {
            p.WaitForExit(60000);
            return p.ExitCode == 0;
        }
    }
    catch
    {
        return false;
    }
}
```

- [ ] **Step 3: 在 WebViewBridge 中处理 scanSessions 失败时的降级逻辑**

```csharp
private async Task HandleScanSessions()
{
    await PushToJs("RLT.desktop.onScanStart");

    // 先检查Python
    if (!_weChatService.IsPythonAvailable())
    {
        await PushToJs("RLT.desktop.onSessionsReady",
            JsonConvert.SerializeObject(new
            {
                error = true,
                type = "python_missing",
                message = "Python环境未配置。应用首次运行需要安装Python依赖，请在命令行执行：pip install pywxdump"
            }));
        return;
    }

    var result = await Task.Run(() => _weChatService.GetSessions());
    var json = JsonConvert.SerializeObject(result);
    await PushToJs("RLT.desktop.onSessionsReady", json);
}
```

- [ ] **Step 4: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add -A
git commit -m "feat: 集成联调 — 异常分类 + Python依赖引导 + 降级逻辑"
```

---

### Task 9: README 更新 + 本地运行文档

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`

- [ ] **Step 1: 更新 README 添加桌面应用章节**

在中文 README 末尾追加：

```markdown
---

## 🖥️ 桌面应用

除了在线网页版，还提供 **WPF 桌面应用**，可以一键从微信本地数据库直接读取聊天记录，无需手动导出 JSON。

### 特性

- 🔐 **自动解密** — 直接从微信本地数据库读取，无需 WeChatMsg
- 💬 **会话选择** — 列出所有微信聊天会话，点击即可分析
- 🎨 **全屏 WebView2** — 所有 UI 为精美网页渲染，与在线版视觉一致
- 📦 **独立运行** — 所有分析在本地完成，数据不离开电脑

### 构建运行

```bash
# 1. 安装 Python 依赖
cd desktop/RelationshipTracker/python
pip install -r requirements.txt

# 2. 用 Visual Studio 打开解决方案
# desktop/RelationshipTracker.sln

# 3. 生成 → 运行
```

### 打包

使用 Visual Studio 的 MSIX 打包项目生成安装包，用户无需安装 Python 或 WebView2 Runtime。
```

英文版同理。

- [ ] **Step 2: 提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add README.md README_EN.md
git commit -m "docs: README新增桌面应用章节"
```

---

### Task 10: 最终验证

- [ ] **Step 1: 检查项目结构完整性**

```bash
cd "C:/programs/个人项目/relationship-tracker"
echo "=== 网站前端 ===" && ls -la index.html js/*.js css/*.css
echo "=== 桌面应用 ===" && ls -la desktop/RelationshipTracker.sln desktop/RelationshipTracker/*.csproj
echo "=== Python脚本 ===" && ls -la desktop/RelationshipTracker/python/
echo "=== Git提交 ===" && git log --oneline
```

- [ ] **Step 2: 确认 .gitignore 更新**

确保 `.gitignore` 排除了构建产物：
```
# WPF构建产物
desktop/RelationshipTracker/bin/
desktop/RelationshipTracker/obj/
desktop/RelationshipTracker.Package/bin/
desktop/RelationshipTracker.Package/obj/

# Python缓存
__pycache__/
*.pyc
*.pyo
```

- [ ] **Step 3: 最终提交**

```bash
cd "C:/programs/个人项目/relationship-tracker"
git add -A
git commit -m "chore: 最终验证 — 项目完整性 + .gitignore更新"
git push
```

---

## 实现要点

### 开发前提

Python 脚本 `decrypt_chat.py` 依赖 pywxdump 库，该库的 API 随版本变化。开发时需要：
1. `pip install pywxdump`
2. 在命令行手动调用验证：`python decrypt_chat.py --mode list`
3. 根据实际返回调整 `GetSessions()` 和 `ExportChat()` 中的 JSON 解析

### WebView2 调试

开发阶段可以启用 WebView2 DevTools：
```csharp
// 在 MainWindow.xaml.cs 的 InitializeWebViewAsync 末尾添加：
WebView.CoreWebView2.OpenDevToolsWindow();
```

### 前端调试

桌面环境变量检测在 `desktop.js` 中，可以在普通浏览器中通过设置 `window.chrome = { webview: { postMessage: console.log } }` 模拟通信。

### 打包注意事项

- Python 脚本通过 PyInstaller 打包为独立 exe，放置在 `python/runtime/` 目录
- WebView2 Runtime 通过 MSIX 安装程序的 Dependency 声明自动检测安装
- wwwroot 目录在 Build 时自动从项目根目录复制，无需手动维护
