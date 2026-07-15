// js/app.js — Vue 3 应用主控 & 视图路由 & 组件注册
// 依赖：Vue 3 CDN（index.html 加载），RLT.* 模块（storage/parser/stats/ai/charts）
// 职责：创建 Vue 应用、管理全局状态、注册子组件、编排数据流
// 数据流：import → parse → stats → AI → render charts → dashboard

(function() {
  'use strict';

  // 检查依赖是否就绪
  if (typeof Vue === 'undefined') {
    console.error('[app] Vue 3 未加载，请检查 index.html 中的 CDN 引用');
    return;
  }
  if (typeof RLT === 'undefined') {
    console.error('[app] RLT 模块未加载，请按依赖顺序引入 js 文件');
    return;
  }

  var createApp = Vue.createApp;
  var ref = Vue.ref;
  var reactive = Vue.reactive;
  var toRefs = Vue.toRefs;
  var onMounted = Vue.onMounted;
  var nextTick = Vue.nextTick;
  var watch = Vue.watch;

  // ============================================================
  // 状态提示 — 自动消失的状态通知条
  // ============================================================
  var _statusTimer = null;
  function showStatus(msg, type) {
    if (_statusTimer) {
      clearTimeout(_statusTimer);
      _statusTimer = null;
    }
    var st = window.__appState;
    if (!st) return;
    st.statusMsg = msg;
    st.statusType = type || '';
    // 5 秒后自动清除
    _statusTimer = setTimeout(function() {
      if (st) {
        st.statusMsg = '';
        st.statusType = '';
      }
      _statusTimer = null;
    }, 5000);
  }

  // ============================================================
  // 仪表盘图表渲染 — 调用 RLT.charts.render() 绘制全部 8 张图表
  // ============================================================
  function renderDashboardCharts() {
    var st = window.__appState;
    if (!st || !st.statsData) return;

    var statsData = st.statsData;
    var aiResult = st.aiResult;

    // 注意：图表容器 DOM 可能尚未挂载（Vue 异步渲染），需容错
    // 传入额外的 AI 月度数据供 trend 图表叠加亲密值曲线
    var chartData = {
      dailyCounts:       statsData.dailyCounts,
      monthlyCounts:     statsData.monthlyCounts,
      wordFrequency:     statsData.wordFrequency,
      hourlyHeatmap:     statsData.hourlyHeatmap,
      calendarHeatmap:   statsData.calendarHeatmap,
      emojiTrends:       statsData.emojiTrends,
      nightOwlStats:     statsData.nightOwlStats,
      balance:           statsData.balance,
      monthlyResults:    aiResult && aiResult.monthly ? aiResult.monthly : null
    };

    // 8 张图表的渲染配置：[id, type, dataKey]
    var charts = [
      ['chart-trend',     'trend',     chartData],
      ['chart-volume',    'volume',    chartData.monthlyCounts],
      ['chart-wordcloud', 'wordcloud', chartData.wordFrequency],
      ['chart-heatmap',   'heatmap',   chartData.hourlyHeatmap],
      ['chart-balance',   'balance',   chartData.balance],
      ['chart-calendar',  'calendar',  chartData.calendarHeatmap],
      ['chart-nightowl',  'nightowl',  chartData.nightOwlStats],
      ['chart-emoji',     'emoji',     chartData.emojiTrends]
    ];

    // 使用 nextTick 确保 DOM 就绪后再渲染
    nextTick(function() {
      for (var i = 0; i < charts.length; i++) {
        var c = charts[i];
        try {
          RLT.charts.render(c[0], c[1], c[2]);
        } catch (e) {
          console.error('[app] 图表渲染失败 (' + c[0] + '/' + c[1] + ')：', e);
        }
      }
    });
  }

  // ============================================================
  // 时间线渲染
  // ============================================================
  function renderTimelineView() {
    var container = document.getElementById('timeline-container');
    if (!container) return;

    var st = window.__appState;
    var aiResult = st ? st.aiResult : null;
    var phases = aiResult ? (aiResult.phases || []) : [];
    var milestones = aiResult ? (aiResult.milestones || []) : [];

    // 优先使用 RLT.timeline 模块（如果已实现）
    if (RLT.timeline && typeof RLT.timeline.render === 'function') {
      nextTick(function() {
        try {
          RLT.timeline.render(container, { phases: phases, milestones: milestones });
        } catch (e) {
          console.error('[app] RLT.timeline.render 调用失败：', e);
          fallbackTimelineRender(container, phases, milestones);
        }
      });
      return;
    }

    // 无 RLT.timeline 模块时使用内联渲染
    fallbackTimelineRender(container, phases, milestones);
  }

  /**
   * 内联时间线渲染（当 RLT.timeline 模块不可用时的降级方案）
   * 直接用 CSS 类名构建 HTML 结构，使用与 CSS 中 .timeline-* 一致的类名
   */
  function fallbackTimelineRender(container, phases, milestones) {
    if ((!phases || phases.length === 0) && (!milestones || milestones.length === 0)) {
      container.innerHTML =
        '<div style="text-align:center; padding:60px 20px; color:var(--text-secondary);">' +
        '<div style="font-size:48px; margin-bottom:16px;">⏳</div>' +
        '<p>暂无时间线数据</p>' +
        '<p style="font-size:13px; color:var(--text-muted);">请先导入聊天记录并完成 AI 分析</p>' +
        '</div>';
      return;
    }

    var html = '<div class="timeline-track">';

    // 渲染关系阶段标签
    if (phases && phases.length > 0) {
      for (var i = 0; i < phases.length; i++) {
        var phase = phases[i];
        html +=
          '<div class="timeline-phase-label">' +
          escapeHtml(phase.name || '阶段') +
          ' <span style="font-size:11px;opacity:0.7;">' +
          escapeHtml(phase.start || '') + ' ~ ' + escapeHtml(phase.end || '') +
          '</span></div>';
        if (phase.description) {
          html += '<p style="font-size:12px; color:var(--text-secondary); margin:4px 0 16px 0;">' +
            escapeHtml(phase.description) + '</p>';
        }
        if (phase.avgIntimacy !== undefined) {
          html += '<p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">' +
            '平均亲密值：' + phase.avgIntimacy + '</p>';
        }
      }
    }

    // 渲染里程碑卡片
    if (milestones && milestones.length > 0) {
      // 按重要性降序排列
      var sorted = milestones.slice().sort(function(a, b) {
        return (b.importance || 0) - (a.importance || 0);
      });

      for (var j = 0; j < sorted.length; j++) {
        var m = sorted[j];
        var categoryLabel = getCategoryLabel(m.category);
        html +=
          '<div class="timeline-milestone">' +
          '<div class="timeline-milestone-card">' +
          '<div class="date">' + escapeHtml(m.date || '') +
          ' <span style="margin-left:8px;font-size:10px;padding:2px 8px;border-radius:10px;' +
          'background:var(--accent-dim);color:var(--accent);">' + categoryLabel + '</span>' +
          '</div>' +
          '<h4>' + escapeHtml(m.title || '') +
          ' <span style="font-size:11px;color:var(--text-muted);">★'.repeat(m.importance || 1) + '</span>' +
          '</h4>' +
          '<p>' + escapeHtml(m.summary || '') + '</p>' +
          '</div></div>';
      }
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /** HTML 转义，防止 XSS */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 里程碑分类的中文标签 */
  function getCategoryLabel(cat) {
    var map = {
      'first_contact': '初次接触',
      'deep_talk': '深度交流',
      'nickname': '称呼变化',
      'date_mention': '约会提及',
      'confession': '表白/确认',
      'other': '其他'
    };
    return map[cat] || cat || '事件';
  }

  // ============================================================
  // AI 分析编排
  // ============================================================
  async function runAnalysis(messages, meta) {
    var st = window.__appState;
    if (!st) return;

    st.loading = true;
    st.loadingMsg = '正在计算统计数据...';

    // 第一步：同步计算统计数据（st stats 模块为纯计算，无异步操作）
    var statsData;
    try {
      statsData = RLT.stats.compute(messages, meta);
      st.statsData = statsData;
      // 保存到 localStorage，便于页面刷新后恢复
      RLT.storage.save(RLT.storage.KEYS.STATS_RESULT, statsData);
    } catch (e) {
      console.error('[app] 统计计算失败：', e);
      showStatus('统计计算失败：' + e.message, 'error');
      st.loading = false;
      st.loadingMsg = '';
      return;
    }

    // 第二步：AI 分析（如果已配置 API Key）
    if (RLT.ai.isConfigured()) {
      try {
        var aiResult = await RLT.ai.analyze(messages, meta, function(msg) {
          if (st) {
            st.loadingMsg = msg;
          }
        });

        if (aiResult.degraded) {
          showStatus('AI 分析未执行：' + (aiResult.reason || '未知原因'), 'warning');
        } else {
          st.aiResult = aiResult;
        }
      } catch (e) {
        console.error('[app] AI 分析异常：', e);
        showStatus('AI 分析失败：' + e.message, 'error');
        // AI 分析失败不阻断流程，仍可展示统计数据
      }
    } else {
      // 未配置 API Key，静默跳过 AI 分析
      st.aiResult = null;
    }

    // 第三步：完成，切换到仪表盘
    st.loading = false;
    st.loadingMsg = '';
    switchView('dashboard');
  }

  // ============================================================
  // 视图切换 — 仅设置视图状态，所有副作用由 watch 统一处理
  // 这样无论是 switchView() 调用还是模板中直接赋值 currentView = 'xxx'
  // 都会触发相同的 localStorage 保存 + 图表渲染逻辑
  // ============================================================
  function switchView(view) {
    var st = window.__appState;
    if (!st) return;
    st.currentView = view;
  }

  // ============================================================
  // 数据加载入口 — 由 import-view 组件的 loaded 事件触发
  // ============================================================
  async function onDataLoaded(parsedData) {
    var st = window.__appState;
    if (!st) return;

    // 保存解析结果到状态
    st.messages = parsedData.messages;
    st.meta = parsedData.meta;

    // 保存元信息到 localStorage
    RLT.storage.save(RLT.storage.KEYS.CHAT_META, st.meta);

    // 数据校验 — 展示非阻塞警告
    var warnings = RLT.parser.validate(st.meta);
    if (warnings.length > 0) {
      showStatus(warnings[0], 'warning');
    }

    // 执行分析流程
    await runAnalysis(parsedData.messages, parsedData.meta);
  }

  // ============================================================
  // 重置所有数据
  // ============================================================
  function resetAll() {
    var st = window.__appState;
    if (!st) return;

    if (!confirm('确定要清除所有数据吗？此操作将删除所有分析结果，不可撤销。')) {
      return;
    }

    // 销毁所有图表实例
    RLT.charts.disposeAll();

    // 清除 localStorage 中的所有数据
    RLT.storage.clear();

    // 重置应用状态
    st.currentView = 'import';
    st.loading = false;
    st.loadingMsg = '';
    st.statusMsg = '';
    st.statusType = '';
    st.reportPage = 0;
    st.messages = [];
    st.meta = null;
    st.statsData = null;
    st.aiResult = null;
  }

  // ============================================================
  // 局部状态恢复 — 从 localStorage 恢复已保存的分析结果
  // ============================================================
  function restoreSavedState(st) {
    var savedMeta = RLT.storage.load(RLT.storage.KEYS.CHAT_META);
    var savedStats = RLT.storage.load(RLT.storage.KEYS.STATS_RESULT);
    var savedAI = RLT.storage.load(RLT.storage.KEYS.AI_RESULT);
    var savedView = RLT.storage.load(RLT.storage.KEYS.CURRENT_VIEW);

    // 必须有元信息和统计数据才算有效恢复
    if (!savedMeta || !savedStats) {
      return false;
    }

    st.meta = savedMeta;
    st.statsData = savedStats;
    st.aiResult = savedAI || null;

    // 恢复上次的视图（默认为仪表盘）
    var view = savedView || 'dashboard';
    if (view === 'import') {
      view = 'dashboard'; // 恢复时不回退到导入页
    }
    switchView(view);

    return true;
  }

  // ============================================================
  // 年度报告页面数据 — 根据统计数据生成分页报告内容
  // ============================================================
  function getReportPages(statsData, aiResult, meta) {
    if (!statsData || !meta) return [];

    var pages = [];

    // 第 1 页：数据概览
    var firstDate = meta.dateRangeStart || '';
    var lastDate = meta.dateRangeEnd || '';
    pages.push({
      emoji: '📊',
      title: '数据总览',
      content: '从 ' + firstDate + ' 到 ' + lastDate +
        '，你们一共聊了 ' + meta.totalMessages + ' 条消息，' +
        '跨越 ' + meta.durationDays + ' 天。' +
        '其中你发送了 ' + meta.myMessages + ' 条，对方发送了 ' + meta.otherMessages + ' 条。'
    });

    // 第 2 页：活跃统计
    if (statsData.monthlyCounts && statsData.monthlyCounts.length > 0) {
      var peakMonth = statsData.monthlyCounts.reduce(function(a, b) {
        return (a.total || 0) > (b.total || 0) ? a : b;
      });
      var avgDaily = meta.durationDays > 0
        ? (meta.totalMessages / meta.durationDays).toFixed(1)
        : '0';

      var peakHour = '';
      var peakDay = '';
      if (statsData.hourlyHeatmap) {
        var maxCount = 0;
        for (var i = 0; i < statsData.hourlyHeatmap.length; i++) {
          var item = statsData.hourlyHeatmap[i];
          if (item[2] > maxCount) {
            maxCount = item[2];
            peakHour = String(item[0]).padStart(2, '0') + ':00';
            var dayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            peakDay = dayMap[item[1]];
          }
        }
      }

      pages.push({
        emoji: '🔥',
        title: '活跃度分析',
        content: '你们聊天最频繁的月份是 ' + (peakMonth.month || '') +
          '（共 ' + (peakMonth.total || 0) + ' 条）。' +
          '平均每天发送 ' + avgDaily + ' 条消息。' +
          (peakHour ? '最活跃的时段是 ' + peakDay + ' ' + peakHour + ' 左右。' : '')
      });
    }

    // 第 3 页：深夜指数
    if (statsData.nightOwlStats && statsData.nightOwlStats.length > 0) {
      var totalNight = 0;
      var totalAll = 0;
      for (var n = 0; n < statsData.nightOwlStats.length; n++) {
        totalNight += statsData.nightOwlStats[n].nightCount || 0;
        totalAll += statsData.nightOwlStats[n].totalCount || 0;
      }
      var nightRatio = totalAll > 0 ? (totalNight / totalAll * 100).toFixed(1) : '0';

      var nightLevel = '';
      if (parseFloat(nightRatio) > 20) nightLevel = '夜猫子级别';
      else if (parseFloat(nightRatio) > 10) nightLevel = '偶尔熬夜';
      else nightLevel = '作息规律';

      pages.push({
        emoji: '🌙',
        title: '深夜聊天指数',
        content: '在 ' + totalNight + ' 条深夜消息中（22:00~02:00），' +
          '占全部消息的 ' + nightRatio + '%。' + nightLevel + '。'
      });
    }

    // 第 4 页：互动天平
    if (statsData.balance && statsData.balance.overall) {
      var overall = statsData.balance.overall;
      var whoMore = overall.mine > overall.other ? '你更主动一些' :
        (overall.mine < overall.other ? '对方更主动一些' : '你们势均力敌');

      pages.push({
        emoji: '⚖️',
        title: '互动天平',
        content: whoMore + '。你发送了 ' + overall.mine + ' 条消息（' +
          (overall.minePercent || '0') + '%），' +
          '对方发送了 ' + overall.other + ' 条消息。'
      });
    }

    // 第 5 页：高频词汇
    if (statsData.wordFrequency && statsData.wordFrequency.length > 0) {
      var top5Words = statsData.wordFrequency.slice(0, 5).map(function(w) {
        return w.name;
      }).join('、');

      pages.push({
        emoji: '💬',
        title: '高频词汇',
        content: '你们聊天中出现最多的词是：' + top5Words + '。' +
          '这些词语勾勒出了你们日常交流的主题和氛围。'
      });
    }

    // 第 6 页：Emoji 偏好
    if (statsData.emojiTrends && statsData.emojiTrends.top10 && statsData.emojiTrends.top10.length > 0) {
      var top5Emoji = statsData.emojiTrends.top10.slice(0, 5).join(' ');

      pages.push({
        emoji: '😊',
        title: 'Emoji 偏好',
        content: '你们最爱用的 Emoji：' + top5Emoji + '。' +
          '表情符号是感情的调味剂，每一个 Emoji 背后都有独特的含义。'
      });
    }

    // 第 7 页：关系阶段（AI 分析结果）
    if (aiResult && aiResult.phases && aiResult.phases.length > 0) {
      var phaseNames = aiResult.phases.map(function(p) { return p.name; }).join(' → ');
      pages.push({
        emoji: '💕',
        title: '关系阶段',
        content: 'AI 识别出的关系发展阶段：' + phaseNames + '。' +
          (aiResult.trend ? '整体趋势：' + (aiResult.trend.description || '') : '')
      });
    }

    // 第 8 页：AI 寄语
    if (aiResult && aiResult.overallSummary) {
      pages.push({
        emoji: '💌',
        title: 'AI 寄语',
        content: aiResult.overallSummary
      });
    }

    return pages;
  }

  // ============================================================
  // 组件：import-view — 文件导入 + API Key 配置
  // ============================================================
  var ImportView = {
    name: 'ImportView',
    template:
      '<div class="import-view">' +
        '<div class="import-card" :class="{ dragover: isDragover }"' +
        '  @dragover.prevent="isDragover = true"' +
        '  @dragleave="isDragover = false"' +
        '  @drop.prevent="handleDrop">' +
        '  <div class="import-icon">📁</div>' +
        '  <h2>导入聊天记录</h2>' +
        '  <p>拖拽 WeChatMsg 导出的 JSON 文件到此处，或点击下方按钮选择文件</p>' +
        '  <input type="file" ref="fileInput" accept=".json"' +
        '    style="display:none" @change="handleFileSelect" />' +
        '  <button class="btn-primary" @click="$refs.fileInput.click()" :disabled="parsing">' +
        '    {{ parsing ? \'⏳ 解析中...\' : \'📂 选择 JSON 文件\' }}' +
        '  </button>' +
        '  <div v-if="parseError" class="status-bar error" style="margin-top:12px; border-radius:6px;">' +
        '    {{ parseError }}' +
        '  </div>' +
        '  <div v-if="parseSuccess" style="margin-top:16px;">' +
        '    <div style="color:var(--success); font-size:14px; margin-bottom:8px;">' +
        '      ✅ 成功解析 <strong>{{ parsedMeta.totalMessages }}</strong> 条消息' +
        '      <span style="font-size:12px;color:var(--text-secondary);">' +
        '        （{{ parsedMeta.dateRangeStart }} ~ {{ parsedMeta.dateRangeEnd }}）' +
        '      </span>' +
        '    </div>' +
        '    <div class="api-key-section">' +
        '      <label>🔑 DeepSeek API Key（可选，用于 AI 情感分析）</label>' +
        '      <div class="api-key-input">' +
        '        <input v-model="apiKey" type="password" placeholder="sk-..." @input="saveApiKey" />' +
        '      </div>' +
        '      <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">' +
        '        API Key 仅存储在浏览器本地，不会上传至任何服务器</p>' +
        '    </div>' +
        '    <button class="btn-primary" @click="startAnalysis" style="margin-top:16px; width:100%;">' +
        '      🚀 开始分析' +
        '    </button>' +
        '  </div>' +
        '</div>' +
      '</div>',
    emits: ['loaded'],
    setup: function(props, ctx) {
      var isDragover = ref(false);
      var parsing = ref(false);
      var parseError = ref('');
      var parseSuccess = ref(false);
      var parsedMeta = ref(null);
      var apiKey = ref(RLT.storage.load(RLT.storage.KEYS.API_KEY) || '');

      // 闭包持有解析结果，避免暴露在模板中
      var _parsedData = null;

      function saveApiKey() {
        if (apiKey.value) {
          RLT.storage.save(RLT.storage.KEYS.API_KEY, apiKey.value);
        } else {
          localStorage.removeItem(RLT.storage.KEYS.API_KEY);
        }
      }

      /**
       * 处理用户选择的文件：读取 → JSON 解析 → 校验
       * 文件读取使用 FileReader，支持拖拽和文件选择两种方式
       */
      function processFile(file) {
        // 重置状态
        parseError.value = '';
        parseSuccess.value = false;
        _parsedData = null;
        parsing.value = true;

        // 文件类型校验（宽松校验，允许无扩展名的情况）
        if (!file) {
          parseError.value = '未选择文件';
          parsing.value = false;
          return;
        }

        var reader = new FileReader();

        reader.onload = function(e) {
          try {
            var result = RLT.parser.parse(e.target.result);
            if (result.success) {
              _parsedData = result.data;
              parsedMeta.value = result.data.meta;
              parseSuccess.value = true;
            } else {
              parseError.value = result.error;
            }
          } catch (err) {
            console.error('[import-view] 解析异常：', err);
            parseError.value = '解析过程发生异常：' + err.message;
          }
          parsing.value = false;
        };

        reader.onerror = function() {
          parseError.value = '文件读取失败，请确认文件未被占用且格式正确';
          parsing.value = false;
        };

        reader.readAsText(file);
      }

      function handleDrop(e) {
        isDragover.value = false;
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          processFile(files[0]);
        }
      }

      function handleFileSelect(e) {
        var files = e.target && e.target.files;
        if (files && files.length > 0) {
          processFile(files[0]);
        }
      }

      /**
       * "开始分析"按钮点击 → 向父组件发射 loaded 事件
       * 父组件（root setup）的 onDataLoaded 接收并执行分析流程
       */
      function startAnalysis() {
        if (_parsedData) {
          ctx.emit('loaded', _parsedData);
        }
      }

      return {
        isDragover: isDragover,
        parsing: parsing,
        parseError: parseError,
        parseSuccess: parseSuccess,
        parsedMeta: parsedMeta,
        apiKey: apiKey,
        saveApiKey: saveApiKey,
        handleDrop: handleDrop,
        handleFileSelect: handleFileSelect,
        startAnalysis: startAnalysis
      };
    }
  };

  // ============================================================
  // 组件：dashboard-view — 完整仪表盘（所有数据面板）
  // 通过 $state 全局属性访问应用状态数据
  // ============================================================
  var DashboardView = {
    name: 'DashboardView',
    // 模板使用 $state 直接访问全局状态（通过 app.config.globalProperties 注入）
    template:
      '<div>' +
        // ========== 加载遮罩 ==========
        '<div v-if="$state.loading" class="loading-overlay">' +
        '  <div class="spinner"></div>' +
        '  <div style="color:var(--text-secondary); font-size:14px;">{{ $state.loadingMsg || \'分析中...\' }}</div>' +
        '</div>' +

        // ========== 头部统计卡片 ==========
        '<div class="dashboard-grid" v-if="$state.meta">' +
        '  <div class="card dashboard-full" style="display:flex; gap:20px; justify-content:space-around; flex-wrap:wrap;">' +
        '    <div style="text-align:center;">' +
        '      <div class="stat-number">{{ ($state.meta.totalMessages || 0).toLocaleString() }}</div>' +
        '      <div class="stat-label">总消息数</div>' +
        '    </div>' +
        '    <div style="text-align:center;">' +
        '      <div class="stat-number">{{ $state.meta.durationDays || 0 }}</div>' +
        '      <div class="stat-label">跨越天数</div>' +
        '    </div>' +
        '    <div style="text-align:center;">' +
        '      <div class="stat-number" style="color:var(--accent);">{{ ($state.meta.myMessages || 0).toLocaleString() }}</div>' +
        '      <div class="stat-label">我发送的消息</div>' +
        '    </div>' +
        '    <div style="text-align:center;">' +
        '      <div class="stat-number" style="color:#b98eff;">{{ ($state.meta.otherMessages || 0).toLocaleString() }}</div>' +
        '      <div class="stat-label">对方发送的消息</div>' +
        '    </div>' +
        '  </div>' +

        // ========== 核心图表 2×2 ==========
        '  <div class="card">' +
        '    <div class="card-title">📈 感情趋势</div>' +
        '    <div id="chart-trend" class="chart-box"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">📊 月度消息量</div>' +
        '    <div id="chart-volume" class="chart-box"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">💬 高频词云</div>' +
        '    <div id="chart-wordcloud" class="wordcloud-box"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">🕐 聊天时段热力图</div>' +
        '    <div id="chart-heatmap" class="chart-box"></div>' +
        '  </div>' +

        // ========== AI 分析摘要卡片 ==========
        '  <div class="card dashboard-full" v-if="$state.aiResult && !$state.aiResult.degraded">' +
        '    <div class="card-title">🤖 AI 关系分析</div>' +
        '    <div v-if="$state.aiResult.trend" style="margin-bottom:12px;">' +
        '      <span style="font-size:13px;color:var(--text-secondary);">关系趋势：</span>' +
        '      <span :style="trendStyle">{{ trendLabel }}</span>' +
        '    </div>' +
        '    <div v-if="$state.aiResult.overallSummary" style="font-size:14px; line-height:1.8; color:var(--text-primary);">' +
        '      {{ $state.aiResult.overallSummary }}' +
        '    </div>' +
        '    <div v-if="$state.aiResult.phases && $state.aiResult.phases.length > 0" style="margin-top:16px;">' +
        '      <span style="font-size:13px;color:var(--text-secondary);">发展阶段：</span>' +
        '      <span v-for="(p, idx) in $state.aiResult.phases" :key="idx"' +
        '        style="display:inline-block; margin:4px 6px; padding:4px 12px; background:var(--accent-dim);' +
        '        border-radius:12px; font-size:12px; color:var(--accent);">' +
        '        {{ p.name }} ({{ p.start }}~{{ p.end }})' +
        '      </span>' +
        '    </div>' +
        '  </div>' +

        // AI 未配置提示
        '  <div class="card dashboard-full" v-if="!$state.aiResult || $state.aiResult.degraded">' +
        '    <div class="card-title">🤖 AI 情感分析</div>' +
        '    <p style="color:var(--text-secondary); font-size:14px; text-align:center; padding:20px;">' +
        '      配置 DeepSeek API Key 后即可解锁 AI 关系分析、阶段识别和里程碑提取功能' +
        '    </p>' +
        '  </div>' +

        // ========== 扩展图表 2×2 ==========
        '  <div class="card">' +
        '    <div class="card-title">⚖️ 互动天平</div>' +
        '    <div id="chart-balance" class="chart-box"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">📅 日历热力图</div>' +
        '    <div id="chart-calendar" class="chart-box"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">🌙 深夜聊天趋势</div>' +
        '    <div id="chart-nightowl" class="chart-box"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">😊 Emoji 使用趋势</div>' +
        '    <div id="chart-emoji" class="chart-box"></div>' +
        '  </div>' +

        // ========== 称呼演变 ==========
        '  <div class="card dashboard-full" v-if="$state.statsData && $state.statsData.nicknameEvolution && $state.statsData.nicknameEvolution.length > 0">' +
        '    <div class="card-title">💝 亲密称呼演变</div>' +
        '    <div style="max-height:300px; overflow-y:auto;">' +
        '      <div v-for="(item, idx) in $state.statsData.nicknameEvolution" :key="idx" class="nickname-evo-item">' +
        '        <span class="evo-date">{{ item.date }}</span>' +
        '        <span class="evo-arrow">→</span>' +
        '        <span class="evo-name">{{ item.term }}</span>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        // ========== 年度报告 ==========
        '  <div class="card dashboard-full" v-if="reportPages && reportPages.length > 0">' +
        '    <div class="card-title">📖 年度情感报告</div>' +
        '    <div class="report-container">' +
        '      <div class="report-page">' +
        '        <div style="font-size:48px;">{{ reportPages[$state.reportPage].emoji }}</div>' +
        '        <h3 style="font-size:20px; color:var(--accent);">{{ reportPages[$state.reportPage].title }}</h3>' +
        '        <p style="font-size:15px; line-height:1.8; color:var(--text-secondary); text-align:left;">' +
        '          {{ reportPages[$state.reportPage].content }}' +
        '        </p>' +
        '        <div style="font-size:13px; color:var(--text-muted);">' +
        '          {{ $state.reportPage + 1 }} / {{ reportPages.length }}' +
        '        </div>' +
        '      </div>' +
        '      <div class="report-nav">' +
        '        <button class="btn-ghost" @click="prevReportPage" :disabled="$state.reportPage <= 0">◀ 上一页</button>' +
        '        <button class="btn-ghost" @click="nextReportPage" :disabled="$state.reportPage >= reportPages.length - 1">下一页 ▶</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>' +

        // ========== 无数据兜底 ==========
        '<div v-if="!$state.meta && !$state.loading" style="text-align:center; padding:80px 20px; color:var(--text-secondary);">' +
        '  <div style="font-size:48px; margin-bottom:16px;">📭</div>' +
        '  <p style="font-size:16px;">暂无数据</p>' +
        '  <p style="font-size:13px; color:var(--text-muted);">请先导入 WeChatMsg 聊天记录 JSON 文件</p>' +
        '</div>' +
      '</div>',

    setup: function() {
      // 年度报告页面数据（computed 在 CDN 模式下用函数封装）
      function getPages() {
        var st = window.__appState;
        if (!st || !st.statsData) return [];
        return getReportPages(st.statsData, st.aiResult, st.meta);
      }

      // 趋势方向的中文标签
      function trendLabelGetter() {
        var st = window.__appState;
        if (!st || !st.aiResult || !st.aiResult.trend) return '';
        var map = {
          'rising': '📈 持续升温',
          'declining': '📉 有所下降',
          'stable': '➡️ 平稳发展',
          'fluctuating': '🔄 波动变化',
          'unknown': '❓ 数据不足'
        };
        return map[st.aiResult.trend.direction] || st.aiResult.trend.description || '';
      }

      function trendStyleGetter() {
        var st = window.__appState;
        if (!st || !st.aiResult || !st.aiResult.trend) return {};
        var dir = st.aiResult.trend.direction;
        if (dir === 'rising') return { color: '#4caf50', fontWeight: '500' };
        if (dir === 'declining') return { color: '#ff9800', fontWeight: '500' };
        return { color: 'var(--text-secondary)' };
      }

      function prevReportPage() {
        var st = window.__appState;
        if (st && st.reportPage > 0) {
          st.reportPage--;
        }
      }

      function nextReportPage() {
        var st = window.__appState;
        if (st) {
          var pages = getPages();
          if (st.reportPage < pages.length - 1) {
            st.reportPage++;
          }
        }
      }

      // 组件挂载后渲染图表（应对直接从 localStorage 恢复的场景）
      onMounted(function() {
        nextTick(function() {
          if (window.__renderDashboardCharts) {
            window.__renderDashboardCharts();
          }
        });
      });

      return {
        reportPages: Vue.computed(getPages),
        trendLabel: Vue.computed(trendLabelGetter),
        trendStyle: Vue.computed(trendStyleGetter),
        prevReportPage: prevReportPage,
        nextReportPage: nextReportPage
      };
    }
  };

  // ============================================================
  // 组件：timeline-view — 时间线容器
  // ============================================================
  var TimelineView = {
    name: 'TimelineView',
    template:
      '<div class="timeline-view">' +
      '  <div id="timeline-container"></div>' +
      '</div>',
    setup: function() {
      onMounted(function() {
        nextTick(function() {
          if (window.__renderTimelineView) {
            window.__renderTimelineView();
          }
        });
      });
      return {};
    }
  };

  // ============================================================
  // 创建 Vue 应用
  // ============================================================
  var app = createApp({
    setup: function() {
      // ---------- 全局状态（reactive 对象）----------
      // 数据属性供组件通过 $state 访问，函数通过闭包或 window 暴露
      var state = reactive({
        currentView: RLT.desktop && RLT.desktop.isDesktop ? 'sessions' : 'import',
        loading: false,
        loadingMsg: '',
        statusMsg: '',
        statusType: '',
        reportPage: 0,
        messages: [],
        meta: null,
        statsData: null,
        aiResult: null,
        sessions: [],
        sessionsLoading: false,
        sessionsStatus: '',
        sessionsStatusType: 'scanning',
        sessionsError: ''
      });

      // ---------- 注入全局属性，子组件通过 $state 访问 ----------
      // 注意：必须在 app.mount 之前设置，否则组件 setup 中无法获取
      // 同时挂到 window 上供非 Vue 上下文（图表渲染、时间线渲染）访问
      window.__appState = state;
      state.runAnalysis = runAnalysis;
      app.config.globalProperties.$state = state;

      // ---------- 暴露图表/时间线渲染函数到全局（供组件 mounted 钩子调用）----------
      window.__renderDashboardCharts = renderDashboardCharts;
      window.__renderTimelineView = renderTimelineView;

      // ---------- 监听视图切换 — 统一处理 localStorage 保存 + 图表/时间线渲染 ----------
      // 必要性：index.html 模板中直接使用 @click="currentView = 'dashboard'"
      // 这种直接赋值不会经过 switchView，因此用 watch 捕获所有视图变更
      watch(
        function() { return state.currentView; },
        function(newView, oldView) {
          // 视图切换时销毁旧视图中的图表实例，释放 ECharts 资源
          if (newView !== oldView) {
            RLT.charts.disposeAll();
          }

          // 持久化当前视图，刷新后可恢复
          RLT.storage.save(RLT.storage.KEYS.CURRENT_VIEW, newView);

          // 等待 Vue DOM 更新完成后再渲染（确保图表容器已挂载）
          nextTick(function() {
            if (newView === 'dashboard') {
              renderDashboardCharts();
            } else if (newView === 'timeline') {
              renderTimelineView();
            }
          });
        }
      );

      // ---------- 页面初始化：尝试恢复已保存的状态 ----------
      onMounted(function() {
        if (RLT.desktop && RLT.desktop.isDesktop) {
          var savedMeta = RLT.storage.load(RLT.storage.KEYS.CHAT_META);
          if (savedMeta) {
            state.currentView = 'dashboard';
          } else {
            state.currentView = 'sessions';
            scanWeChatSessions();
          }
        } else {
          if (!restoreSavedState(state)) {
            // 无已保存状态，保持在导入页
            // 检查是否有保存的视图偏好
            var savedView = RLT.storage.load(RLT.storage.KEYS.CURRENT_VIEW);
            if (savedView && savedView !== 'import') {
              // 有视图偏好但无数据，重置为导入页
              state.currentView = 'import';
            }
          }
        }
      });

      // ---------- 桌面端：扫描微信聊天会话 ----------
      function scanWeChatSessions() {
        state.sessionsLoading = true;
        state.sessionsStatus = '正在扫描微信聊天记录...';
        state.sessionsStatusType = 'scanning';
        window.addEventListener('desktop:sessionsReady', function onReady(e) {
          window.removeEventListener('desktop:sessionsReady', onReady);
          state.sessionsLoading = false;
          var response = e.detail;
          if (response.error) {
            state.sessionsStatus = response.message || '扫描失败';
            state.sessionsStatusType = 'error';
          } else if (!response.sessions || response.sessions.length === 0) {
            state.sessionsStatus = '未找到聊天记录';
            state.sessionsStatusType = 'error';
          } else {
            state.sessions = response.sessions;
            state.sessionsStatus = '已找到 ' + response.sessions.length + ' 个聊天会话';
            state.sessionsStatusType = 'success';
          }
        });
        window.addEventListener('desktop:error', function onErr(e) {
          window.removeEventListener('desktop:error', onErr);
          state.sessionsLoading = false;
          state.sessionsStatus = e.detail.message;
          state.sessionsStatusType = 'error';
        });
        if (RLT.desktop && RLT.desktop.isDesktop) {
          RLT.desktop.scanSessions();
        }
      }

      // ---------- 桌面端：选择会话并导出 ----------
      function selectSession(wxid) {
        state.sessionsStatus = '正在导出聊天记录...';
        state.sessionsStatusType = 'scanning';
        state.sessionsLoading = true;
        if (RLT.desktop && RLT.desktop.isDesktop) {
          RLT.desktop.exportChat(wxid);
        }
      }

      // 返回给根模板使用的属性和方法（index.html 中通过 v-if/v-on 引用）
      return {
        currentView: Vue.toRef(state, 'currentView'),
        loading: Vue.toRef(state, 'loading'),
        loadingMsg: Vue.toRef(state, 'loadingMsg'),
        statusMsg: Vue.toRef(state, 'statusMsg'),
        statusType: Vue.toRef(state, 'statusType'),
        reportPage: Vue.toRef(state, 'reportPage'),
        meta: Vue.toRef(state, 'meta'),
        statsData: Vue.toRef(state, 'statsData'),
        aiResult: Vue.toRef(state, 'aiResult'),
        sessions: Vue.toRef(state, 'sessions'),
        sessionsLoading: Vue.toRef(state, 'sessionsLoading'),
        sessionsStatus: Vue.toRef(state, 'sessionsStatus'),
        sessionsStatusType: Vue.toRef(state, 'sessionsStatusType'),
        sessionsError: Vue.toRef(state, 'sessionsError'),
        onDataLoaded: onDataLoaded,
        switchView: switchView,
        resetAll: resetAll,
        scanWeChatSessions: scanWeChatSessions,
        selectSession: selectSession
      };
    }
  });

  // ---------- 注册子组件 ----------
  app.component('import-view', ImportView);
  app.component('dashboard-view', DashboardView);
  app.component('timeline-view', TimelineView);

  // ---------- 挂载到 #app ----------
  app.mount('#app');

  // 日志：应用初始化完成
  if (typeof console !== 'undefined') {
    console.log('[app] Relationship Tracker 已初始化');
    console.log('[app] 模块状态：storage=' + (!!RLT.storage) +
      ' parser=' + (!!RLT.parser) +
      ' stats=' + (!!RLT.stats) +
      ' ai=' + (!!RLT.ai) +
      ' charts=' + (!!RLT.charts) +
      ' timeline=' + (!!RLT.timeline));
  }

})();
