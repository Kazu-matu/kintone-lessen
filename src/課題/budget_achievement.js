/**
 * 課題名: CN-057-9-4 予実管理 カスタマイズビュー (SOLID原則適用リファクタリング版)
 * 対象アプリ: 【入社前研修】予実管理 (AppID: 15)
 * 版数: 1.1.0
 * 作成日: 2026-08-02
 * 更新日: 2026-08-02
 * 作成者: K.Matsushima
 * 修正者: K.Matsushima
 * ツール: Antigravity (Gemini)
 */
(function() {
  'use strict';

  // 1. Utility: セキュリティ対策（XSS対策の責務）
  class HtmlUtil {
    static escape(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  // 2. Model: 1レコード分のデータ保持とビジネスロジック（計算の責務）
  class BudgetRecordModel {
    constructor(kintoneRecord) {
      this.budgetNo = kintoneRecord.予算No ? kintoneRecord.予算No.value : '';
      this.year = kintoneRecord.年度 ? kintoneRecord.年度.value : '';
      this.branch = kintoneRecord.拠点 ? kintoneRecord.拠点.value : '';
      this.budget = kintoneRecord.予算 ? Number(kintoneRecord.予算.value) : 0;
      this.actual = kintoneRecord.実績 ? Number(kintoneRecord.実績.value) : 0;
    }

    // [差異] の算出
    get diff() {
      return this.actual - this.budget;
    }

    // [達成率] の算出（ゼロ除算防止・小数点第3位以下切り捨て）
    get achievementRate() {
      if (this.budget <= 0) {
        return 0;
      }
      const rawRate = (this.actual / this.budget) * 100;
      return Math.floor(rawRate * 100) / 100;
    }
  }

  // 3. Strategy: 警告条件の判定ルール（拡張性の向上）
  class BudgetWarningRule {
    constructor(thresholdPercent = 100) {
      this.threshold = thresholdPercent;
    }

    // 警告対象（しきい値未満）かどうか判定
    isWarning(recordModel) {
      return recordModel.achievementRate < this.threshold;
    }

    // 警告時に付与する CSS クラス名
    getWarningClass() {
      return 'red lighten-5 red-text text-accent-4';
    }
  }

  // 4. View/Renderer: HTMLテーブルの構築（描画の責務）
  class MaterializeTableViewRenderer {
    constructor(warningRule) {
      this.warningRule = warningRule;
    }

    _getRateCellClass(recordModel) {
      return this.warningRule.isWarning(recordModel) 
        ? this.warningRule.getWarningClass() 
        : '';
    }

    render(recordModels) {
      let html = '<table class="striped responsive-table highlight">';
      html += '<thead><tr>';
      html += '<th>予算No</th><th>年度</th><th>拠点</th><th>予算</th><th>実績</th><th>差異</th><th>達成率</th>';
      html += '</tr></thead><tbody>';

      recordModels.forEach(rec => {
        const rateClass = this._getRateCellClass(rec);
        const diffSign = rec.diff >= 0 ? '+' : '';

        html += '<tr>';
        html += `<td>${HtmlUtil.escape(rec.budgetNo)}</td>`;
        html += `<td>${HtmlUtil.escape(rec.year)}</td>`;
        html += `<td>${HtmlUtil.escape(rec.branch)}</td>`;
        html += `<td>${rec.budget.toLocaleString()} 円</td>`;
        html += `<td>${rec.actual.toLocaleString()} 円</td>`;
        html += `<td>${diffSign}${rec.diff.toLocaleString()} 円</td>`;
        html += `<td class="${rateClass}" style="font-weight: bold;">${rec.achievementRate.toFixed(2)} %</td>`;
        html += '</tr>';
      });

      html += '</tbody></table>';
      return html;
    }
  }

  // 5. Controller: アプリ全体の処理コーディネート（制御の責務）
  class BudgetAchievementApp {
    constructor(viewName, renderer) {
      this.viewName = viewName;
      this.renderer = renderer;
    }

    init() {
      kintone.events.on('app.record.index.show', (event) => {
        const container = document.getElementById('customize');
        if (!container || event.viewName !== this.viewName) {
          return event;
        }

        const records = event.records;
        if (!records || records.length === 0) {
          container.innerHTML = '<p class="flow-text" style="padding: 20px;">表示対象の予実レコードがありません。</p>';
          return event;
        }

        // kintoneの生レコード配列を、扱いやすいModelオブジェクト配列に変換
        const recordModels = records.map(rec => new BudgetRecordModel(rec));

        // HTMLレンダリングと描画適用
        container.innerHTML = this.renderer.render(recordModels);

        return event;
      });
    }
  }

  // --- 依存関係の注入（DI）とアプリケーション起動 ---
  const warningRule = new BudgetWarningRule(100); // 100%未満を警告対象にするルール
  const renderer = new MaterializeTableViewRenderer(warningRule);
  const app = new BudgetAchievementApp('予算達成率', renderer);
  app.init();

})();
