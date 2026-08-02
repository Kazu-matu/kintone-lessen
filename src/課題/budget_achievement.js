/**
 * 課題名: CN-057-9-4 予実管理 カスタマイズビュー＆MaterializeCSS表示
 * 対象アプリ: 【入社前研修】予実管理 (AppID: 15)
 */
(function() {
  'use strict';

  // レコード一覧画面表示イベント
  kintone.events.on('app.record.index.show', function(event) {
    // カスタマイズビューの要素を取得
    const container = document.getElementById('customize');
    if (!container) {
      return event;
    }

    // 「予算達成率」一覧の場合のみ実行 (ビュー名によるフィルタ)
    if (event.viewName !== '予算達成率') {
      return event;
    }

    const records = event.records;
    if (!records || records.length === 0) {
      container.innerHTML = '<p class="flow-text" style="padding: 20px;">表示対象 of 予実レコードがありません。</p>';
      return event;
    }

    // Materialize の striped テーブルクラスを適用
    let html = '<table class="striped responsive-table highlight">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>予算No</th>';
    html += '<th>年度</th>';
    html += '<th>拠点</th>';
    html += '<th>予算</th>';
    html += '<th>実績</th>';
    html += '<th>差異</th>';
    html += '<th>達成率</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    // 各レコードをループ処理
    records.forEach(function(rec) {
      const budgetNo = rec.予算No ? rec.予算No.value : '';
      const year = rec.年度 ? rec.年度.value : '';
      const branch = rec.拠点 ? rec.拠点.value : '';
      const budget = rec.予算 ? Number(rec.予算.value) : 0;
      const actual = rec.実績 ? Number(rec.実績.value) : 0;

      // [差異] = [実績] - [予算]
      const diff = actual - budget;

      // [達成率] = ([実績] / [予算]) * 100
      // 予算が0または空欄の場合のゼロ除算 (Division by Zero) を防止
      let ratePercent = 0;
      if (budget > 0) {
        const rawRate = (actual / budget) * 100;
        // 小数点第3位以下を切り捨て (Math.floor を利用)
        ratePercent = Math.floor(rawRate * 100) / 100;
      }

      // 達成率が100%未満の場合、警告用 Materialize カラークラスを付与
      // 背景色: red lighten-5 / 文字色: red-text text-accent-4
      let rateClass = '';
      if (ratePercent < 100) {
        rateClass = 'red lighten-5 red-text text-accent-4';
      }

      html += '<tr>';
      html += '<td>' + escapeHtml(budgetNo) + '</td>';
      html += '<td>' + escapeHtml(year) + '</td>';
      html += '<td>' + escapeHtml(branch) + '</td>';
      html += '<td>' + budget.toLocaleString() + ' 円</td>';
      html += '<td>' + actual.toLocaleString() + ' 円</td>';
      html += '<td>' + (diff >= 0 ? '+' : '') + diff.toLocaleString() + ' 円</td>';
      html += '<td class="' + rateClass + '" style="font-weight: bold;">' + ratePercent.toFixed(2) + ' %</td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';

    // 生成したテーブルHTMLを表示領域へ設定
    container.innerHTML = html;

    return event;
  });

  // クロスサイトスクリプティング (XSS) 防止用 HTML エスケープ関数
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
