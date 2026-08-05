require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  /* 各テストのタイムアウト時間 (45秒) */
  timeout: 45 * 1000,
  expect: {
    timeout: 10 * 1000
  },
  /* テストの並列実行は無効化（kintoneの画面操作が衝突するのを防ぐため） */
  fullyParallel: false,
  workers: 1,
  /* レポーターの設定 */
  reporter: 'list',
  use: {
    /* 設定ファイルからベースURLを読み込む */
    baseURL: process.env.KINTONE_BASE_URL,
    /* アクション（クリックなど）のタイムアウト (15秒) */
    actionTimeout: 15 * 1000,
    /* 画面トレースとビデオの設定 */
    trace: 'retain-on-failure',
    screenshot: 'off', /* テストコード内で明示的に撮るため */
    viewport: { width: 1280, height: 800 },
  },
  /* 対象ブラウザの定義（kintone推奨のChromiumのみでテスト） */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});
