// js/timeline.js — 时间线渲染器
// 依赖：RLT 全局命名空间（由 storage.js 初始化）
// 将 AI 分析出的关系阶段和里程碑渲染为纵向时间线 HTML

RLT.timeline = (function() {
  'use strict';

  // ============================================================
  // 里程碑分类 → Emoji 映射
  // ============================================================
  var CATEGORY_EMOJI = {
    first_contact: '👋',   // 初次接触
    deep_talk:     '💬',   // 深入对话
    nickname:      '🏷️',   // 特殊称呼
    date_mention:  '📅',   // 约会提及
    confession:    '💝',   // 表白/确认关系
    other:         '✨'    // 其他重要事件
  };

  // ============================================================
  // renderImportanceStars — 将重要度 1-10 转为 1-5 颗星
  // ============================================================

  /**
   * 将重要度数值（1-10）转换为星级字符串（★☆，最多 5 星）
   * 映射规则：1-2→1★, 3-4→2★, 5-6→3★, 7-8→4★, 9-10→5★
   * @param {number} importance - 重要度，取值 1-10
   * @returns {string} 星级字符串，如 "★★★☆☆"
   */
  function renderImportanceStars(importance) {
    var stars = Math.max(1, Math.min(5, Math.ceil((importance || 1) / 2)));
    var result = '';
    for (var i = 0; i < 5; i++) {
      result += (i < stars) ? '★' : '☆';
    }
    return result;
  }

  // ============================================================
  // 工具函数 — 判断里程碑是否属于某个阶段
  // ============================================================

  /**
   * 判断里程碑日期是否落在指定阶段的日期范围内
   * 里程碑日期可能是 "YYYY-MM-DD" 或 "YYYY-MM"，统一取前 7 位（"YYYY-MM"）比较
   * @param {string} milestoneDate - 里程碑日期字符串
   * @param {string} phaseStart - 阶段起始月份 "YYYY-MM"
   * @param {string} phaseEnd - 阶段结束月份 "YYYY-MM"
   * @returns {boolean} 是否属于该阶段
   */
  function isInPhase(milestoneDate, phaseStart, phaseEnd) {
    if (!milestoneDate) return false;
    // 取前 7 个字符作为 YYYY-MM 格式的月份标识
    var msMonth = milestoneDate.substring(0, 7);
    return msMonth >= phaseStart && msMonth <= phaseEnd;
  }

  // ============================================================
  // render — 主渲染函数
  // ============================================================

  /**
   * 将关系阶段和里程碑渲染为 HTML 时间线，插入到指定容器元素中
   * @param {HTMLElement} containerEl - 目标容器 DOM 元素
   * @param {Object[]} phases - AI 分析出的关系阶段数组
   *   [{ name: string, start: "YYYY-MM", end: "YYYY-MM", avgIntimacy: number, description: string }]
   * @param {Object[]} milestones - AI 提取的里程碑事件数组
   *   [{ date: string, title: string, importance: number(1-10), summary: string, category: string }]
   * @param {Object} meta - 聊天元信息对象，含 dateRangeStart/dateRangeEnd/durationDays
   */
  function render(containerEl, phases, milestones, meta) {
    if (!containerEl) return;

    // 确保是数组，兼容 null/undefined 入参
    phases = phases || [];
    milestones = milestones || [];
    meta = meta || {};

    // 构建 HTML 片段
    var html = '';

    // ==========================================================
    // 头部：标题 + 日期范围 + 持续天数
    // ==========================================================
    var dateStart = meta.dateRangeStart || meta.dateRangeStart || '';
    var dateEnd   = meta.dateRangeEnd   || '';
    var duration  = meta.durationDays   || 0;

    html += '<div class="timeline-header" style="text-align:center;margin-bottom:24px;">';
    html += '<h2 style="font-size:22px;font-weight:700;margin-bottom:8px;">💕 关系发展时间线</h2>';
    if (dateStart && dateEnd) {
      html += '<div style="font-size:14px;color:var(--text-secondary);">';
      html += dateStart + ' ~ ' + dateEnd;
      if (duration > 0) {
        html += ' · <span style="color:var(--accent);">' + duration + ' 天</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    // ==========================================================
    // 无阶段数据时的兜底提示
    // ==========================================================
    if (phases.length === 0) {
      html += '<div class="card" style="text-align:center;padding:32px;">';
      html += '<p style="font-size:16px;color:var(--text-secondary);">';
      html += '🔍 AI 分析暂不可用，请先配置 API Key 或查看仪表盘中的统计图表';
      html += '</p>';
      html += '</div>';
      containerEl.innerHTML = html;
      return;
    }

    // ==========================================================
    // 时间线轨道主体
    // ==========================================================
    html += '<div class="timeline-track">';

    for (var p = 0; p < phases.length; p++) {
      var phase = phases[p];

      // ------ 阶段标签 ------
      html += '<div class="timeline-phase-label">';
      html += '📌 ' + escapeHtml(phase.name) + '（' + escapeHtml(phase.start) + ' ~ ' + escapeHtml(phase.end) + '）';
      html += '</div>';

      // 阶段描述段落
      if (phase.description) {
        html += '<p style="font-size:13px;color:var(--text-secondary);margin:0 0 16px 0;line-height:1.7;">';
        html += escapeHtml(phase.description);
        html += '</p>';
      }

      // ------ 该阶段内的里程碑 ------
      var phaseMilestones = [];
      for (var m = 0; m < milestones.length; m++) {
        if (isInPhase(milestones[m].date, phase.start, phase.end)) {
          phaseMilestones.push(milestones[m]);
        }
      }

      if (phaseMilestones.length === 0) {
        // 该阶段无里程碑时显示占位提示
        html += '<div class="timeline-milestone">';
        html += '<div class="timeline-milestone-card" style="opacity:0.5;">';
        html += '<p style="font-size:13px;color:var(--text-muted);margin:0;">该阶段暂无已提取的里程碑</p>';
        html += '</div>';
        html += '</div>';
      } else {
        for (var mi = 0; mi < phaseMilestones.length; mi++) {
          var ms = phaseMilestones[mi];
          var emoji = CATEGORY_EMOJI[ms.category] || CATEGORY_EMOJI.other;
          var stars = renderImportanceStars(ms.importance);

          html += '<div class="timeline-milestone">';
          html += '<div class="timeline-milestone-card">';

          // 日期（强调色）
          html += '<div class="date">' + escapeHtml(ms.date) + '</div>';

          // 标题：分类 emoji + 标题文字
          html += '<h4>' + emoji + ' ' + escapeHtml(ms.title) + '</h4>';

          // 摘要描述
          if (ms.summary) {
            html += '<p>' + escapeHtml(ms.summary) + '</p>';
          }

          // 星级评定
          html += '<div style="font-size:12px;color:var(--warning);margin-top:6px;">' + stars + '</div>';

          html += '</div>';
          html += '</div>';
        }
      }
    }

    html += '</div>'; // .timeline-track 闭合

    // 写入容器
    containerEl.innerHTML = html;
  }

  // ============================================================
  // escapeHtml — 防 XSS 的 HTML 转义
  // ============================================================

  /**
   * 将用户/第三方文本中的特殊字符转义为 HTML 实体，防止 XSS 注入
   * 转义 & < > " ' 五个字符
   * @param {string} str - 原始字符串
   * @returns {string} 转义后的安全字符串
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // 公开 API
  // ============================================================
  return {
    render:                render,
    renderImportanceStars: renderImportanceStars
  };
})();
