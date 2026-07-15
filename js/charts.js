// js/charts.js — ECharts 图表工厂
// 依赖：ECharts 5.x + echarts-wordcloud 扩展（由 index.html CDN 加载）
// 提供 8 种图表类型的渲染方法，统一管理图表实例生命周期与自适应缩放

RLT.charts = (function() {
  'use strict';

  // ============================================================
  // 配色方案 — 统一暗色主题色板
  // ============================================================
  var C = {
    accent:     '#e85d75',   // 主强调色（玫红）
    accentSoft: '#ffb3c1',   // 柔和玫红
    purple:     '#b98eff',   // 紫色
    blue:       '#5dade2',   // 蓝色
    green:      '#4caf50'    // 绿色
  };

  // 10 色序列 — 供 Emoji 多系列折线图使用
  var SERIES_10 = [
    '#e85d75', '#b98eff', '#5dade2', '#4caf50', '#ffb3c1',
    '#f39c12', '#1abc9c', '#e74c3c', '#9b59b6', '#3498db'
  ];

  // ============================================================
  // 实例管理 — 按 DOM id 跟踪，re-render 时先销毁旧实例
  // ============================================================
  var instances = {};

  // resize 监听是否已注册（全局仅注册一次）
  var _resizeBound = false;

  // ============================================================
  // 基础配置 — 所有图表共用的暗色主题外壳
  // ============================================================
  function baseOption() {
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#aaa' },
      tooltip: {
        backgroundColor: 'rgba(18,18,24,0.95)',
        borderColor: '#333',
        textStyle: { color: '#ddd', fontSize: 12 }
      },
      animation: true,
      animationDuration: 600
    };
  }

  // ============================================================
  // 工具函数
  // ============================================================

  /**
   * 深度合并两个对象，b 的属性覆盖 a 的同名属性（浅层嵌套使用 Object.assign 即可）
   * 用于将图表专属 option 合并到 baseOption 上
   * @param {Object} a - 基础配置
   * @param {Object} b - 专属配置（优先级更高）
   * @returns {Object} 合并后的配置对象
   */
  function merge(a, b) {
    var result = {};
    var key;
    for (key in a) { if (a.hasOwnProperty(key)) result[key] = a[key]; }
    for (key in b) { if (b.hasOwnProperty(key)) result[key] = b[key]; }
    return result;
  }

  /**
   * 将月度亲密值扩展为按日对齐的数组，使月度数据可叠加在日级折线图上
   * 每个月内的每一天都使用该月的亲密值
   * @param {Array<{date: string, count: number}>} dailyCounts - 每日消息数数组
   * @param {Array<{month: string, intimacy: number}>} monthlyResults - AI 月度分析结果
   * @returns {Array<number|null>} 与 dailyCounts 等长的亲密值数组（无数据月份为 null 断线）
   */
  function expandMonthlyToDaily(dailyCounts, monthlyResults) {
    if (!monthlyResults || monthlyResults.length === 0) return null;

    // 建立 monthStr → intimacy 映射
    var intimacyMap = {};
    for (var i = 0; i < monthlyResults.length; i++) {
      intimacyMap[monthlyResults[i].month] = monthlyResults[i].intimacy;
    }

    var result = [];
    for (var j = 0; j < dailyCounts.length; j++) {
      var monthStr = dailyCounts[j].date.substring(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
      result.push(intimacyMap.hasOwnProperty(monthStr) ? intimacyMap[monthStr] : null);
    }
    return result;
  }

  // ============================================================
  // 1. Trend — 感情趋势折线图（日消息量面积 + AI 亲密值叠加线）
  // ============================================================
  function renderTrend(dom, data) {
    var daily = data.dailyCounts || [];
    var dates = [];
    var counts = [];
    for (var i = 0; i < daily.length; i++) {
      dates.push(daily[i].date);
      counts.push(daily[i].count);
    }

    var intimacyData = expandMonthlyToDaily(daily, data.monthlyResults);
    var hasIntimacy = intimacyData !== null;

    var yAxis = [{ type: 'value', name: '消息数', nameTextStyle: { color: '#888' } }];
    if (hasIntimacy) {
      yAxis.push({ type: 'value', name: '亲密值', min: 0, max: 100, nameTextStyle: { color: '#888' } });
    }

    var series = [{
      name: '每日消息',
      type: 'line',
      data: counts,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: C.accentSoft, width: 1.5 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(232,93,117,0.35)' },
        { offset: 1, color: 'rgba(232,93,117,0.02)' }
      ])},
      itemStyle: { color: C.accent }
    }];

    if (hasIntimacy) {
      series.push({
        name: 'AI 亲密值',
        type: 'line',
        yAxisIndex: 1,
        data: intimacyData,
        connectNulls: false,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: C.purple, width: 2 },
        itemStyle: { color: C.purple }
      });
    }

    // 智能 X 轴标签间隔：数据点多时减少标签密度
    var labelInterval = Math.max(1, Math.floor(dates.length / 12));

    return merge(baseOption(), {
      grid: { left: 50, right: hasIntimacy ? 60 : 30, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { interval: labelInterval, rotate: 45, fontSize: 10, color: '#777' },
        axisLine: { lineStyle: { color: '#333' } }
      },
      yAxis: yAxis,
      series: series,
      legend: hasIntimacy ? {
        data: ['每日消息', 'AI 亲密值'],
        bottom: 0,
        textStyle: { color: '#888', fontSize: 11 }
      } : undefined,
      tooltip: merge(baseOption().tooltip, {
        trigger: 'axis',
        formatter: hasIntimacy ? function(params) {
          var lines = [params[0].axisValue];
          for (var k = 0; k < params.length; k++) {
            var p = params[k];
            lines.push(p.marker + ' ' + p.seriesName + ': ' + (p.value !== null ? p.value : '-'));
          }
          return lines.join('<br/>');
        } : undefined
      })
    });
  }

  // ============================================================
  // 2. Volume — 消息量分组柱状图（我方/对方）
  // ============================================================
  function renderVolume(dom, data) {
    var monthlyCounts = data.monthlyCounts || data || [];
    var months = [];
    var mineArr = [];
    var otherArr = [];
    for (var i = 0; i < monthlyCounts.length; i++) {
      months.push(monthlyCounts[i].month);
      mineArr.push(monthlyCounts[i].mine);
      otherArr.push(monthlyCounts[i].other);
    }

    return merge(baseOption(), {
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { rotate: 30, fontSize: 10, color: '#777' },
        axisLine: { lineStyle: { color: '#333' } }
      },
      yAxis: {
        type: 'value',
        name: '消息数',
        nameTextStyle: { color: '#888' },
        splitLine: { lineStyle: { color: '#1a1a24' } }
      },
      series: [
        {
          name: '我',
          type: 'bar',
          data: mineArr,
          itemStyle: { color: C.accent, borderRadius: [3, 3, 0, 0] },
          barGap: '20%'
        },
        {
          name: '对方',
          type: 'bar',
          data: otherArr,
          itemStyle: { color: C.purple, borderRadius: [3, 3, 0, 0] }
        }
      ],
      legend: {
        data: ['我', '对方'],
        bottom: 0,
        textStyle: { color: '#888', fontSize: 11 }
      },
      tooltip: merge(baseOption().tooltip, {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      })
    });
  }

  // ============================================================
  // 3. WordCloud — 爱心形状词云
  // ============================================================
  function renderWordCloud(dom, data) {
    var wordFrequency = data.wordFrequency || data || [];

    // 从调色板中随机取色
    var palette = [C.accent, C.accentSoft, C.purple, C.blue, C.green];

    return merge(baseOption(), {
      tooltip: { show: true, formatter: '{b}: {c} 次' },
      series: [{
        type: 'wordCloud',
        shape: 'heart',
        left: 'center',
        top: 'center',
        width: '90%',
        height: '90%',
        sizeRange: [14, 50],
        rotationRange: [-45, 45],
        rotationStep: 45,
        gridSize: 6,
        drawOutOfBound: false,
        textStyle: {
          fontFamily: '"Noto Sans SC", sans-serif',
          fontWeight: 'normal',
          color: function() {
            return palette[Math.floor(Math.random() * palette.length)];
          }
        },
        emphasis: {
          textStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.5)'
          }
        },
        data: wordFrequency.slice(0, 80)  // 最多展示 80 个词
      }]
    });
  }

  // ============================================================
  // 4. Heatmap — 24h x 7day 聊天时段热力图
  // ============================================================
  function renderHeatmap(dom, data) {
    var hourlyHeatmap = data.hourlyHeatmap || data || [];
    var dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var hourLabels = [];
    for (var h = 0; h < 24; h++) {
      hourLabels.push(String(h).padStart(2, '0') + ':00');
    }

    // 计算动态最大值，避免 visualMap 因极端值失真
    var maxCount = 0;
    for (var i = 0; i < hourlyHeatmap.length; i++) {
      maxCount = Math.max(maxCount, hourlyHeatmap[i][2]);
    }
    if (maxCount === 0) maxCount = 1;

    return merge(baseOption(), {
      grid: { left: 65, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'category',
        data: dayLabels,
        position: 'top',
        axisLabel: { fontSize: 10, color: '#888' },
        axisLine: { lineStyle: { color: '#333' } },
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'transparent'] } }
      },
      yAxis: {
        type: 'category',
        data: hourLabels,
        inverse: true,   // 0:00 在顶部，23:00 在底部
        axisLabel: { fontSize: 10, color: '#888' },
        axisLine: { lineStyle: { color: '#333' } },
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'transparent'] } }
      },
      visualMap: {
        min: 0,
        max: maxCount,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#1a1a28', '#5c2d3a', '#b84c5e', '#e85d75', '#ffb3c1'] },
        textStyle: { color: '#888', fontSize: 10 }
      },
      series: [{
        type: 'heatmap',
        data: hourlyHeatmap,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.6)'
          }
        }
      }],
      tooltip: merge(baseOption().tooltip, {
        formatter: function(p) {
          return hourLabels[p.value[0]] + ' ' + dayLabels[p.value[1]] + '<br/>' + p.value[2] + ' 条消息';
        }
      })
    });
  }

  // ============================================================
  // 5. Balance — 背靠背水平柱状图（天平图）
  // ============================================================
  function renderBalance(dom, data) {
    var monthly = (data.balance && data.balance.monthly) || data.monthly || data || [];
    var months = [];
    var mineNeg = [];   // 左侧展示，负值
    var otherPos = [];  // 右侧展示，正值
    for (var i = 0; i < monthly.length; i++) {
      months.push(monthly[i].month);
      mineNeg.push(-monthly[i].mine);   // 取负值使其在逆序 x 轴上向左增长
      otherPos.push(monthly[i].other);
    }

    return merge(baseOption(), {
      grid: [{ left: '5%', width: '38%', bottom: 30 }, { right: '5%', width: '38%', bottom: 30 }],
      xAxis: [
        {
          type: 'value',
          gridIndex: 0,
          inverse: true,           // 逆序：负值向左延伸
          axisLabel: { formatter: function(v) { return Math.abs(v); }, fontSize: 10, color: '#888' },
          splitLine: { show: false },
          axisLine: { lineStyle: { color: '#333' } }
        },
        {
          type: 'value',
          gridIndex: 1,
          axisLabel: { fontSize: 10, color: '#888' },
          splitLine: { show: false },
          axisLine: { lineStyle: { color: '#333' } }
        }
      ],
      yAxis: [
        {
          type: 'category',
          data: months,
          gridIndex: 0,
          position: 'right',       // Y 轴标签居中（左图的右侧=右图的左侧）
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false }
        },
        {
          type: 'category',
          data: months,
          gridIndex: 1,
          position: 'left',
          axisLabel: { fontSize: 10, color: '#888', margin: 20 },
          axisLine: { show: false },
          axisTick: { show: false }
        }
      ],
      series: [
        {
          name: '我',
          type: 'bar',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: mineNeg,
          itemStyle: { color: C.accent, borderRadius: [0, 3, 3, 0] },
          label: { show: true, position: 'left', formatter: function(p) { return Math.abs(p.value); }, fontSize: 10, color: '#aaa' }
        },
        {
          name: '对方',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: otherPos,
          itemStyle: { color: C.purple, borderRadius: [3, 0, 0, 3] },
          label: { show: true, position: 'right', fontSize: 10, color: '#aaa' }
        }
      ],
      legend: {
        data: ['我', '对方'],
        bottom: 0,
        textStyle: { color: '#888', fontSize: 11 }
      },
      tooltip: merge(baseOption().tooltip, {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          var month = '';
          var result = [];
          for (var k = 0; k < params.length; k++) {
            var p = params[k];
            month = p.name;
            result.push(p.marker + ' ' + p.seriesName + ': ' + Math.abs(p.value) + ' 条');
          }
          return month + '<br/>' + result.join('<br/>');
        }
      })
    });
  }

  // ============================================================
  // 6. Calendar — GitHub 风格日历热力图
  // ============================================================
  function renderCalendar(dom, data) {
    var calendarData = data.calendarHeatmap || data || [];

    if (calendarData.length === 0) {
      return merge(baseOption(), {
        title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#555', fontSize: 14 } }
      });
    }

    // 确定年份范围
    var firstDate = calendarData[0][0];
    var lastDate = calendarData[calendarData.length - 1][0];
    var startYear = parseInt(firstDate.substring(0, 4), 10);
    var endYear = parseInt(lastDate.substring(0, 4), 10);

    // 构建 calendar 坐标系的 range
    var range = [];
    for (var y = startYear; y <= endYear; y++) {
      range.push(String(y));
    }

    // 计算最大值用于 visualMap
    var maxVal = 0;
    for (var i = 0; i < calendarData.length; i++) {
      maxVal = Math.max(maxVal, calendarData[i][1]);
    }
    if (maxVal === 0) maxVal = 1;

    return merge(baseOption(), {
      tooltip: merge(baseOption().tooltip, {
        formatter: function(p) { return p.value[0] + '<br/>' + p.value[1] + ' 条消息'; }
      }),
      visualMap: {
        type: 'piecewise',
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        pieces: [
          { min: 1, max: Math.max(1, Math.ceil(maxVal * 0.25)), color: '#3d1f28' },
          { min: Math.max(2, Math.ceil(maxVal * 0.25) + 1), max: Math.ceil(maxVal * 0.5), color: '#7a3040' },
          { min: Math.max(3, Math.ceil(maxVal * 0.5) + 1), max: Math.ceil(maxVal * 0.75), color: '#c94a5e' },
          { min: Math.max(4, Math.ceil(maxVal * 0.75) + 1), color: '#ff7b8a' }
        ],
        textStyle: { color: '#888', fontSize: 10 }
      },
      calendar: {
        top: 20,
        left: 30,
        right: 30,
        range: range,
        cellSize: ['auto', 13],
        yearLabel: { color: '#888' },
        monthLabel: { color: '#888' },
        dayLabel: { color: '#666', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1a1a24' } },
        itemStyle: { borderColor: '#0d0d14', borderWidth: 2 }
      },
      series: [{
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: calendarData
      }]
    });
  }

  // ============================================================
  // 7. NightOwl — 深夜聊天组合图（柱状 + 折线双 Y 轴）
  // ============================================================
  function renderNightOwl(dom, data) {
    var stats = data.nightOwlStats || data || [];
    var months = [];
    var nightArr = [];
    var ratioArr = [];
    for (var i = 0; i < stats.length; i++) {
      months.push(stats[i].month);
      nightArr.push(stats[i].nightCount);
      ratioArr.push(parseFloat(stats[i].ratio) || 0);
    }

    return merge(baseOption(), {
      grid: { left: 55, right: 60, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { rotate: 30, fontSize: 10, color: '#777' },
        axisLine: { lineStyle: { color: '#333' } }
      },
      yAxis: [
        {
          type: 'value',
          name: '深夜消息数',
          nameTextStyle: { color: '#888' },
          splitLine: { lineStyle: { color: '#1a1a24' } }
        },
        {
          type: 'value',
          name: '占比 %',
          nameTextStyle: { color: '#888' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '深夜消息',
          type: 'bar',
          data: nightArr,
          itemStyle: { color: C.purple, borderRadius: [3, 3, 0, 0] }
        },
        {
          name: '深夜占比',
          type: 'line',
          yAxisIndex: 1,
          data: ratioArr,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: C.accent, width: 2 },
          itemStyle: { color: C.accent },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 9,
            color: C.accentSoft
          }
        }
      ],
      legend: {
        data: ['深夜消息', '深夜占比'],
        bottom: 0,
        textStyle: { color: '#888', fontSize: 11 }
      },
      tooltip: merge(baseOption().tooltip, {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      })
    });
  }

  // ============================================================
  // 8. Emoji — 多系列 Emoji 使用趋势折线图
  // ============================================================
  function renderEmoji(dom, data) {
    var emojiTrends = data.emojiTrends || data || {};
    var trends = emojiTrends.trends || [];
    var months = emojiTrends.months || [];

    var series = [];
    for (var i = 0; i < trends.length; i++) {
      series.push({
        name: trends[i].emoji,
        type: 'line',
        data: trends[i].data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 3,
        lineStyle: { color: SERIES_10[i % SERIES_10.length], width: 1.5 },
        itemStyle: { color: SERIES_10[i % SERIES_10.length] }
      });
    }

    var labelInterval = Math.max(1, Math.floor(months.length / 8));

    return merge(baseOption(), {
      grid: { left: 50, right: 80, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { interval: labelInterval, rotate: 30, fontSize: 10, color: '#777' },
        axisLine: { lineStyle: { color: '#333' } }
      },
      yAxis: {
        type: 'value',
        name: '使用次数',
        nameTextStyle: { color: '#888' },
        splitLine: { lineStyle: { color: '#1a1a24' } }
      },
      series: series,
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { color: '#888', fontSize: 10 }
      },
      tooltip: merge(baseOption().tooltip, {
        trigger: 'axis'
      })
    });
  }

  // ============================================================
  // 渲染分发 — 根据 type 选择对应渲染函数
  // ============================================================
  var RENDERERS = {
    'trend':    renderTrend,
    'volume':   renderVolume,
    'wordcloud': renderWordCloud,
    'heatmap':  renderHeatmap,
    'balance':  renderBalance,
    'calendar': renderCalendar,
    'nightowl': renderNightOwl,
    'emoji':    renderEmoji
  };

  /**
   * 渲染图表到指定 DOM 元素
   * 如果该 id 已存在旧的图表实例，先销毁再重建
   * @param {string} id - DOM 元素的 id 属性值（不含 # 号）
   * @param {string} type - 图表类型（trend/volume/wordcloud/heatmap/balance/calendar/nightowl/emoji）
   * @param {Object} data - 对应类型所需的统计数据
   * @returns {Object|null} ECharts 实例，或 null（DOM 不存在/类型不支持时）
   */
  function render(id, type, data) {
    // 检查 ECharts 是否已加载
    if (typeof echarts === 'undefined') {
      console.warn('[charts] ECharts 未加载，无法渲染图表');
      return null;
    }

    var dom = document.getElementById(id);
    if (!dom) {
      console.warn('[charts] DOM 元素未找到: #' + id);
      return null;
    }

    var renderer = RENDERERS[type];
    if (!renderer) {
      console.warn('[charts] 不支持的图表类型: ' + type);
      return null;
    }

    // 如果已有同 id 实例，先销毁（避免内存泄漏和重复渲染）
    if (instances[id]) {
      instances[id].dispose();
    }

    // 创建新实例并渲染
    var chart = echarts.init(dom);
    var option = renderer(chart, data);
    chart.setOption(option);
    instances[id] = chart;

    // 全局仅注册一次 resize 监听
    if (!_resizeBound) {
      _resizeBound = true;
      window.addEventListener('resize', function() {
        for (var key in instances) {
          if (instances.hasOwnProperty(key) && instances[key] && !instances[key].isDisposed()) {
            instances[key].resize();
          }
        }
      });
    }

    return chart;
  }

  /**
   * 销毁所有已跟踪的图表实例，释放 ECharts 占用的资源
   * 通常在页面数据重置或路由切换时调用
   */
  function disposeAll() {
    for (var key in instances) {
      if (instances.hasOwnProperty(key)) {
        try {
          if (instances[key] && !instances[key].isDisposed()) {
            instances[key].dispose();
          }
        } catch (e) {
          // 忽略销毁时的异常（实例可能已被 DOM 移除间接销毁）
        }
      }
    }
    instances = {};
  }

  // ============================================================
  // 公开 API
  // ============================================================
  return {
    render: render,
    disposeAll: disposeAll
  };
})();
