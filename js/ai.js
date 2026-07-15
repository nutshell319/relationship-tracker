// js/ai.js — AI 分析引擎（DeepSeek API，OpenAI 兼容格式）
// 依赖：RLT 全局命名空间（由 storage.js 初始化），RLT.storage
// 三轮递进分析：月度扫描 → 全局总结 → 里程碑提取

RLT.ai = (function() {
  'use strict';

  // ============================================================
  // 默认配置
  // ============================================================
  var DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
  var DEFAULT_MODEL = 'deepseek-chat';

  // ============================================================
  // 配置读取
  // ============================================================

  /**
   * 检查是否已配置 API Key（从 localStorage 读取）
   * @returns {boolean} true 表示已配置 API Key
   */
  function isConfigured() {
    var key = RLT.storage.load(RLT.storage.KEYS.API_KEY);
    return !!key;
  }

  /**
   * 获取完整 API 配置
   * @returns {{ apiKey: string, baseUrl: string }} API Key 和 Base URL
   */
  function getConfig() {
    return {
      apiKey:  RLT.storage.load(RLT.storage.KEYS.API_KEY) || '',
      baseUrl: RLT.storage.load(RLT.storage.KEYS.API_BASE) || DEFAULT_BASE_URL
    };
  }

  // ============================================================
  // chatCompletion — 底层 API 调用
  // ============================================================

  /**
   * 调用 DeepSeek Chat Completion API（OpenAI 兼容格式）
   * @param {Array<{role: string, content: string}>} messages - 对话消息数组
   * @param {Object} [options] - 可选参数
   * @param {boolean} [options.jsonMode] - 是否启用 JSON 模式（response_format: json_object）
   * @param {string} [options.model] - 模型名称，默认 deepseek-chat
   * @param {number} [options.temperature] - 温度参数，默认 0.3
   * @param {number} [options.maxTokens] - 最大 token 数，默认 4096
   * @returns {Promise<string>} API 返回的文本内容（choices[0].message.content）
   */
  async function chatCompletion(messages, options) {
    options = options || {};
    var config = getConfig();

    if (!config.apiKey) {
      throw new Error('API Key 未配置，请在设置中填写 DeepSeek API Key');
    }

    var baseUrl = config.baseUrl.replace(/\/+$/, ''); // 去掉末尾斜杠
    var url = baseUrl + '/chat/completions';

    // 构建请求体
    var body = {
      model:       options.model || DEFAULT_MODEL,
      messages:    messages,
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      max_tokens:  options.maxTokens || 4096
    };

    // JSON 模式：要求 API 返回严格 JSON
    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // 发送请求
    var response;
    try {
      response = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + config.apiKey
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('网络请求失败：' + e.message);
    }

    // 检查 HTTP 状态码
    if (!response.ok) {
      var errorText;
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = '无法读取错误详情';
      }
      throw new Error('API 请求失败 (HTTP ' + response.status + ')：' + errorText);
    }

    // 解析响应
    var data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error('API 响应 JSON 解析失败：' + e.message);
    }

    // 提取返回内容
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('API 响应格式异常：缺少 choices[0].message');
    }

    return data.choices[0].message.content;
  }

  // ============================================================
  // 抽样工具函数
  // ============================================================

  /**
   * 从消息数组中抽样：取前 count 条 + 中间 count 条 + 后 count 条
   * 保留原始顺序，自动去重（同一消息不会出现在多个分段中）
   * @param {Object[]} msgs - 已排序的消息数组
   * @param {number} count - 每段抽样数量，默认 10
   * @returns {Object[]} 抽样后的消息数组（仍按时间排序）
   */
  function sampleMessages(msgs, count) {
    count = count || 10;
    if (msgs.length <= count * 3) {
      return msgs.slice(); // 消息太少，全部保留
    }

    var len = msgs.length;
    var midStart = Math.floor((len - count) / 2);

    var first  = msgs.slice(0, count);
    var middle = msgs.slice(midStart, midStart + count);
    var last   = msgs.slice(len - count);

    // 合并三段并排序去重（以 timestamp 为键）
    var seen = {};
    var combined = first.concat(middle).concat(last);
    var result = [];
    for (var i = 0; i < combined.length; i++) {
      // 以 timestamp + 索引去重（同一条消息的三段合并可能出现重复）
      var key = combined[i].timestamp + '_' + i;
      if (!seen[key]) {
        seen[key] = true;
        result.push(combined[i]);
      }
    }

    // 按时间排序
    result.sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });

    return result;
  }

  /**
   * 将单条消息格式化为对话样本行
   * 格式："[date hour:00] 我/对方: content"
   * @param {Object} msg - 解析后的消息对象
   * @returns {string} 格式化的对话行
   */
  function formatDialogLine(msg) {
    var role = msg.isMine ? '我' : '对方';
    // 截断过长内容，避免超出 token 限制
    var content = msg.content || '';
    if (content.length > 100) {
      content = content.slice(0, 100) + '...';
    }
    return '[' + msg.dateStr + ' ' + String(msg.hour).padStart(2, '0') + ':00] ' + role + ': ' + content;
  }

  // ============================================================
  // 第一轮：月度扫描
  // ============================================================

  /**
   * 第一轮分析：逐月扫描聊天记录，生成月度关系指标
   * 对每个月份进行抽样后调用 AI 分析该月的关系状态
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object} meta - 元信息对象
   * @param {Function} onProgress - 进度回调 (statusMessage: string) => void
   * @returns {Promise<Object[]>} 月度分析结果数组
   */
  async function round1_monthlyScan(messages, meta, onProgress) {
    // 第一步：按月份分组消息
    var monthlyGroups = {};
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var key = m.monthStr;
      if (!monthlyGroups[key]) {
        monthlyGroups[key] = [];
      }
      monthlyGroups[key].push(m);
    }

    var monthKeys = Object.keys(monthlyGroups).sort();
    var monthlyResults = [];

    if (onProgress) {
      onProgress('开始逐月分析，共 ' + monthKeys.length + ' 个月份...');
    }

    // 第二步：逐月分析
    for (var mi = 0; mi < monthKeys.length; mi++) {
      var monthStr = monthKeys[mi];
      var monthMsgs = monthlyGroups[monthStr];

      if (onProgress) {
        onProgress('正在分析 ' + monthStr + '（' + (mi + 1) + '/' + monthKeys.length + '）...');
      }

      // 抽样：取前10 + 中间10 + 后10，去重后构建对话样本
      var sampled = sampleMessages(monthMsgs, 10);
      var dialogLines = [];
      for (var s = 0; s < sampled.length; s++) {
        dialogLines.push(formatDialogLine(sampled[s]));
      }
      var dialogSample = dialogLines.join('\n');

      // 统计我/对方消息数量
      var myCount = 0;
      var otherCount = 0;
      for (var c = 0; c < monthMsgs.length; c++) {
        if (monthMsgs[c].isMine) {
          myCount++;
        } else {
          otherCount++;
        }
      }

      // 第三步：调用 AI 分析该月
      var systemPrompt = '你是一个感情分析师，擅长从聊天记录中分析两人的关系发展阶段。请严格返回JSON格式。';
      var userPrompt =
        '以下是 ' + monthStr + ' 的微信聊天记录抽样（共 ' + monthMsgs.length + ' 条消息，我发送 ' + myCount + ' 条，对方发送 ' + otherCount + ' 条）：\n\n' +
        dialogSample + '\n\n' +
        '请分析这个月两人的关系状态，以JSON格式返回（不要包含其他文字）：\n' +
        '{\n' +
        '  "month": "' + monthStr + '",\n' +
        '  "totalMessages": ' + monthMsgs.length + ',\n' +
        '  "myMessages": ' + myCount + ',\n' +
        '  "intimacy": 数字(0-100，亲密程度),\n' +
        '  "depth": 数字(0-100，对话深度),\n' +
        '  "ambiguity": 数字(0-100，暧昧程度),\n' +
        '  "summary": "一句话中文总结这段关系当月状态",\n' +
        '  "keyTopics": ["话题1", "话题2", ...]\n' +
        '}';

      try {
        var response = await chatCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          { jsonMode: true, temperature: 0.3 }
        );

        var parsed = JSON.parse(response);
        monthlyResults.push(parsed);
      } catch (e) {
        // AI 分析失败时使用 fallback 数据，保证流程不中断
        console.error('月度分析失败 (' + monthStr + ')：', e);
        monthlyResults.push({
          month: monthStr,
          totalMessages: monthMsgs.length,
          myMessages: myCount,
          intimacy: 0,
          depth: 0,
          ambiguity: 0,
          summary: monthStr + '（AI分析不可用）',
          keyTopics: []
        });
      }
    }

    return monthlyResults;
  }

  // ============================================================
  // 第二轮：全局总结
  // ============================================================

  /**
   * 第二轮分析：基于月度结果生成全局关系总结
   * 识别关系发展阶段、趋势和总体概括
   * @param {Object[]} monthlyResults - 第一轮输出的月度分析结果数组
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} { phases: Array, trend: Object, overallSummary: string }
   */
  async function round2_globalSummary(monthlyResults, onProgress) {
    if (onProgress) {
      onProgress('正在进行全局总结分析...');
    }

    // 构建月度摘要字符串
    var summaryLines = [];
    for (var i = 0; i < monthlyResults.length; i++) {
      var r = monthlyResults[i];
      summaryLines.push(
        r.month + ' | 消息:' + r.totalMessages +
        ' | 亲密:' + r.intimacy +
        ' | 深度:' + r.depth +
        ' | 暧昧:' + r.ambiguity +
        ' | ' + r.summary
      );
    }
    var summaryStr = summaryLines.join('\n');

    var systemPrompt = '你是一个感情分析师，擅长从聊天记录中分析两人的关系发展阶段。请严格返回JSON格式。';
    var userPrompt =
      '以下是两人从开始到现在的逐月关系分析摘要：\n\n' +
      summaryStr + '\n\n' +
      '请根据以上数据，以JSON格式返回全局分析结果（不要包含其他文字）：\n' +
      '{\n' +
      '  "phases": [\n' +
      '    {"name": "阶段名称", "start": "YYYY-MM", "end": "YYYY-MM", "avgIntimacy": 数字, "description": "阶段描述"}\n' +
      '  ],\n' +
      '  "trend": {\n' +
      '    "direction": "rising|declining|stable|fluctuating|unknown",\n' +
      '    "description": "趋势描述"\n' +
      '  },\n' +
      '  "overallSummary": "整体关系总结（100-150字）"\n' +
      '}';

    try {
      var response = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        { jsonMode: true, temperature: 0.5 }
      );

      return JSON.parse(response);
    } catch (e) {
      console.error('全局总结分析失败：', e);
      return {
        phases: [],
        trend: {
          direction: 'unknown',
          description: 'AI分析暂不可用'
        },
        overallSummary: ''
      };
    }
  }

  // ============================================================
  // 第三轮：里程碑提取
  // ============================================================

  /**
   * 第三轮分析：从各阶段中提取关键里程碑事件
   * 对每个关系阶段分别抽样，识别转折点事件
   * @param {Object[]} messages - 已按时间排序的消息数组
   * @param {Object[]} phases - 第二轮输出的阶段数组
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} { milestones: Array }
   */
  async function round3_milestones(messages, phases, onProgress) {
    if (!phases || phases.length === 0) {
      return { milestones: [] };
    }

    if (onProgress) {
      onProgress('正在提取关键里程碑...');
    }

    // 为每个阶段构建对话样本（前8 + 后8）
    var phaseSamples = [];

    for (var p = 0; p < phases.length; p++) {
      var phase = phases[p];
      var phaseStart = phase.start;
      var phaseEnd = phase.end;

      // 筛选该阶段的消息
      var phaseMsgs = [];
      for (var m = 0; m < messages.length; m++) {
        if (messages[m].monthStr >= phaseStart && messages[m].monthStr <= phaseEnd) {
          phaseMsgs.push(messages[m]);
        }
      }

      if (phaseMsgs.length === 0) continue;

      // 抽样前8条 + 后8条
      var firstCount = Math.min(8, phaseMsgs.length);
      var lastCount = Math.min(8, phaseMsgs.length);

      var sampled = phaseMsgs.slice(0, firstCount);
      if (phaseMsgs.length > firstCount + lastCount) {
        // 有足够消息时，后半段从末尾取
        var lastSamples = phaseMsgs.slice(phaseMsgs.length - lastCount);
        sampled = sampled.concat(lastSamples);
      } else if (phaseMsgs.length > firstCount) {
        // 消息不够分段时，取前8后放弃，改为全部保留
        sampled = phaseMsgs.slice();
      }

      // 去重 + 排序
      sampled.sort(function(a, b) {
        return a.timestamp - b.timestamp;
      });

      // 构建该阶段的对话样本
      var dialogLines = [];
      for (var s = 0; s < sampled.length; s++) {
        dialogLines.push(formatDialogLine(sampled[s]));
      }

      phaseSamples.push(
        '【阶段：' + phase.name + '（' + phaseStart + ' ~ ' + phaseEnd + '）】\n' +
        dialogLines.join('\n')
      );
    }

    var samplesStr = phaseSamples.join('\n\n---\n\n');

    var systemPrompt = '你是一个感情分析师，擅长从聊天记录中分析两人的关系发展阶段。请严格返回JSON格式。';
    var userPrompt =
      '以下是两人聊天记录中各阶段的对话抽样：\n\n' +
      samplesStr + '\n\n' +
      '请从这些对话中提取 5-10 个关键里程碑事件，以JSON格式返回（不要包含其他文字）：\n' +
      '{\n' +
      '  "milestones": [\n' +
      '    {\n' +
      '      "date": "YYYY-MM-DD 或 YYYY-MM",\n' +
      '      "title": "里程碑标题",\n' +
      '      "importance": 数字(1-10，重要程度),\n' +
      '      "summary": "一句话描述（不超过30字）",\n' +
      '      "category": "first_contact|deep_talk|nickname|date_mention|confession|other"\n' +
      '    }\n' +
      '  ]\n' +
      '}';

    try {
      var response = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        { jsonMode: true, temperature: 0.5 }
      );

      return JSON.parse(response);
    } catch (e) {
      console.error('里程碑提取失败：', e);
      return { milestones: [] };
    }
  }

  // ============================================================
  // 主入口：analyze — 完整三轮递进分析
  // ============================================================

  /**
   * 执行完整的三轮递进 AI 分析
   * 第一轮：逐月扫描 → 第二轮：全局总结 → 第三轮：里程碑提取
   * 分析结果自动保存到 localStorage
   * @param {Object[]} messages - RLT.parser.parse() 返回的消息数组
   * @param {Object} meta - RLT.parser.parse() 返回的元信息对象
   * @param {Function} [onProgress] - 进度回调 (statusMessage: string) => void
   * @returns {Promise<Object>} 完整的分析结果对象
   */
  async function analyze(messages, meta, onProgress) {
    // 检查 API Key 是否已配置
    if (!isConfigured()) {
      return {
        degraded: true,
        reason: '未配置API Key'
      };
    }

    // ==========================================================
    // 第一轮：月度扫描
    // ==========================================================
    if (onProgress) {
      onProgress('第一轮：月度扫描分析中...');
    }

    var monthly;
    try {
      monthly = await round1_monthlyScan(messages, meta, onProgress);
    } catch (e) {
      console.error('第一轮月度扫描异常：', e);
      monthly = [];
    }

    // ==========================================================
    // 第二轮：全局总结
    // ==========================================================
    if (onProgress) {
      onProgress('第二轮：全局关系总结中...');
    }

    var globalResult;
    try {
      globalResult = await round2_globalSummary(monthly, onProgress);
    } catch (e) {
      console.error('第二轮全局总结异常：', e);
      globalResult = {
        phases: [],
        trend: { direction: 'unknown', description: 'AI分析暂不可用' },
        overallSummary: ''
      };
    }

    // ==========================================================
    // 第三轮：里程碑提取
    // ==========================================================
    if (onProgress) {
      onProgress('第三轮：里程碑提取中...');
    }

    var milestoneResult;
    try {
      milestoneResult = await round3_milestones(messages, globalResult.phases, onProgress);
    } catch (e) {
      console.error('第三轮里程碑提取异常：', e);
      milestoneResult = { milestones: [] };
    }

    // ==========================================================
    // 合并结果
    // ==========================================================
    var result = {
      degraded: false,
      monthly: monthly
    };

    // 合并全局总结字段
    if (globalResult.phases !== undefined) {
      result.phases = globalResult.phases;
    }
    if (globalResult.trend !== undefined) {
      result.trend = globalResult.trend;
    }
    if (globalResult.overallSummary !== undefined) {
      result.overallSummary = globalResult.overallSummary;
    }

    // 合并里程碑字段
    if (milestoneResult.milestones !== undefined) {
      result.milestones = milestoneResult.milestones;
    }

    // 保存到 localStorage
    RLT.storage.save(RLT.storage.KEYS.AI_RESULT, result);

    if (onProgress) {
      onProgress('AI 分析完成！');
    }

    return result;
  }

  // ============================================================
  // 公开 API
  // ============================================================
  return {
    isConfigured:   isConfigured,
    getConfig:      getConfig,
    analyze:        analyze,
    chatCompletion: chatCompletion
  };
})();
