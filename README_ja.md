# Screencast Editor

Screencast Editor は、短い画面録画やプロダクト紹介動画の編集を想定したブラウザベースの動画エディタです。スクリーンキャストでよく使う編集操作に絞り、録画の分割、タイミング調整、クロップ、テキストや画像のオーバーレイ追加、`GIF` / `MP4` への書き出しを行えます。

アプリケーションはブラウザ内で完結します。素材はローカルから読み込まれ、UI 上でプレビューされ、書き出しは WebAssembly 版 FFmpeg を使って実行されます。

## 機能

- `MP4`、`WebM`、`MOV`、`AVI` などのローカル動画ファイルを読み込み
- `getDisplayMedia` を使ったタブ・ウィンドウ・画面の録画
- 録画をタイムライン上のスライスに分割
- スライスの移動と長さ調整
- スライス単位の再生速度変更
- 全体クロップとシーン単位クロップ
- テキストオーバーレイの追加
- 画像オーバーレイの追加
- ブラウザ上でのプレビュー再生
- `GIF` / `MP4` への書き出し
- Undo / Redo
- 英語・日本語 UI

## 技術スタック

- React 19
- TypeScript
- Vite
- 編集状態管理に Zustand
- スタイリングに Tailwind CSS 4
- タイムラインと UI アニメーションに Framer Motion
- ブラウザ内書き出しに `@ffmpeg/ffmpeg` と `@ffmpeg/util`
- 多言語対応に `i18next` と `react-i18next`
- テストに Vitest

## 必要条件

- Node.js 20 以上推奨
- `pnpm`
- 以下に対応したモダンブラウザ
  - `MediaRecorder`
  - `getDisplayMedia`
  - `WebAssembly`
- 実行時に jsDelivr から FFmpeg コアを取得するためのネットワーク接続

## 開発

依存関係をインストールして、Vite の開発サーバーを起動します。

```bash
pnpm install
pnpm dev
```

本番ビルド:

```bash
pnpm build
```

本番ビルドのローカル確認:

```bash
pnpm preview
```

## スクリプト

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm test
pnpm test:ffmpeg
pnpm -s tsc -p tsconfig.app.json --noEmit
```

`pnpm test:ffmpeg` の実行にはシステム `ffmpeg` バイナリが必要です。通常のアプリ利用時にはシステム FFmpeg は不要で、必要なランタイムはブラウザ側で遅延読み込みされます。

## 書き出し

書き出し処理は、ブラウザ内で生成される FFmpeg フィルタグラフをベースにしています。

サポートしている主な出力設定:

- 形式: `GIF` または `MP4`
- 出力サイズ
- GIF の FPS
- GIF のパレットモード
- GIF のディザリング方式
- MP4 の FPS
- MP4 のエンコードプリセット

タイムライン上の空白部分は、書き出し結果では黒フレームとして扱われます。

## 主なファイル構成

```text
src/App.tsx                          アプリ全体の構成と配線
src/app/hooks/useScreenCapture.ts    ブラウザ画面録画フロー
src/components/SliceEditor.tsx       タイムラインエディタ本体
src/components/PropertyPanel.tsx     書き出し設定 UI
src/store/editorStore.ts             Zustand の編集状態
src/lib/ffmpegCommand.ts             FFmpeg コマンド/フィルタ生成
src/i18n.ts                          i18n 初期化
src/i18n/resources/*                 翻訳辞書
```

## Contributing

コントリビューションは歓迎します。

コード変更を行う場合は、次の流れを推奨します。

1. 変更規模が大きい場合は、先に issue または discussion で方向性を共有する
2. 変更範囲は関係する機能に絞る
3. 提出前に以下の確認を行う

推奨チェック:

```bash
pnpm -s tsc -p tsconfig.app.json --noEmit
pnpm test
```

書き出し処理に影響する変更では、次も有用です。

```bash
pnpm test:ffmpeg
```

## License

MIT
