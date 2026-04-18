# AGENTS.md

## 目的
このファイルは、修正時に最初に参照するナビゲーションです。
無駄なファイル探索を避け、対象範囲を最短で特定するために使います。

## 必須ルール
1. 変更作業を始める前にこのファイルを読む。
2. まず「タスク別ルーティング」で対象ファイルを特定する。
3. 特定したファイルだけを先に読み、不要な横断探索をしない。
4. 挙動変更禁止の修正では、既存の入力/出力/副作用を維持する。
5. 影響範囲が広いときだけ、関連セクションを追加で読む。

## タスク別ルーティング
- アプリ全体の画面構成を変える:
  - src/App.tsx
- App の純関数ロジックを変える:
  - src/app/appUtils.ts
- 画面録画の開始/停止/取り込みを変える:
  - src/app/hooks/useScreenCapture.ts
- キャンバス表示や注釈ドラッグを変える:
  - src/components/CanvasPreview.tsx
  - src/components/canvas-preview/math.ts
- タイムライン編集全体を変える:
  - src/components/SliceEditor.tsx
  - src/components/slice-editor/useSliceEditorHandlers.ts
  - src/components/slice-editor/useSliceEditorMutationHandlers.ts
  - src/components/slice-editor/useSliceEditorPointerHandlers.ts
- タイムラインの個別 UI (トラック/ブロック/ルーラー/再生ヘッド):
  - src/components/slice-editor/TimelineTracks.tsx
  - src/components/slice-editor/TimelineSliceBlock.tsx
  - src/components/slice-editor/AnnotationLayerBlock.tsx
  - src/components/slice-editor/TimelineRuler.tsx
  - src/components/slice-editor/TimelinePlayhead.tsx
- 出力設定 UI を変える:
  - src/components/PropertyPanel.tsx
  - src/components/property-panel/*
- 状態管理 (Zustand) を変える:
  - src/store/editorStore.ts
  - src/store/editorStoreHelpers.ts
  - src/store/editorStoreActions.ts
  - src/store/editor-store-actions/*
- FFmpeg コマンド生成を変える:
  - src/lib/ffmpegCommand.ts
- i18n を変える:
  - src/i18n.ts
  - src/i18n/resources/en.ts
  - src/i18n/resources/ja.ts

## ファイル構成概要
- src/App.tsx:
  - 画面全体のレイアウトと各機能コンポーネントの接続。
  - Editor store と各 hook を束ねるエントリ。
- src/app/appUtils.ts:
  - App で使う純関数群 (crop, annotation clamp, file/size format, DnD helper など)。
- src/app/hooks/useScreenCapture.ts:
  - getDisplayMedia + MediaRecorder のライフサイクルを管理。
- src/components/CanvasPreview.tsx:
  - プレビュー再生、crop 編集 UI、注釈編集 UI の描画とイベント処理。
- src/components/canvas-preview/math.ts:
  - CanvasPreview で使う表示計算/座標計算/スタイル計算の純関数。
- src/components/SliceEditor.tsx:
  - タイムライン編集画面のコンテナ。
- src/components/slice-editor/*:
  - タイムライン UI 部品と操作 hook の分割実装。
- src/components/PropertyPanel.tsx:
  - 出力設定パネルのコンテナ。
- src/components/property-panel/*:
  - 出力設定パネルのセクション単位 UI。
- src/store/editorStore.ts:
  - store の state 定義と action 合成。
- src/store/editor-store-actions/*:
  - action を責務別に分割した実装。
- src/lib/ffmpegCommand.ts:
  - export 実行用 ffmpeg 引数/フィルタ組み立て。
- src/i18n.ts, src/i18n/resources/*:
  - i18next 初期化と言語別辞書。

## 修正時の最短手順
1. このファイルの「タスク別ルーティング」で対象を決める。
2. 対象ファイルのみ読んで変更する。
3. 変更後は `pnpm -s tsc -p tsconfig.app.json --noEmit` を実行して型確認する。
4. 必要なら `pnpm test` で回帰確認する。

## 挙動維持の注意点
- FFmpeg 関連:
  - コマンド組み立て順序と filter 入力順は変えない。
- タイムライン関連:
  - preview と commit の分離を崩さない。
- 画面録画関連:
  - `starting -> recording -> processing -> idle` の状態遷移を維持する。
- i18n 関連:
  - 既存キー名は変更しない。
