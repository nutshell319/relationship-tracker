using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;
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
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "RelationshipTracker", "WebView2");

            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
            await WebView.EnsureCoreWebView2Async(env);

            _bridge.Initialize(WebView, _weChatService);

            var wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            var indexPath = Path.Combine(wwwrootPath, "index.html");

            if (File.Exists(indexPath))
            {
                WebView.CoreWebView2.Navigate(new Uri(indexPath).AbsoluteUri);
            }
            else
            {
                WebView.CoreWebView2.NavigateToString(
                    "<html><body style='background:#0f0f1a;color:#e8e8ed;font-family:sans-serif;" +
                    "display:flex;align-items:center;justify-content:center;height:100vh;'>" +
                    "<div style='text-align:center;'><h2>前端资源未找到</h2>" +
                    "<p>请确保 wwwroot 目录存在于应用目录下</p></div></body></html>");
            }

            WebView.CoreWebView2.Profile.PreferredColorScheme = CoreWebView2PreferredColorScheme.Dark;
        }

        private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            WebView?.Dispose();
        }
    }
}
