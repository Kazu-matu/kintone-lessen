# 修正版スクリプトを実行
$scriptContent = @'
# Kintone MCP サーバー環境構築スクリプト（修正版）

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Kintone MCP サーバー環境構築を開始します" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 変数設定
$mcpbPath = "\\192.168.0.90\share\kintone\kintone-mcp-server.mcpb"
$zipPath = "C:\kintone-mcp-server.zip"
$extractPath = "C:\kintone-mcp-server-extracted"
$envFilePath = "$extractPath\.env"
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"

# ステップ1: .mcpb ファイルを .zip にコピー
Write-Host "`n[ステップ1] .mcpb ファイルを確認・コピー中..." -ForegroundColor Yellow
if (-Not (Test-Path $mcpbPath)) {
    Write-Host "❌ エラー: $mcpbPath が見つかりません" -ForegroundColor Red
    exit 1
}

try {
    Copy-Item -Path $mcpbPath -Destination $zipPath -Force
    Write-Host "✅ ファイルをコピーしました: $zipPath" -ForegroundColor Green
} catch {
    Write-Host "❌ コピーエラー: $_" -ForegroundColor Red
    exit 1
}

# ステップ2: 既存フォルダを削除
Write-Host "`n[ステップ2] 既存フォルダをクリア中..." -ForegroundColor Yellow
if (Test-Path $extractPath) {
    Write-Host "既存フォルダを削除中: $extractPath"
    Remove-Item -Path $extractPath -Recurse -Force
}

# ステップ3: ZIP ファイルを解凍
Write-Host "`n[ステップ3] ZIP ファイルを解凍中..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    Write-Host "✅ 解凍完了: $extractPath" -ForegroundColor Green
} catch {
    Write-Host "❌ 解凍エラー: $_" -ForegroundColor Red
    exit 1
}

# ZIP ファイルを削除
Remove-Item -Path $zipPath -Force

# ステップ4: Node.js と npm の確認
Write-Host "`n[ステップ4] Node.js と npm を確認中..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ エラー: Node.js または npm がインストールされていません" -ForegroundColor Red
    exit 1
}

# ステップ5: 依存関係をインストール
Write-Host "`n[ステップ5] 依存関係をインストール中（3～5分かかります）..." -ForegroundColor Yellow
cd $extractPath
try {
    npm install
    Write-Host "✅ npm インストール完了" -ForegroundColor Green
} catch {
    Write-Host "❌ npm インストールエラー: $_" -ForegroundColor Red
    exit 1
}

# ステップ6: ビルド
Write-Host "`n[ステップ6] プロジェクトをビルド中..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ ビルド完了" -ForegroundColor Green
} catch {
    Write-Host "❌ ビルドエラー: $_" -ForegroundColor Red
    exit 1
}

# ステップ7: .env ファイルを作成
Write-Host "`n[ステップ7] .env ファイルを作成中..." -ForegroundColor Yellow
$envContent = @"
KINTONE_BASE_URL=https://kazu-lab.cybozu.com
KINTONE_USERNAME=kazufumi0707@gmail.com
KINTONE_PASSWORD=matu1189
"@

try {
    Set-Content -Path $envFilePath -Value $envContent -Encoding UTF8
    Write-Host "✅ .env ファイルを作成しました: $envFilePath" -ForegroundColor Green
} catch {
    Write-Host "❌ .env ファイル作成エラー: $_" -ForegroundColor Red
    exit 1
}

# ステップ8: .gitignore を作成
Write-Host "`n[ステップ8] .gitignore を作成中..." -ForegroundColor Yellow
$gitignoreContent = @"
.env
node_modules/
dist/
.DS_Store
*.log
"@

try {
    Set-Content -Path "$extractPath\.gitignore" -Value $gitignoreContent -Encoding UTF8
    Write-Host "✅ .gitignore を作成しました" -ForegroundColor Green
} catch {
    Write-Host "❌ .gitignore 作成エラー: $_" -ForegroundColor Red
}

# ステップ9: Claude Desktop 設定ファイルを更新
Write-Host "`n[ステップ9] Claude Desktop 設定ファイルを更新中..." -ForegroundColor Yellow

# 設定ファイルのディレクトリを確認・作成
$configDir = Split-Path -Parent $configPath
if (-Not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# パスをエスケープ
$distPath = $extractPath -replace '\\', '\\'

# Claude Desktop 設定を作成または更新
$config = @{
    mcpServers = @{
        kintone = @{
            command = "node"
            args = @("$distPath\dist\index.js")
            env = @{
                KINTONE_BASE_URL = "https://kazu-lab.cybozu.com"
                KINTONE_USERNAME = "kazufumi0707@gmail.com"
                KINTONE_PASSWORD = "matu1189"
            }
        }
    }
}

try {
    $configJson = $config | ConvertTo-Json -Depth 10
    Set-Content -Path $configPath -Value $configJson -Encoding UTF8
    Write-Host "✅ Claude Desktop 設定を更新しました: $configPath" -ForegroundColor Green
} catch {
    Write-Host "❌ 設定ファイル更新エラー: $_" -ForegroundColor Red
    exit 1
}

# 完了メッセージ
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ 環境構築が完了しました！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "`n📋 次のステップ:" -ForegroundColor Cyan
Write-Host "1. Claude Desktop を完全に終了してください" -ForegroundColor White
Write-Host "2. Claude Desktop を再度起動してください" -ForegroundColor White
Write-Host "3. 以下のメッセージを送信してテストしてください：" -ForegroundColor White
Write-Host "   『kintone のアプリ一覧を取得してください』" -ForegroundColor Cyan

Write-Host "`n📁 セットアップ情報:" -ForegroundColor Cyan
Write-Host "  抽出フォルダ: $extractPath" -ForegroundColor White
Write-Host "  .env ファイル: $envFilePath" -ForegroundColor White
Write-Host "  設定ファイル: $configPath" -ForegroundColor White

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
'@

Set-Content -Path "C:\setup-kintone-mcp-v2.ps1" -Value $scriptContent -Encoding UTF8
Write-Host "✅ 修正版スクリプトを作成しました" -ForegroundColor Green

# 実行
& "C:\setup-kintone-mcp-v2.ps1"