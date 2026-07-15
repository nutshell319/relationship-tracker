// js/stats.js — 统计引擎
// 依赖：RLT 全局命名空间（由 storage.js 初始化），RLT.parser（消息数据来源）
// 提供 11 项统计分析：消息量/词频/热力图/Emoji/天平/称呼等

RLT.stats = (function() {
  'use strict';

  // ============================================================
  // 中文停用词表 — 词频统计时过滤无意义高频单字
  // ============================================================
  var STOP_WORDS = {
    '的':1,'了':1,'我':1,'你':1,'是':1,'在':1,'不':1,'和':1,'就':1,'都':1,
    '也':1,'要':1,'还':1,'有':1,'这':1,'那':1,'个':1,'来':1,'去':1,'说':1,
    '会':1,'着':1,'没':1,'看':1,'好':1,'吧':1,'吗':1,'呢':1,'啊':1,'哦':1,
    '嗯':1,'哈':1,'呀':1,'么':1,'嘛':1,'噢':1,'啦':1,'滴':1,'哟':1
  };

  // ============================================================
  // Emoji 正则 — 匹配 Unicode Emoji 区块
  // 覆盖：表情符号、杂项符号、交通地图、装饰符号、旗帜、杂项符号补充
  // ============================================================
  var EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  // ============================================================
  // 称呼匹配模式 — 检测消息中的亲密称呼
  // 每个正则均带 g 标志以在单条消息中匹配多次出现
  // ============================================================
  var NICKNAME_PATTERNS = [
    /亲爱的/g, /宝贝/g, /宝宝/g, /乖乖/g, /憨憨/g,
    /小[一-鿿]{1,2}/g, /老[一-鿿]{1,2}/g,
    /笨蛋/g, /傻瓜/g, /猪[一-鿿]?/g, /狗子/g,
    /哥哥/g, /妹妹/g, /姐姐/g, /弟弟/g
  ];

  // ============================================================
  // 工具函数
  // ============================================================

  /**
   * 将 Date 对象格式化为 "YYYY-MM-DD" 字符串
   * 使用本地时区，与 parser.js 中的格式化逻辑保持一致
   * @param {Date} d - 日期对象
   * @returns {string} "YYYY-MM-DD" 格式日期字符串
   */
  function toDateStr(d) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  /**
   * 安全解析 "YYYY-MM-DD" 字符串为 Date 对象（本地时区）
   * 使用 new Date(year, month-1, day) 构造函数避免 ISO 字符串时区歧义
   * @param {string} dateStr - "YYYY-MM-DD" 格式
   * @returns {Date} 对应日期的 Date 对象
   */
  function parseDateStr(dateStr) {
    var parts = dateStr.split('-');
    return new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
  }

  /**
   * 获取元信息中的日期范围起始（兼容不同版本的 meta 结构）
   * 优先使用 dateRange.start，回退到 dateRangeStart
   * @param {Object} meta - 元信息对象
   * @returns {string} "YYYY-MM-DD" 或空字符串
   */
  function getDateStart(meta) {
    return (meta.dateRange && meta.dateRange.start) || meta.dateRangeStart || '';
  }

  /**
   * 获取元信息中的日期范围结束（兼容不同版本的 meta 结构）
   * @param {Object} meta - 元信息对象
   * @returns {string} "YYYY-MM-DD" 或空字符串
   */
  function getDateEnd(meta) {
    return (meta.dateRange && meta.dateRange.end) || meta.dateRangeEnd || '';
  }

  // ============================================================
  // 1. 每日消息数 — 感情趋势曲线 X 轴数据源
  // ============================================================

  /**
   * 计算每日消息数量，填充整个日期范围内每一天（含无消息的日期 count=0）
   * 用于 ECharts 折线图的完整日期轴
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象
   * @returns {Array<{date: string, count: number}>} 按日期升序排列
   */
  function computeDailyCounts(messages, meta) {
    // 先统计有消息的日期
    var map = {};
    for (var i = 0; i < messages.length; i++) {
      var ds = messages[i].dateStr;
      map[ds] = (map[ds] || 0) + 1;
    }

    var startStr = getDateStart(meta);
    var endStr = getDateEnd(meta);

    // 无法获取日期范围时，仅返回有消息的日期
    if (!startStr || !endStr) {
      var keys = Object.keys(map).sort();
      var fallback = [];
      for (var k = 0; k < keys.length; k++) {
        fallback.push({ date: keys[k], count: map[keys[k]] });
      }
      return fallback;
    }

    // 填充整个日期范围（含无消息的日期，count=0）
    var result = [];
    var cur = parseDateStr(startStr);
    var end = parseDateStr(endStr);

    while (cur <= end) {
      var ds = toDateStr(cur);
      result.push({ date: ds, count: map[ds] || 0 });
      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }

  // ============================================================
  // 2. 每周消息数 — 按周日为周起始汇总
  // ============================================================

  /**
   * 按周汇总消息数量，以周日作为一周的起始日
   * 每周的 key 为周日日期字符串
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象（本函数未直接使用，保留接口一致性）
   * @returns {Array<{week: string, count: number}>} 按周起始日期排序
   */
  function computeWeeklyCounts(messages, meta) {
    var map = {};
    for (var i = 0; i < messages.length; i++) {
      var d = messages[i].date;
      // 计算该日期所在周的周日日期（dayOfWeek: 0=周日）
      var weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      var wk = toDateStr(weekStart);
      map[wk] = (map[wk] || 0) + 1;
    }

    var keys = Object.keys(map).sort();
    var result = [];
    for (var j = 0; j < keys.length; j++) {
      result.push({ week: keys[j], count: map[keys[j]] });
    }
    return result;
  }

  // ============================================================
  // 3. 每月消息数 — 含双方分别统计
  // ============================================================

  /**
   * 按月汇总消息数，并分别统计双方各自发送的消息数
   * 用于堆叠柱状图展示双方互动量对比
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象（本函数未直接使用，保留接口一致性）
   * @returns {Array<{month: string, total: number, mine: number, other: number}>} 按月份排序
   */
  function computeMonthlyCounts(messages, meta) {
    var map = {};
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var key = m.monthStr;
      if (!map[key]) {
        map[key] = { month: key, total: 0, mine: 0, other: 0 };
      }
      map[key].total++;
      if (m.isMine) {
        map[key].mine++;
      } else {
        map[key].other++;
      }
    }

    var keys = Object.keys(map).sort();
    var result = [];
    for (var j = 0; j < keys.length; j++) {
      result.push(map[keys[j]]);
    }
    return result;
  }

  // ============================================================
  // 4. 小时×星期 热力图数据 — 24×7 网格
  // ============================================================

  /**
   * 生成 24小时 × 7天 热力图网格数据，共 168 个格子
   * 每个元素为 [hour, dayOfWeek, count] 三元组
   * hour: 0-23（0 点为凌晨），dayOfWeek: 0=周日, 6=周六
   * 用于 ECharts heatmap 系列展示聊天时段分布
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @returns {Array<[number, number, number]>} 168 个格子，每个为 [hour, dayOfWeek, count]
   */
  function computeHourlyHeatmap(messages) {
    // 初始化 24×7 网格，全部 count 为 0
    var grid = [];
    for (var h = 0; h < 24; h++) {
      for (var d = 0; d < 7; d++) {
        grid.push([h, d, 0]);
      }
    }

    // 遍历消息，在对应格子累加计数
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      // hour 和 dayOfWeek 已由 parser.js 预计算
      var idx = m.hour * 7 + m.dayOfWeek;
      if (idx >= 0 && idx < grid.length) {
        grid[idx][2]++;
      }
    }

    return grid;
  }

  // ============================================================
  // 5. 日历热力图数据 — GitHub 贡献图风格
  // ============================================================

  /**
   * 生成日历热力图数据，每项为 [日期字符串, 消息数]
   * 用于 ECharts calendar 坐标系展示全年聊天活跃度分布
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象（本函数未直接使用，保留接口一致性）
   * @returns {Array<[string, number]>} 按日期排序的 [dateStr, count] 数组
   */
  function computeCalendarHeatmap(messages, meta) {
    var map = {};
    for (var i = 0; i < messages.length; i++) {
      var ds = messages[i].dateStr;
      map[ds] = (map[ds] || 0) + 1;
    }

    var keys = Object.keys(map).sort();
    var result = [];
    for (var j = 0; j < keys.length; j++) {
      result.push([keys[j], map[keys[j]]]);
    }
    return result;
  }

  // ============================================================
  // 6. 中文词频统计 — 滑动窗口 + 停用词过滤
  // ============================================================

  /**
   * 从全部消息中提取中文高频词（前 80）
   * 使用 2-3 字滑动窗口对连续中文字符片段切词，过滤停用词后统计
   * 仅返回出现 >= 3 次的词，避免单次偶发词汇干扰
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @returns {Array<{name: string, value: number}>} 前 80 高频词，按频次降序
   */
  function computeWordFrequency(messages) {
    var freq = {};

    for (var i = 0; i < messages.length; i++) {
      var text = messages[i].content;
      if (!text) continue;

      // 提取连续中文字符片段（Unicode 基本汉字到扩展区）
      var segments = text.match(/[一-鿿]+/g);
      if (!segments) continue;

      for (var s = 0; s < segments.length; s++) {
        var seg = segments[s];

        // 2 字滑动窗口切词
        for (var j = 0; j <= seg.length - 2; j++) {
          var word2 = seg.slice(j, j + 2);
          if (!STOP_WORDS[word2]) {
            freq[word2] = (freq[word2] || 0) + 1;
          }
        }

        // 3 字滑动窗口切词（仅在片段长度 >= 3 时）
        for (var k = 0; k <= seg.length - 3; k++) {
          var word3 = seg.slice(k, k + 3);
          if (!STOP_WORDS[word3]) {
            freq[word3] = (freq[word3] || 0) + 1;
          }
        }
      }
    }

    // 转为数组，过滤出现次数 < 3 的词，按频次降序排列，取前 80
    var entries = [];
    var keys = Object.keys(freq);
    for (var e = 0; e < keys.length; e++) {
      if (freq[keys[e]] >= 3) {
        entries.push({ name: keys[e], value: freq[keys[e]] });
      }
    }

    entries.sort(function(a, b) {
      return b.value - a.value;
    });

    return entries.slice(0, 80);
  }

  // ============================================================
  // 7. Emoji 使用趋势 — 整体 Top 10 + 每月趋势
  // ============================================================

  /**
   * 统计 Emoji 使用趋势：全局 Top 10 + 每月各 Emoji 使用次数
   * 用于折线图展示各 Emoji 使用频率随时间的变化
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象（本函数未直接使用，保留接口一致性）
   * @returns {{ top10: string[], trends: Array<{emoji: string, data: number[]}>, months: string[] }}
   */
  function computeEmojiTrends(messages, meta) {
    // 第一步：统计每月每个 Emoji 的出现次数
    // 结构：{ "2024-03": { "😊": 5, "❤️": 3 }, ... }
    var monthlyEmoji = {};

    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var emojis = m.content.match(EMOJI_REGEX);
      if (!emojis || emojis.length === 0) continue;

      if (!monthlyEmoji[m.monthStr]) {
        monthlyEmoji[m.monthStr] = {};
      }
      for (var j = 0; j < emojis.length; j++) {
        var em = emojis[j];
        monthlyEmoji[m.monthStr][em] = (monthlyEmoji[m.monthStr][em] || 0) + 1;
      }
    }

    // 第二步：统计全局 Emoji 总次数，取 Top 10
    var totalEmoji = {};
    var monthKeys = Object.keys(monthlyEmoji);
    for (var mk = 0; mk < monthKeys.length; mk++) {
      var monthData = monthlyEmoji[monthKeys[mk]];
      var emKeys = Object.keys(monthData);
      for (var ek = 0; ek < emKeys.length; ek++) {
        totalEmoji[emKeys[ek]] = (totalEmoji[emKeys[ek]] || 0) + monthData[emKeys[ek]];
      }
    }

    var topEntries = [];
    var totalKeys = Object.keys(totalEmoji);
    for (var t = 0; t < totalKeys.length; t++) {
      topEntries.push({ emoji: totalKeys[t], count: totalEmoji[totalKeys[t]] });
    }
    topEntries.sort(function(a, b) { return b.count - a.count; });
    var top10 = [];
    for (var u = 0; u < Math.min(10, topEntries.length); u++) {
      top10.push(topEntries[u].emoji);
    }

    // 第三步：构建每月 Top 10 Emoji 的趋势数据
    var months = monthKeys.sort();
    var trends = [];
    for (var v = 0; v < top10.length; v++) {
      var emoji = top10[v];
      var data = [];
      for (var w = 0; w < months.length; w++) {
        var monthEmojiData = monthlyEmoji[months[w]] || {};
        data.push(monthEmojiData[emoji] || 0);
      }
      trends.push({ emoji: emoji, data: data });
    }

    return { top10: top10, trends: trends, months: months };
  }

  // ============================================================
  // 8. 深夜聊天统计 — 22:00 ~ 02:00
  // ============================================================

  /**
   * 统计每月深夜时段（22:00-23:59 及 00:00-01:59）的消息数量及占比
   * 深夜聊天通常反映关系的亲密程度
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象（本函数未直接使用，保留接口一致性）
   * @returns {Array<{month: string, nightCount: number, totalCount: number, ratio: string}>} 按月份排序
   */
  function computeNightOwlStats(messages, meta) {
    var monthly = {};  // { monthStr: { total: number, night: number } }

    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (!monthly[m.monthStr]) {
        monthly[m.monthStr] = { total: 0, night: 0 };
      }
      monthly[m.monthStr].total++;
      // 深夜时段：22:00-23:59 或 00:00-01:59
      if (m.hour >= 22 || m.hour < 2) {
        monthly[m.monthStr].night++;
      }
    }

    var keys = Object.keys(monthly).sort();
    var result = [];
    for (var j = 0; j < keys.length; j++) {
      var d = monthly[keys[j]];
      result.push({
        month: keys[j],
        nightCount: d.night,
        totalCount: d.total,
        ratio: d.total > 0 ? (d.night / d.total * 100).toFixed(1) : '0.0'
      });
    }
    return result;
  }

  // ============================================================
  // 9. 双方互动天平 — 月度对比 + 总体占比
  // ============================================================

  /**
   * 计算双方消息量的月度对比和总体占比
   * 用于背靠背柱状图展示双方互动是否均衡
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象，提供 myMessages/otherMessages/totalMessages
   * @returns {{ monthly: Array<{month: string, mine: number, other: number}>, overall: {mine: number, other: number, minePercent: string} }}
   */
  function computeBalance(messages, meta) {
    var monthly = {};  // { monthStr: { month, mine, other } }

    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (!monthly[m.monthStr]) {
        monthly[m.monthStr] = { month: m.monthStr, mine: 0, other: 0 };
      }
      if (m.isMine) {
        monthly[m.monthStr].mine++;
      } else {
        monthly[m.monthStr].other++;
      }
    }

    var keys = Object.keys(monthly).sort();
    var monthlyArr = [];
    for (var j = 0; j < keys.length; j++) {
      monthlyArr.push(monthly[keys[j]]);
    }

    // 总体统计：直接使用 meta 中 parser 已计算的汇总数据
    var myCount = meta.myMessages || 0;
    var otherCount = meta.otherMessages || 0;
    var totalCount = meta.totalMessages || (myCount + otherCount);
    var minePercent = totalCount > 0
      ? (myCount / totalCount * 100).toFixed(1)
      : '0.0';

    return {
      monthly: monthlyArr,
      overall: {
        mine: myCount,
        other: otherCount,
        minePercent: minePercent
      }
    };
  }

  // ============================================================
  // 10. 响应时间 — 同天内不同发送者消息间隔
  // ============================================================

  /**
   * 计算同一天内不同发送者之间的消息响应时间间隔
   * 仅统计：同天 + 不同人 + 间隔 > 0 且 < 180 分钟（过滤异常和长时间未回复）
   * 消息数组需已按时间升序排列（parser.js 已保证）
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @returns {Array<{date: string, gapMinutes: number, responder: string}>}
   */
  function computeResponseTimes(messages) {
    var intervals = [];

    for (var i = 1; i < messages.length; i++) {
      var prev = messages[i - 1];
      var curr = messages[i];

      // 条件：同一天、不同发送者
      if (prev.dateStr !== curr.dateStr) continue;
      if (prev.isMine === curr.isMine) continue;

      // 计算时间间隔（分钟）
      var gap = (curr.timestamp - prev.timestamp) / 60000;

      // 仅统计有效间隔：> 0 且 < 180 分钟
      if (gap > 0 && gap < 180) {
        intervals.push({
          date: curr.dateStr,
          gapMinutes: Math.round(gap),
          responder: curr.isMine ? 'me' : 'other'
        });
      }
    }

    return intervals;
  }

  // ============================================================
  // 11. 称呼演变 — 亲密称呼首次出现时间线
  // ============================================================

  /**
   * 检测各类亲密称呼在全部消息中的首次出现时间
   * 使用预定义的称呼正则模式（亲爱的/宝贝/宝宝/小X/老X 等）逐条匹配
   * 每个称呼术语仅记录最早出现的日期
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象（本函数未直接使用，保留接口一致性）
   * @returns {Array<{term: string, date: string, timestamp: number}>} 按首次出现时间升序
   */
  function computeNicknameEvolution(messages, meta) {
    var firstSeen = {};  // { term: { term, date, timestamp } }

    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var content = m.content;
      if (!content) continue;

      // 对每种称呼模式在消息内容中搜索
      for (var p = 0; p < NICKNAME_PATTERNS.length; p++) {
        var pattern = NICKNAME_PATTERNS[p];
        // 重置 lastIndex（正则带 g 标志，多次 exec 需要重置）
        pattern.lastIndex = 0;
        var match = pattern.exec(content);
        while (match !== null) {
          var term = match[0];
          // 仅记录首次出现（最早时间戳）
          if (!firstSeen[term] || m.timestamp < firstSeen[term].timestamp) {
            firstSeen[term] = {
              term: term,
              date: m.dateStr,
              timestamp: m.timestamp
            };
          }
          match = pattern.exec(content);
        }
      }
    }

    // 转为数组并按时间排序
    var result = [];
    var keys = Object.keys(firstSeen);
    for (var k = 0; k < keys.length; k++) {
      result.push(firstSeen[keys[k]]);
    }
    result.sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });

    return result;
  }

  // ============================================================
  // 公开 API
  // ============================================================

  /**
   * 主入口：计算全部 11 项统计数据
   * 每个子函数独立计算一项统计，互不依赖，可按需单独调用
   * @param {Object[]} messages - RLT.parser.parse() 返回的消息数组，每条消息含 timestamp/date/isMine/content/hour/dayOfWeek/dateStr/monthStr
   * @param {Object} meta - RLT.parser.parse() 返回的元信息对象，含 totalMessages/dateRangeStart/dateRangeEnd/myMessages/otherMessages 等
   * @returns {Object} 包含全部 11 项统计结果的对象
   */
  function compute(messages, meta) {
    return {
      dailyCounts:       computeDailyCounts(messages, meta),
      weeklyCounts:      computeWeeklyCounts(messages, meta),
      monthlyCounts:     computeMonthlyCounts(messages, meta),
      hourlyHeatmap:     computeHourlyHeatmap(messages),
      calendarHeatmap:   computeCalendarHeatmap(messages, meta),
      wordFrequency:     computeWordFrequency(messages),
      emojiTrends:       computeEmojiTrends(messages, meta),
      nightOwlStats:     computeNightOwlStats(messages, meta),
      balance:           computeBalance(messages, meta),
      responseTimes:     computeResponseTimes(messages),
      nicknameEvolution: computeNicknameEvolution(messages, meta)
    };
  }

  return { compute: compute };
})();
