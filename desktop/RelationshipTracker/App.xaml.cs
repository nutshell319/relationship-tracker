using System.Windows;

namespace RelationshipTracker
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
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
