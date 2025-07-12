# CCScope 🔍

[English](README.md) | [日本語](README.ja.md)

Claude Code Scope - Claude Codeの会話記録を閲覧するためのインタラクティブなターミナルブラウザ

[![npm version](https://badge.fury.io/js/ccscope.svg)](https://badge.fury.io/js/ccscope)
[![Downloads](https://img.shields.io/npm/dm/ccscope.svg)](https://npmjs.org/package/ccscope)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 概要

CCScope (Claude Code Scope)は、Claude Codeの会話記録を閲覧、分析、探索できる強力なターミナルベースのアプリケーションです。セッションのナビゲーション、思考パターンの分析、応答時間、ツール使用状況の確認などを直感的なインターフェースで提供します。

## 機能

- 🔍 **インタラクティブなブラウジング**: vimライクなキーバインドでセッションと会話をナビゲート
- 📊 **リッチな分析**: 応答時間とツール使用統計を表示
- 🔎 **全文検索**: すべての会話を横断してハイライト付きで検索、OR条件、正規表現サポート
- 🔄 **検索結果ナビゲーション**: 検索結果表示時は左右キーで検索ヒット項目間を移動
- 🔎 **検索とフィルタ**: 特定の会話を検索したりプロジェクトでフィルタリング
- 📱 **レスポンシブデザイン**: ターミナルサイズに合わせてワイドとコンパクトレイアウトを切り替え
- ⚡ **パフォーマンス**: 大規模データセット向けの仮想スクロールとキャッシング
- 🔧 **ツール分析**: ツール使用と実行フローの詳細な内訳
- 💭 **思考プロセス**: Claudeの思考パターンを表示
- 📈 **セッションメトリクス**: 会話の継続時間、応答時間、生産性を追跡

## スクリーンショット

### セッションリストビュー
```
🔍 Claude Code Scope
================================================================================
📊 35 Sessions | 💬 1503 Convos | ⏱️ 4d 9h 23m

▶ 1  52ccc342  ccscope               48 convos  1h 51m   07/10 23:52  07/12 19:58
  2  14208db7  sms-proto              7 convos  24m 24s   07/12 19:23  07/12 19:55
  3  7726f0    mobile-documents      40 convos   1h 6m   07/12 15:25  07/12 19:22

↑/↓ Navigate · Enter Details · f Filter · s Sort · q Exit
```

### 会話詳細ビュー
```
🔍 Claude Code Scope
================================================================================
💬 48 Convos | ⏱️ 1h 51m
Selected: [52ccc342] -Users-taguchiu-Documents-workspace-ccscope
📁 File: /Users/taguchiu/.claude/projects/...

▶ 1  07/10 14:30  12.3s  3t  Help me refactor ViewRenderer...
  2  07/10 14:35   8.7s  1t  Add full-width character support
  3  07/10 14:42  15.2s  5t  Implement virtual scrolling

↑/↓ Select · Enter Detail · ←/→ Switch Session · Esc Back
```

### フル詳細ビュー
```
[52ccc342] -Users-taguchiu-Documents-workspace-ccscope     [18-66/66] 100%
Conversation #15 of 48
================================================================================

👤 USER:
Help me refactor the ViewRenderer component...

🤖 ASSISTANT:
I'll help you refactor the ViewRenderer component...

🔧 Tools: Read×2, Edit×1

↑/↓ Scroll · Space Page · ←/→ Prev/Next · g/G Top/Bottom · Esc Back
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

# CCScopeを実行
ccscope

# またはnpxを使用してインストールなしで実行
npx ccscope

# これで完了！CCScopeは自動的にClaude Codeの記録を見つけます
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
npm install -g ccscope@1.0.0

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
ccscope --debug          # デバッグモードを有効化

# 検索例
ccscope search "エラー処理"
ccscope search "async await"
ccscope search "error OR warning"     # OR検索（大文字）
ccscope search "error or warning"     # OR検索（小文字）
ccscope search "function OR method"
ccscope search --regex "import.*from" # 正規表現検索
ccscope search --regex "\berror\b"    # 単語境界検索

# コマンドとオプションの組み合わせ
ccscope daily --debug
ccscope project --debug
```

### ナビゲーション

#### セッションリストビュー
- `↑/↓` または `k/j`: 上下に移動
- `Enter`: セッションの会話を表示
- `f`: プロジェクトでフィルタ
- `s`: セッションをソート（最終活動、期間、会話数、開始時刻、プロジェクト名）
- `/`: セッションを検索
- `h` または `?`: ヘルプを表示
- `q`: 終了

#### 会話詳細ビュー
- `↑/↓` または `k/j`: 会話を移動
- `←/→` または `h/l`: セッションを切り替え
- `Enter`: 会話の詳細を表示
- `s`: 会話をソート（日時、期間、ツール）
- `Esc`: セッションリストに戻る

#### フル詳細ビュー
- `↑/↓`: コンテンツをスクロール（5行単位）
- `Space/b`: ページアップ/ダウン
- `g/G`: 最上部/最下部にジャンプ
- `←/→`: 前/次の会話（検索経由の場合は検索結果間を移動）
- `Esc`: 会話リストに戻る

#### 検索結果ビュー
- `↑/↓`: 検索結果を移動
- `Enter`: 会話詳細を表示
- `Esc`: アプリケーションを終了

### キーボードショートカット

| キー | アクション |
|-----|----------|
| `q` | アプリケーションを終了 |
| `h` または `?` | ヘルプを表示 |
| `/` | 検索 |
| `f` | フィルタ |
| `s` | ソート |
| `r` | 更新 |
| `Esc` | 戻る |
| `Enter` | 選択/決定 |

## 設定

CCScopeは以下のディレクトリからClaude Codeの記録を自動的に検出します：
- `~/.claude/projects/`
- `~/.config/claude/transcripts/`
- `./transcripts/`
- `./`

### サポートされているフォーマット

CCScopeはJSONL形式（`.jsonl`拡張子）のClaude Code記録ファイルを読み込みます。

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

CCScopeはモジュラーアーキテクチャに従っています：

- **CCScope**: メインアプリケーションオーケストレータ
- **SessionManager**: 記録の検出と解析を処理
- **StateManager**: アプリケーションの状態とナビゲーションを管理
- **ViewRenderer**: UIレンダリングと表示ロジックを処理
- **InputHandler**: キーボード入力とキーバインドを処理
- **ThemeManager**: カラーテーマとテキストフォーマットを管理

### ソースからビルド

```bash
git clone https://github.com/taguchiu/ccscope.git
cd ccscope
npm install
npm start
```

### 開発コマンド

```bash
# 開発モードで実行
npm run dev

# アプリケーションを開始
npm start

# バイナリを実行可能にする
chmod +x bin/ccscope
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

## 謝辞

- [Claude Code](https://claude.ai/code)コミュニティのために構築
- ターミナルベースのファイルブラウザと分析ツールから着想を得ています
- すべてのコントリビューターとユーザーに感謝します

---

Claude Codeユーザーのために❤️を込めて作りました