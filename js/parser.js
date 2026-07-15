// js/parser.js — WeChatMsg 导出 JSON 解析与校验
// 依赖：RLT 全局命名空间（由 storage.js 初始化）

RLT.parser = (function() {
  'use strict';

  // ============================================================
  // 字段别名映射 — 兼容 WeChatMsg 不同版本的字段命名差异
  // ============================================================
  var FIELD_ALIASES = {
    createTime: ['CreateTime', 'createTime', 'time', 'timestamp', 'msgCreateTime'],
    isSender:   ['IsSender', 'isSender', 'is_sender', 'sender'],
    content:    ['StrContent', 'strContent', 'content', 'msgContent', 'message'],
    talker:     ['StrTalker', 'strTalker', 'talker', 'talkerId'],
    type:       ['Type', 'type', 'msgType', 'msg_type']
  };

  /**
   * 从消息对象中提取指定字段的值
   * 按别名列表顺序尝试，返回第一个非 undefined 的值
   * @param {Object} obj - 原始消息对象
   * @param {string[]} aliases - 候选字段名列表
   * @returns {*} 字段值，所有别名都不存在时返回 undefined
   */
  function getField(obj, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      if (obj[aliases[i]] !== undefined) {
        return obj[aliases[i]];
      }
    }
    return undefined;
  }

  // ============================================================
  // 单条消息解析
  // ============================================================

  /**
   * 解析单条原始消息对象为结构化数据
   * @param {Object} raw - WeChatMsg 导出的单条消息 JSON 对象
   * @returns {Object|null} 解析后的消息对象，缺少关键字段时返回 null
   */
  function parseMessage(raw) {
    // 提取关键字段
    var rawCreateTime = getField(raw, FIELD_ALIASES.createTime);
    var rawIsSender   = getField(raw, FIELD_ALIASES.isSender);

    // 缺少 createTime 或 isSender 视为无效消息，跳过
    if (rawCreateTime === undefined || rawIsSender === undefined) {
      return null;
    }

    // 兼容秒级和毫秒级时间戳：10位为秒级，13位为毫秒级
    var createTimeNum = Number(rawCreateTime);
    var timestampMs;
    if (isNaN(createTimeNum)) {
      // 非数字字符串，尝试用 Date.parse 解析
      var parsed = Date.parse(rawCreateTime);
      if (isNaN(parsed)) {
        return null;
      }
      timestampMs = parsed;
    } else if (createTimeNum < 1e12) {
      // 10位或更短 → 秒级时间戳，转为毫秒
      timestampMs = createTimeNum * 1000;
    } else {
      // 13位及以上 → 毫秒级时间戳，直接使用
      timestampMs = createTimeNum;
    }

    var date = new Date(timestampMs);
    // 日期无效时跳过
    if (isNaN(date.getTime())) {
      return null;
    }

    // 解析 isSender：兼容数字（0/1）、布尔值、字符串（"true"/"false"/"0"/"1"）
    var isMine;
    if (typeof rawIsSender === 'boolean') {
      isMine = rawIsSender;
    } else if (typeof rawIsSender === 'number') {
      isMine = rawIsSender !== 0;
    } else {
      var s = String(rawIsSender).toLowerCase();
      isMine = (s === 'true' || s === '1');
    }

    var content = getField(raw, FIELD_ALIASES.content);
    // 内容为空时设为空字符串，避免 undefined
    if (content === undefined || content === null) {
      content = '';
    } else {
      content = String(content);
    }

    var talker = getField(raw, FIELD_ALIASES.talker);
    if (talker === undefined || talker === null) {
      talker = '';
    } else {
      talker = String(talker);
    }

    var type = getField(raw, FIELD_ALIASES.type);
    if (type === undefined || type === null) {
      type = 0;
    } else {
      type = Number(type) || 0;
    }

    // 预计算常用派生字段，避免后续重复计算
    var yyyy = date.getFullYear();
    var mm   = String(date.getMonth() + 1).padStart(2, '0');
    var dd   = String(date.getDate()).padStart(2, '0');

    return {
      timestamp: timestampMs,           // 毫秒级时间戳
      date:      date,                  // Date 对象
      isMine:    isMine,                // 是否是我发送的消息
      content:   content,               // 消息文本内容
      talker:    talker,                // 对话者标识（群聊时为群ID，私聊时为对方ID）
      type:      type,                  // 消息类型编号
      hour:      date.getHours(),       // 小时 (0-23)
      dayOfWeek: date.getDay(),         // 星期几 (0=周日, 6=周六)
      dateStr:   yyyy + '-' + mm + '-' + dd,  // "YYYY-MM-DD"
      monthStr:  yyyy + '-' + mm               // "YYYY-MM"
    };
  }

  // ============================================================
  // 推断自己的 talkerId
  // ============================================================

  /**
   * 根据消息数据推断哪个 talkerId 属于"我"
   * 策略：每个 talkerId 统计 isMine=true 的消息数，取最多的那个
   * @param {Object[]} messages - 已解析的消息数组
   * @returns {string|null} 自己的 talkerId，无法推断时返回 null
   */
  function findMyTalker(messages) {
    var counter = {};
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      if (msg.isMine && msg.talker) {
        counter[msg.talker] = (counter[msg.talker] || 0) + 1;
      }
    }
    var bestTalker = null;
    var bestCount  = 0;
    var keys = Object.keys(counter);
    for (var j = 0; j < keys.length; j++) {
      if (counter[keys[j]] > bestCount) {
        bestCount  = counter[keys[j]];
        bestTalker = keys[j];
      }
    }
    return bestTalker;
  }

  // ============================================================
  // 主解析入口
  // ============================================================

  /**
   * 解析 WeChatMsg 导出的 JSON 字符串
   * @param {string} jsonStr - WeChatMsg 导出的原始 JSON 字符串
   * @returns {{ success: boolean, data?: { messages: Object[], meta: Object }, error?: string }}
   */
  function parse(jsonStr) {
    // 第一步：JSON 解析
    var rawData;
    try {
      rawData = JSON.parse(jsonStr);
    } catch (e) {
      return { success: false, error: 'JSON 解析失败：' + e.message };
    }

    // 第二步：确保是数组格式
    // 某些版本可能导出 { messages: [...] } 结构，尝试自动提取
    var rawMessages;
    if (Array.isArray(rawData)) {
      rawMessages = rawData;
    } else if (rawData && Array.isArray(rawData.messages)) {
      rawMessages = rawData.messages;
    } else if (rawData && Array.isArray(rawData.data)) {
      rawMessages = rawData.data;
    } else {
      return { success: false, error: '数据格式不正确：期望 JSON 数组或包含 messages/data 字段的对象' };
    }

    if (rawMessages.length === 0) {
      return { success: false, error: '消息列表为空，请检查导出的聊天记录是否包含消息' };
    }

    // 第三步：逐条解析消息
    var messages = [];
    for (var i = 0; i < rawMessages.length; i++) {
      var parsed = parseMessage(rawMessages[i]);
      if (parsed) {
        messages.push(parsed);
      }
    }

    if (messages.length === 0) {
      return { success: false, error: '没有解析到任何有效消息，请确认 JSON 格式是否为 WeChatMsg 导出格式' };
    }

    // 第四步：按时间排序（升序，从早到晚）
    messages.sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });

    // 第五步：推断自己的 talkerId
    var myTalker = findMyTalker(messages);

    // 第六步：提取元信息
    var firstMsg    = messages[0];
    var lastMsg     = messages[messages.length - 1];
    var dateRangeStart = firstMsg.dateStr;
    var dateRangeEnd   = lastMsg.dateStr;
    // 计算聊天跨度天数（含首尾两天）
    var durationDays = Math.ceil((lastMsg.timestamp - firstMsg.timestamp) / (1000 * 60 * 60 * 24)) + 1;

    // 统计我/对方消息数量
    var myCount    = 0;
    var otherCount = 0;
    for (var j = 0; j < messages.length; j++) {
      if (messages[j].isMine) {
        myCount++;
      } else {
        otherCount++;
      }
    }

    // 收集所有参与对话的 talker（去重）
    var talkerSet = {};
    for (var k = 0; k < messages.length; k++) {
      if (messages[k].talker) {
        talkerSet[messages[k].talker] = true;
      }
    }
    var talkers = Object.keys(talkerSet);

    var meta = {
      totalMessages:  messages.length,   // 有效消息总数
      dateRangeStart: dateRangeStart,    // 最早消息日期 "YYYY-MM-DD"
      dateRangeEnd:   dateRangeEnd,      // 最晚消息日期 "YYYY-MM-DD"
      durationDays:   durationDays,      // 聊天跨度（天）
      myMessages:     myCount,           // 我发送的消息数
      otherMessages:  otherCount,        // 对方发送的消息数
      talkers:        talkers,           // 参与对话的 talkerId 列表
      myTalker:       myTalker           // 推断出的自己的 talkerId
    };

    return {
      success: true,
      data: {
        messages: messages,
        meta:     meta
      }
    };
  }

  // ============================================================
  // 数据校验
  // ============================================================

  /**
   * 校验解析后的元数据完整性
   * @param {Object} meta - parse() 返回的 meta 对象
   * @returns {string[]} 警告信息数组，无问题时为空数组
   */
  function validate(meta) {
    var warnings = [];

    // 对方消息数为 0：可能导出的是单方聊天记录，或 talker 推断有误
    if (meta.otherMessages === 0) {
      warnings.push('未检测到对方的消息（otherMessages=0），请确认是否导出了双方的聊天记录');
    }

    // 总消息数过少：数据量不足以支撑有意义的统计分析
    if (meta.totalMessages < 50) {
      warnings.push('消息数量较少（' + meta.totalMessages + ' 条），可能影响分析结果的代表性');
    }

    return warnings;
  }

  // ============================================================
  // 公开 API
  // ============================================================
  return {
    parse:    parse,
    validate: validate
  };
})();
