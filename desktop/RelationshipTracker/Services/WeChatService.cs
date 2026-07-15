using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text;
using Newtonsoft.Json;

namespace RelationshipTracker.Services
{
    /// <summary>
    /// 微信数据服务 — 通过调用 Python 解密脚本管理微信数据库的会话扫描与消息导出。
    /// 使用子进程方式运行 decrypt_chat.py，通过 JSON 标准输出交换数据。
    /// </summary>
    public class WeChatService
    {
        /// <summary>
        /// Python 解密脚本的完整路径，位于应用程序目录下的 python\decrypt_chat.py。
        /// </summary>
        private string PythonScriptPath =>
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "python", "decrypt_chat.py");

        /// <summary>
        /// Python 解释器路径。
        /// 优先使用内置的 python\runtime\python.exe，不存在时回退到系统 PATH 中的 python 命令。
        /// </summary>
        private string PythonExePath
        {
            get
            {
                var embedded = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory, "python", "runtime", "python.exe");
                if (File.Exists(embedded)) return embedded;
                return "python";
            }
        }

        /// <summary>
        /// 启动 Python 子进程，传递指定参数给解密脚本，并返回标准输出内容。
        /// 使用 UTF8 编码读取输出，30 秒超时，无窗口运行。
        /// </summary>
        /// <param name="arguments">传递给 decrypt_chat.py 的命令行参数</param>
        /// <returns>Python 脚本的标准输出（JSON 字符串）</returns>
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
                // 设置工作目录为脚本所在目录，确保相对路径引用正确
                WorkingDirectory = Path.GetDirectoryName(PythonScriptPath)
            };

            using (var process = Process.Start(psi))
            {
                // ReadToEnd 必须在 WaitForExit 之前调用，避免死锁
                var output = process.StandardOutput.ReadToEnd();
                var error = process.StandardError.ReadToEnd();
                process.WaitForExit(30000);

                // 将 Python 标准错误输出到调试窗口，便于排查脚本异常
                if (!string.IsNullOrEmpty(error))
                {
                    Debug.WriteLine($"[Python stderr] {error}");
                }

                return output;
            }
        }

        /// <summary>
        /// 扫描并返回所有微信会话列表。
        /// 调用 Python 脚本的 --mode list 模式，将 JSON 反序列化为 SessionListResponse。
        /// </summary>
        /// <returns>包含会话数组或错误信息的 SessionListResponse</returns>
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
                // Python 解释器未找到时返回明确的错误信息
                return new Models.SessionListResponse
                {
                    Error = true,
                    ErrorType = "python_missing",
                    Message = "Python环境未配置，请确保已安装Python 3"
                };
            }
            catch (Exception ex)
            {
                // 其他异常（脚本错误、JSON 解析失败等）统一返回未知错误
                return new Models.SessionListResponse
                {
                    Error = true,
                    ErrorType = "unknown",
                    Message = $"扫描失败: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// 导出指定微信会话的聊天记录。
        /// 调用 Python 脚本的 --mode export --wxid 模式，将 JSON 反序列化为 ExportResponse。
        /// </summary>
        /// <param name="wxid">目标微信用户的 wxid</param>
        /// <returns>包含消息数组或错误信息的 ExportResponse</returns>
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
        /// 检测当前环境是否可用 Python。
        /// 通过执行 python --version 并检查退出码来判断。
        /// </summary>
        /// <returns>true 表示 Python 可用，false 表示不可用</returns>
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
                // 任何异常（文件不存在、权限不足等）均视为 Python 不可用
                return false;
            }
        }
    }
}
