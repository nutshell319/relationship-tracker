// js/desktop.js — 桌面应用专属模块
window.RLT = window.RLT || {};

RLT.desktop = (function() {

  var isDesktop = (function() {
    try {
      return window.chrome && window.chrome.webview !== undefined;
    } catch (e) {
      return false;
    }
  })();

  function sendToHost(action, wxid) {
    if (!isDesktop) return;
    var msg = { action: action };
    if (wxid) msg.wxid = wxid;
    window.chrome.webview.postMessage(JSON.stringify(msg));
  }

  function scanSessions() { sendToHost('scanSessions'); }
  function exportChat(wxid) { sendToHost('exportChat', wxid); }
  function checkPython() { sendToHost('checkPython'); }

  // C# → JS 回调
  RLT.desktop.onScanStart = function() {
    window.dispatchEvent(new CustomEvent('desktop:scanStart'));
  };

  RLT.desktop.onSessionsReady = function(response) {
    window.dispatchEvent(new CustomEvent('desktop:sessionsReady', { detail: response }));
  };

  RLT.desktop.onExportStart = function(wxid) {
    window.dispatchEvent(new CustomEvent('desktop:exportStart', { detail: wxid }));
  };

  RLT.desktop.onChatExported = function(messages) {
    window.dispatchEvent(new CustomEvent('desktop:chatExported', { detail: messages }));
    // Auto-trigger analysis
    var result = RLT.parser.parse(JSON.stringify(messages));
    if (result.success && window.__appState) {
      window.__appState.meta = result.data.meta;
      window.__appState.messages = result.data.messages;
      window.__appState.runAnalysis();
    }
  };

  RLT.desktop.onChatExportError = function(message) {
    window.dispatchEvent(new CustomEvent('desktop:error', {
      detail: { type: 'export', message: message }
    }));
  };

  RLT.desktop.onPythonCheck = function(available) {
    window.dispatchEvent(new CustomEvent('desktop:pythonCheck', { detail: available }));
  };

  RLT.onError = function(type, message) {
    window.dispatchEvent(new CustomEvent('desktop:error', {
      detail: { type: type, message: message }
    }));
  };

  return {
    isDesktop: isDesktop,
    scanSessions: scanSessions,
    exportChat: exportChat,
    checkPython: checkPython
  };
})();
