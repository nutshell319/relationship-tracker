using System;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Newtonsoft.Json;

namespace RelationshipTracker.Services
{
    /// <summary>
    /// C# 与 JavaScript 双向通信桥梁。
    /// 负责接收 WebView2 中 JS 端通过 window.chrome.webview.postMessage 发送的消息，
    /// 解析 action 字段后调度 WeChatService 在后台线程执行对应操作，
    /// 并通过 ExecuteScriptAsync 将结果推回 JS 端的 RLT.desktop 命名空间。
    /// </summary>
    public class WebViewBridge
    {
        /// <summary>承载前端页面的 WebView2 控件引用</summary>
        private WebView2 _webView;

        /// <summary>微信数据服务实例，负责实际的数据库操作</summary>
        private WeChatService _weChatService;

        /// <summary>
        /// 初始化通信桥梁，绑定 WebView2 的 WebMessageReceived 事件。
        /// 必须在 WebView2.CoreWebView2 初始化完成后调用。
        /// </summary>
        /// <param name="webView">承载前端页面的 WebView2 控件</param>
        /// <param name="weChatService">微信数据服务实例</param>
        public void Initialize(WebView2 webView, WeChatService weChatService)
        {
            _webView = webView ?? throw new ArgumentNullException(nameof(webView));
            _weChatService = weChatService ?? throw new ArgumentNullException(nameof(weChatService));

            // 订阅 JS 端发送的消息事件
            _webView.WebMessageReceived += OnWebMessageReceived;
        }

        /// <summary>
        /// WebView2 消息接收回调。
        /// 解析 JS 端发来的 JSON 消息，根据 action 字段分发到对应的处理函数。
        /// 整个消息处理流程包裹在 try-catch 中，异常通过 RLT.onError 推回 JS 端。
        /// </summary>
        /// <param name="sender">事件源（WebView2 控件）</param>
        /// <param name="e">包含 WebMessageAsJson 及 TryGetWebMessageAsString 的事件参数</param>
        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                // 从事件参数中提取字符串形式的消息体
                var rawMessage = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(rawMessage))
                {
                    return;
                }

                // 反序列化为 JsMessage 对象，解析 action 和 wxid
                var msg = JsonConvert.DeserializeObject<JsMessage>(rawMessage);
                if (msg == null || string.IsNullOrEmpty(msg.Action))
                {
                    return;
                }

                // 根据 action 分发到对应的处理方法
                switch (msg.Action)
                {
                    case "scanSessions":
                        HandleScanSessions();
                        break;
                    case "exportChat":
                        HandleExportChat(msg.WxId);
                        break;
                    case "checkPython":
                        HandleCheckPython();
                        break;
                    // 未识别的 action 静默忽略，避免未知消息导致错误提示
                }
            }
            catch (Exception ex)
            {
                // 消息解析或分发过程中的任何异常均推送到 JS 端展示
                PushError(ex.Message);
            }
        }

        /// <summary>
        /// 处理"扫描会话列表"请求。
        /// 先通知 JS 端开始扫描，再在后台线程调用 WeChatService.GetSessions，
        /// 将完整的 SessionListResponse 序列化后推送到 RLT.desktop.onSessionsReady。
        /// </summary>
        private async void HandleScanSessions()
        {
            try
            {
                // 通知前端扫描已开始，可展示 loading 状态
                await PushToJs("RLT.desktop.onScanStart");

                // 在后台线程执行扫描，避免阻塞 UI
                var result = await Task.Run(() => _weChatService.GetSessions());

                // 将完整响应（含 error 字段）序列化推送给前端自行判断
                var json = JsonConvert.SerializeObject(result);
                await PushToJs("RLT.desktop.onSessionsReady", json);
            }
            catch (Exception ex)
            {
                PushError($"扫描会话失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 处理"导出聊天记录"请求。
        /// 先通知 JS 端开始导出（附带 wxid 便于前端展示进度），
        /// 再在后台线程调用 WeChatService.ExportChat，
        /// 根据返回结果中的 Error 字段分别推送到 onChatExported 或 onChatExportError。
        /// </summary>
        /// <param name="wxid">目标微信用户的唯一标识符</param>
        private async void HandleExportChat(string wxid)
        {
            try
            {
                // 校验 wxid 不为空，避免无效调用
                if (string.IsNullOrEmpty(wxid))
                {
                    PushError("导出失败: 缺少 wxid 参数");
                    return;
                }

                // 通知前端导出已开始，附带 wxid 便于展示当前导出的会话
                // 使用双引号包裹 wxid 字符串，确保 JS 端正确解析
                await PushToJs("RLT.desktop.onExportStart", $"\"{wxid}\"");

                // 在后台线程执行导出，避免阻塞 UI
                var result = await Task.Run(() => _weChatService.ExportChat(wxid));

                if (result.Error)
                {
                    // 导出失败 — 推送错误消息到专用的错误回调
                    await PushToJs("RLT.desktop.onChatExportError", $"\"{result.Message}\"");
                }
                else
                {
                    // 导出成功 — 推送完整的 ExportResponse 到前端
                    var json = JsonConvert.SerializeObject(result);
                    await PushToJs("RLT.desktop.onChatExported", json);
                }
            }
            catch (Exception ex)
            {
                PushError($"导出聊天记录失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 处理"检测 Python 环境"请求。
        /// 在后台线程调用 WeChatService.IsPythonAvailable，
        /// 将布尔值推送到 RLT.desktop.onPythonCheck。
        /// </summary>
        private async void HandleCheckPython()
        {
            try
            {
                // 在后台线程执行 Python 可用性检测，避免阻塞 UI
                var available = await Task.Run(() => _weChatService.IsPythonAvailable());

                // 推送布尔值（小写 true/false）给前端
                var boolStr = available ? "true" : "false";
                await PushToJs("RLT.desktop.onPythonCheck", boolStr);
            }
            catch (Exception ex)
            {
                PushError($"Python 环境检测失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 向 JS 端推送函数调用的核心方法。
        /// 通过 CoreWebView2.ExecuteScriptAsync 在 WebView 中执行 JS 脚本，
        /// 整个调用放在 Task.Run 中避免阻塞 UI 线程。
        /// </summary>
        /// <param name="functionName">
        /// JS 端完整的函数名（含命名空间），如 "RLT.desktop.onSessionsReady"
        /// </param>
        /// <param name="jsonArg">
        /// 传递给 JS 函数的 JSON 参数。
        /// 为 null 时不传参（调用无参函数）；
        /// 为字符串时直接拼接为 JS 函数调用的实参。
        /// </param>
        private async Task PushToJs(string functionName, string jsonArg = null)
        {
            // CoreWebView2 尚未初始化完成时无法执行脚本，静默返回
            if (_webView?.CoreWebView2 == null)
            {
                return;
            }

            // 将脚本执行放到后台线程，避免阻塞 UI 线程的消息泵
            await Task.Run(async () =>
            {
                // 进入后台线程后再次检查，防止执行过程中 WebView 被销毁
                if (_webView?.CoreWebView2 == null)
                {
                    return;
                }

                // 根据是否有参数构造 JS 调用语句
                string script;
                if (jsonArg != null)
                {
                    script = $"{functionName}({jsonArg});";
                }
                else
                {
                    script = $"{functionName}();";
                }

                // 在 WebView 中执行脚本，将结果推送给前端
                await _webView.CoreWebView2.ExecuteScriptAsync(script);
            });
        }

        /// <summary>
        /// 向 JS 端推送错误信息的便捷方法。
        /// 构造包含 message 字段的匿名对象，序列化后调用 RLT.onError。
        /// 自身异常静默捕获，防止错误推送失败导致无限递归。
        /// </summary>
        /// <param name="message">可读的错误描述信息</param>
        private async void PushError(string message)
        {
            try
            {
                // 构造 { message: "..." } 格式的错误对象
                var errorObj = new { message };
                var json = JsonConvert.SerializeObject(errorObj);
                await PushToJs("RLT.onError", json);
            }
            catch
            {
                // PushError 自身失败时静默忽略，
                // 避免二次异常导致递归调用或进程崩溃
            }
        }

        /// <summary>
        /// JS 端发送到 C# 的消息格式。
        /// 对应前端通过 chrome.webview.postMessage 发送的 JSON 对象。
        /// 仅用于内部反序列化，不对外暴露。
        /// </summary>
        private class JsMessage
        {
            /// <summary>
            /// 操作类型，支持的值：
            /// - "scanSessions"：扫描全部微信会话
            /// - "exportChat"：导出指定会话的聊天记录
            /// - "checkPython"：检测 Python 环境是否可用
            /// </summary>
            [JsonProperty("action")]
            public string Action { get; set; }

            /// <summary>
            /// 微信用户 ID（wxid）。
            /// 仅在 action 为 "exportChat" 时需要提供，其他 action 忽略此字段。
            /// </summary>
            [JsonProperty("wxid")]
            public string WxId { get; set; }
        }
    }
}
