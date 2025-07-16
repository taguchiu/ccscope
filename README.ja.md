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
🔍 Claude Code Scope
========================================================================================================
📊 35 Sessions | 💬 1503 Convos | ⏱️ 4d 9h 23m

▶ 1  52ccc342  ccscope               48 convos   1h 51m   07/10 23:52  07/12 19:58
  2  14208db7  sms-proto              7 convos  24m 24s   07/12 19:23  07/12 19:55
  3  7726f0    mobile-documents      40 convos    1h 6m   07/12 15:25  07/12 19:22

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select · Enter to view details · r resume · / full-text search · f filter · s sort · h help · q exit
```

### 会話詳細ビュー
```
🔍 Claude Code Scope
========================================================================================================
💬 48 Convos | ⏱️ 1h 51m
Selected: [52ccc342] -Users-taguchiu-Documents-workspace-ccscope
📁 File: /Users/taguchiu/.claude/projects/...

▶ 1  07/10 14:30  12.3s  3t  Help me refactor ViewRenderer...
  2  07/10 14:35   8.7s  1t  Add full-width character support
  3  07/10 14:42  15.2s  5t  Implement virtual scrolling

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select conversation · Enter to view detail · ←/→ or h/l switch session · r resume · s sort · Esc back · q exit
```

### フル詳細ビュー
```
[52ccc342] -Users-taguchiu-Documents-workspace-ccscope     [18-66/66] 100%
Conversation #15 of 48
========================================================================================================

👤 USER:
Help me refactor the ViewRenderer component...

🤖 ASSISTANT:
I'll help you refactor the ViewRenderer component...

⏺ Read(file: /src/ViewRenderer.js)
  ⎿ File content...
     ... +45 lines (ctrl+r to expand)

⏺ Edit(file: /src/ViewRenderer.js)
  ⎿ Applied changes successfully

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
npm install -g ccscope@1.2.1

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
├── bin/                 # 実行可能スクリプト
│   └── ccscope         # メインCLIエントリポイント
├── src/                # ソースコード
│   ├── config.js       # 設定
│   ├── SessionManager.js
│   ├── StateManager.js
│   ├── ViewRenderer.js
│   ├── InputHandler.js
│   ├── ThemeManager.js
│   └── CCScope.js
├── CLAUDE.md           # Claude Code統合ガイド
├── examples/           # サンプルファイル
├── package.json
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