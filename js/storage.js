// js/storage.js — localStorage 封装
window.RLT = window.RLT || {};

RLT.storage = (function() {
  const KEYS = {
    API_KEY: 'rlt_api_key',
    API_BASE: 'rlt_api_base',
    AI_RESULT: 'rlt_ai_result',
    STATS_RESULT: 'rlt_stats_result',
    CHAT_META: 'rlt_chat_meta',
    CURRENT_VIEW: 'rlt_current_view'
  };

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('localStorage 写入失败:', e);
      return false;
    }
  }

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('localStorage 读取失败:', e);
      return null;
    }
  }

  function clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return { KEYS, save, load, clear };
})();
