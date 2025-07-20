# ccscope 🔍

[English](README.md) | [日本語](README.ja.md)

Claude Code Scope - Claude Codeの会話記録を閲覧するためのインタラクティブなターミナルブラウザ

[![npm version](https://img.shields.io/npm/v/ccscope.svg)](https://www.npmjs.com/package/ccscope)
[![Downloads](https://img.shields.io/npm/dm/ccscope.svg)](https://npmjs.org/package/ccscope)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 概要

ccscope (Claude Code Scope)は、Claude Codeの会話ログを閲覧、分析、探索できる強力なターミナルベースのアプリケーションです。
セッションのナビゲーション、応答時間、ツール使用状況の確認などを直感的なインターフェースで提供します。

## 機能

- 🔍 **インタラクティブなブラウジング**: vimライクなキーバインドでセッションと会話をナビゲート
- 📊 **リッチな分析**: 応答時間とツール使用統計を表示
- 🔎 **全文検索**: すべての会話を横断してハイライト付きで検索、OR条件、正規表現サポート
- 🔄 **検索結果ナビゲーション**: 検索結果表示時は左右キーで検索ヒット項目間を移動
- 🔎 **検索とフィルタ**: 特定の会話を検索したりプロジェクトでフィルタリング
- 📱 **レスポンシブデザイン**: ターミナルサイズに合わせてワイドとコンパクトレイアウトを切り替え
- 🔧 **ツール分析**: ツール使用と実行フローの詳細な内訳
- 📈 **セッションメトリクス**: 会話の継続時間、応答時間、生産性を追跡
- 🚀 **セッション再開**: 'r'キーでccscope から直接Claude Codeセッションを再開
- 📑 **折り畳み可能なツール出力**: 長いツール出力（20行以上）はデフォルトで折り畳まれ、Ctrl+Rで展開/折り畳み切り替え

## スクリーンショット

### セッションリストビュー
```
📊 90 Sessions | ⏱️ 10d 15h 50m Duration | 💬 1757 Convos | 🔧 37.2k Tools | 🎯 14.2m Tokens
🔽 Filters: None | 📊 Sort: Last Activity ↓

No.   ID               Project                                 Conv. Duration        Tools   Tokens Start Time   End Time
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
▶ 1   52ee85b2         ccscope                                    22 4h 4m             649  251.4k  07/19 20:57  07/20 19:07
  2   585c655b         sms_proto                                   1 13m 49s            60   17.7k  07/20 18:49  07/20 19:03
  3   5b09d466         sms_proto                                  12 5h 30m            878  956.8k  07/20 12:10  07/20 18:47

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select · Enter to view details · r resume · / full-text search · f filter · s sort · h help · q exit
```

### 会話詳細ビュー
```
💬 22 Convos | ⏱️ 4h 4m
Selected: [52ee85b2] ccscope
📁 File: /Users/taguchiu/.claude/projects/-Users-taguchiu-Documents-workspace-ccscope/52ee85b2c94a1ee604f8e1e58328ad7db75e7330.jsonl

▶ 1  📅 07/19 20:57 → 07/19 21:06  🕐 8m 39s  🔧 30   ViewRendererコンポーネントのリファクタリングを手伝って...
  2  📅 07/19 21:06 → 07/19 21:15  🕐 8m 51s  🔧 25   全角文字表示のサポートを追加...
  3  📅 07/19 21:15 → 07/19 21:25  🕐 9m 48s  🔧 35   大規模データセット用の仮想スクロール実装...

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select conversation · Enter to view detail · ←/→ or h/l switch session · r resume · s sort · Esc back · q exit
```

### フル詳細ビュー
```
[52ee85b2] ccscope     [18-66/66] 100%
Conversation #15 of 22
========================================================================================================

👤 USER [07/19 20:57]:
ViewRendererコンポーネントのリファクタリングを手伝って...

🤖 ASSISTANT [07/19 21:06]:
ViewRendererコンポーネントのリファクタリングをお手伝いします...

⏺ Read(file: /src/ViewRenderer.js) [20:58]
  ⎿ ファイルの内容...
     ... +45 lines (ctrl+r で展開)

⏺ Edit(file: /src/ViewRenderer.js) [21:02]
  ⎿ 変更が正常に適用されました

[Compact Continuation at 2024-07-19 21:25:30]

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j 5-line scroll · Space/b page down/up · g/G top/bottom · ←/→ or h/l prev/next conversation · r resume · Esc back · q exit
```

## インストール

### グローバルインストール（推奨）

```bash
npm install -g ccscope
```

インストール後、ターミナルのどこからでも`ccscope`を実行できます。

## クイックスタート

```bash
# グローバルにインストール
npm install -g ccscope

# ccscopeを実行
ccscope

# またはnpxを使用してインストールなしで実行
npx ccscope@latest
```

### ローカルインストール

```bash
git clone https://github.com/taguchiu/ccscope.git
cd ccscope
npm install
npm link
```

### その他のインストール方法

```bash
# GitHubから直接インストール
npm install -g git+https://github.com/taguchiu/ccscope.git

# 特定のバージョンをインストール
npm install -g ccscope@1.2.2

# 開発用にローカルインストール
npm install ccscope
```

## 使い方

### 基本的な使い方

```bash
# インタラクティブブラウザモード
ccscope

# npxで実行（インストール不要）
npx ccscope

# 統計コマンドを表示
ccscope daily            # 日別会話統計
ccscope project          # プロジェクト別統計
ccscope search "query"   # すべての会話を検索

# オプション
ccscope --help           # ヘルプを表示

# 検索例
ccscope search "async await"
ccscope search "error or warning"     # OR検索
ccscope search --regex "import.*from" # 正規表現検索
ccscope search --regex "\berror\b"    # 単語境界検索
```

### Claude Code セッションの再開

任意のビューで `r` キーを押してClaude Codeセッションを再開できます：
- `claude -r <session-id>` を実行して会話を継続

この機能により、ccscopeで見つけた会話をシームレスに継続できます。

### ナビゲーション

#### セッションリストビュー
- `↑/↓` または `k/j`: 上下に移動
- `Enter`: セッションの会話を表示
- `r`: `claude -r` でセッションを再開
- `f`: プロジェクトでフィルタ
- `s`: セッションをソート（最終更新、期間、会話数、開始時刻、プロジェクト名）
- `/`: 全文検索
- `h` または `?`: ヘルプを表示
- `q`: 終了

#### 会話詳細ビュー
- `↑/↓` または `k/j`: 会話を移動
- `←/→` または `h/l`: セッションを切り替え
- `Enter`: 会話の詳細を表示
- `r`: `claude -r` でセッションを再開
- `s`: 会話をソート（日時、期間、ツール）
- `Esc`: セッションリストに戻る
- `q`: 終了

#### フル詳細ビュー
- `↑/↓` または `k/j`: コンテンツをスクロール（5行単位）
- `Space/b` または `PgDn/PgUp`: ページダウン/アップ
- `Ctrl+F/Ctrl+B`: ページ前進/後退（vimスタイル）
- `Ctrl+D/Ctrl+U`: 半ページダウン/アップ
- `g/G`: 最上部/最下部にジャンプ
- `←/→` または `h/l`: 前/次の会話（検索経由の場合は検索結果間を移動）
- `Ctrl+R`: すべてのツール出力の展開/折り畳みを切り替え
- `r`: `claude -r` でセッションを再開
- `Esc`: 会話リストに戻る
- `q`: 終了

#### 検索結果ビュー
- `↑/↓` または `k/j`: 検索結果を移動
- `Enter`: 会話詳細を表示
- `Esc`: セッションリストに戻る（インタラクティブ検索）またはアプリケーション終了（コマンドライン検索）
- `q`: アプリケーション終了

## 設定

ccscopeは以下のディレクトリからClaude Codeの記録を自動的に検出します：
- `~/.claude/projects/`

### サポートされているフォーマット

ccscopeはJSONL形式（`.jsonl`拡張子）のClaude Code記録ファイルを読み込みます。

## 開発

### プロジェクト構造

```
ccscope/
├── bin/                # 実行可能スクリプト
│   └── ccscope         # メインCLIエントリポイント
├── src/                # ソースコード
│   ├── services/       # サービスクラス
│   │   ├── ContentExtractor.js
│   │   ├── ConversationBuilder.js
│   │   ├── FileDiscoveryService.js
│   │   ├── ProjectExtractor.js
│   │   └── SessionStatisticsCalculator.js
│   ├── utils/          # ユーティリティ関数
│   │   └── formatters.js
│   ├── config.js       # 設定
│   ├── CacheManager.js # キャッシュ管理
│   ├── FastParser.js   # 最適化されたJSONLパーサー
│   ├── SessionManager.js
│   ├── StateManager.js
│   ├── ViewRenderer.js
│   ├── InputHandler.js
│   ├── ThemeManager.js
│   ├── MouseEventFilter.js
│   └── CCScope.js
├── __tests__/          # テストファイル
│   ├── helpers/        # テストユーティリティ
│   └── *.test.js       # コンポーネントテスト
├── .github/            # GitHub Actionsワークフロー
│   └── workflows/      # CI/CDパイプライン
├── CLAUDE.md           # Claude Code統合ガイド
├── package.json
├── jest.config.js      # Jestの設定
├── README.md
├── README.ja.md
└── LICENSE
```

### アーキテクチャ

ccscopeはモジュラーアーキテクチャに従っています：

- **CCScope**: メインアプリケーションオーケストレータ
- **SessionManager**: 記録の検出と解析を処理
- **StateManager**: アプリケーションの状態とナビゲーションを管理
- **ViewRenderer**: UIレンダリングと表示ロジックを処理
- **InputHandler**: キーボード入力とキーバインドを処理
- **ThemeManager**: カラーテーマとテキストフォーマットを管理
- **MouseEventFilter**: ターミナル出力でのマウスイベントアーティファクトを防止
- **CacheManager**: パフォーマンス向上のための永続的キャッシュを管理
- **FastParser**: 大規模な記録ファイル用の最適化されたJSONLパーサー
- **ConversationBuilder**: 会話ペアの構築とコンパクト継続の統合
- **ContentExtractor**: メッセージコンテンツの抽出と処理
- **FileDiscoveryService**: 記録ファイルの効率的な検出
- **ProjectExtractor**: 記録からプロジェクト情報を抽出
- **SessionStatisticsCalculator**: セッションメトリクスと統計を計算

## テスト

ccscopeには、信頼性と保守性を確保するためのJestで構築された包括的なテストスイートが含まれています。すべての主要コンポーネントにユニットテストが含まれています。

### テストの実行

```bash
# 依存関係をインストール（開発依存関係を含む）
npm install

# すべてのテストを実行
npm test

# ウォッチモードでテストを実行
npm run test:watch

# カバレッジレポート付きでテストを実行
npm run test:coverage
```

### テスト構造

```
__tests__/
├── helpers/              # テストユーティリティとモック
│   ├── testHelpers.js   # 共通テストデータとユーティリティ
│   └── mockTerminal.js  # モックターミナルインターフェース
├── SessionManager.test.js
├── StateManager.test.js
├── ViewRenderer.test.js
├── InputHandler.test.js
├── MouseEventFilter.test.js
├── ThemeManager.test.js
└── setup.js             # Jest設定
```

## コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを開く

## ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## サポート

- 🐛 [問題を報告](https://github.com/taguchiu/ccscope/issues)
- 💬 [ディスカッション](https://github.com/taguchiu/ccscope/discussions)
- 📦 [npmパッケージ](https://www.npmjs.com/package/ccscope)