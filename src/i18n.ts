import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const SUPPORTED_LANGUAGES = ['en', 'ja'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: {
    translation: {
      app: {
        unknownError: 'An unknown error occurred.',
        noExportTarget: 'There is nothing to export.',
        ffmpegExecutionFailed: 'FFmpeg execution failed (exit code: {{code}})',
        replaceVideoConfirm: 'Close the current video and load a new one?',
        back: 'Back',
        export: 'Export',
        outputSettings: 'Output settings',
        outputSettingsDescription: 'Export conditions and advanced parameters',
        close: 'Close',
      },
      dropzone: {
        loadingTitle: 'Loading videos',
        idleTitle: 'Upload videos',
        formats: 'MP4, WebM, MOV, AVI',
        readingFile: 'Reading file...',
        selectVideos: 'Select Videos',
        openFromDisk: 'Open an existing video file or drag and drop it here.',
        captureTitle: 'Record screen',
        captureDescription: 'Capture a tab, window, or screen and import it as a video.',
        recordingTitle: 'Recording screen',
        recordingDescription: 'When you finish recording, stop sharing to import the captured video.',
        startCapture: 'Start Capture',
        stopCapture: 'Stop & Import',
        startingCapture: 'Preparing capture...',
        captureFailed: 'Failed to capture the screen.',
        emptyCapture: 'No video was captured.',
      },
      propertyPanel: {
        title: 'Property Panel',
        format: 'Format',
        outputSize: 'Output size',
        outputSizePx: 'Output Size (px)',
        scale: 'Scale',
        gifPreset: 'GIF preset',
        mp4Details: 'MP4 details',
        lightweight: 'Lightweight',
        looksAndSize: 'Looks and file size',
        highQuality: 'High quality',
        perFramePalette: 'Per-frame palette',
        standard: 'Standard',
        compressionEfficiency: 'Best compression efficiency',
        balance: 'Balanced',
        fpsMp4: 'FPS (MP4)',
        exporting: 'Exporting...',
        exportFormat: 'Export {{format}}',
        ffmpegStatus: 'FFmpeg status',
      },
      sliceEditor: {
        editorControls: 'Editor controls',
        undo: 'Undo',
        undoWithShortcut: 'Undo (Ctrl+Z)',
        redo: 'Redo',
        redoWithShortcut: 'Redo (Ctrl+Shift+Z)',
        sceneCrop: 'Scene crop',
        crop: 'Crop',
        cutAtPlayhead: 'Cut at playhead',
        cut: 'Cut',
        deleteSelection: 'Delete selected layer',
        deleteSelectedSlice: 'Delete selected slice',
        deleteWithShortcut: 'Delete selected slice (Del)',
        addTextLayer: 'Add text',
        addImageLayer: 'Add image',
        playbackSpeed: 'Playback speed',
        sliceSpeed: 'Slice speed',
        timelineZoom: 'Timeline zoom ({{zoom}}x)',
        sceneNumber: 'Scene #{{index}}',
        videoTrack: 'Video Track',
        textTrack: 'Text Layer',
        imageTrack: 'Image Layer',
        gapIsBlack: 'Blank timeline areas are rendered as black.',
        layerHint: 'Drag layers horizontally to change timing.',
      },
      canvas: {
        title: 'Canvas Preview',
        reset: 'Reset',
        cancel: 'Cancel',
        confirm: 'OK',
        previewControls: 'Preview controls',
        source: 'Source',
        sourceInfo: 'Source info',
        restartPreview: 'Restart preview',
        pausePreview: 'Pause preview',
        playPreview: 'Play preview',
        moveCrop: 'Move crop',
        resizeNorthWest: 'Resize north-west',
        resizeNorthEast: 'Resize north-east',
        resizeSouthWest: 'Resize south-west',
        resizeSouthEast: 'Resize south-east',
        resizeNorth: 'Resize north',
        resizeSouth: 'Resize south',
        resizeWest: 'Resize west',
        resizeEast: 'Resize east',
        textToolbar: 'Text layer styling toolbar',
        textContent: 'Text content',
        textPlaceholder: 'Add caption text',
        defaultText: 'New text',
        bold: 'Bold',
        italic: 'Italic',
        fontSize: 'Font size',
        fontColor: 'Font color',
        toggleBox: 'Toggle text background',
        boxColor: 'Background color',
        outlineWidth: 'Outline width',
        outlineColor: 'Outline color',
      },
      video: {
        metadataLoadFailed: 'Failed to read the video metadata. Please check whether the file format is supported.',
      },
      thumbnail: {
        stageCanvasInitFailed: 'Failed to initialize the canvas for thumbnail composition.',
        generationFailed: 'Failed to generate the thumbnail.',
        seekFailed: 'Failed to seek while generating the thumbnail.',
        renderCanvasInitFailed: 'Failed to initialize the canvas for thumbnail rendering.',
        drawFailed: 'Failed to draw the thumbnail.',
      },
    },
  },
  ja: {
    translation: {
      app: {
        unknownError: '不明なエラーが発生しました。',
        noExportTarget: 'エクスポート対象がありません。',
        ffmpegExecutionFailed: 'FFmpeg 実行が失敗しました (exit code: {{code}})',
        replaceVideoConfirm: '現在の動画を閉じて、新しい動画を読み込みますか？',
        back: '戻る',
        export: '出力',
        outputSettings: '出力設定',
        outputSettingsDescription: 'エクスポート条件と詳細パラメータ',
        close: '閉じる',
      },
      dropzone: {
        loadingTitle: '動画を読み込み中',
        idleTitle: '動画をアップロード',
        formats: 'MP4, WebM, MOV, AVI',
        readingFile: 'ファイルを読み込み中...',
        selectVideos: '動画を選択',
        openFromDisk: '既存の動画ファイルを開くか、ここへドラッグ＆ドロップします。',
        captureTitle: '画面を録画',
        captureDescription: 'タブ、ウィンドウ、画面全体を録画して、そのまま動画として取り込みます。',
        recordingTitle: '画面を録画中',
        recordingDescription: '録画が終わったら停止して、キャプチャした動画を取り込みます。',
        startCapture: '録画を開始',
        stopCapture: '停止して取り込む',
        startingCapture: '録画を準備中...',
        captureFailed: '画面録画に失敗しました。',
        emptyCapture: '録画された動画がありませんでした。',
      },
      propertyPanel: {
        title: '出力設定',
        format: 'フォーマット',
        outputSize: '出力サイズ',
        outputSizePx: '出力サイズ (px)',
        scale: '倍率',
        gifPreset: 'GIF プリセット',
        mp4Details: 'MP4 詳細',
        lightweight: '軽さ優先',
        looksAndSize: '見た目と容量',
        highQuality: '高品質',
        perFramePalette: 'フレームごとにパレット',
        standard: '標準',
        compressionEfficiency: '圧縮効率優先',
        balance: 'バランス',
        fpsMp4: 'FPS (MP4)',
        exporting: 'エクスポート中...',
        exportFormat: '{{format}} をエクスポート',
        ffmpegStatus: 'FFmpeg status',
      },
      sliceEditor: {
        editorControls: '編集コントロール',
        undo: '元に戻す',
        undoWithShortcut: '元に戻す (Ctrl+Z)',
        redo: 'やり直す',
        redoWithShortcut: 'やり直す (Ctrl+Shift+Z)',
        sceneCrop: 'シーン切り抜き',
        crop: '切り抜き',
        cutAtPlayhead: '再生位置で分割',
        cut: '分割',
        deleteSelection: '選択レイヤーを削除',
        deleteSelectedSlice: '選択したシーンを削除',
        deleteWithShortcut: '選択したシーンを削除 (Del)',
        addTextLayer: 'テキスト追加',
        addImageLayer: '画像追加',
        playbackSpeed: '再生速度',
        sliceSpeed: 'シーン速度',
        timelineZoom: 'タイムライン拡大率 ({{zoom}}x)',
        sceneNumber: 'シーン #{{index}}',
        videoTrack: '動画トラック',
        textTrack: 'テキストレイヤー',
        imageTrack: '画像レイヤー',
        gapIsBlack: '空白区間は黒背景として出力されます。',
        layerHint: 'レイヤーを横ドラッグして表示タイミングを調整します。',
      },
      canvas: {
        title: 'プレビュー',
        reset: 'リセット',
        cancel: 'キャンセル',
        confirm: 'OK',
        previewControls: 'プレビュー操作',
        source: 'ソース',
        sourceInfo: 'ソース情報',
        restartPreview: 'プレビューを最初から再生',
        pausePreview: 'プレビューを一時停止',
        playPreview: 'プレビューを再生',
        moveCrop: '切り抜き範囲を移動',
        resizeNorthWest: '左上をリサイズ',
        resizeNorthEast: '右上をリサイズ',
        resizeSouthWest: '左下をリサイズ',
        resizeSouthEast: '右下をリサイズ',
        resizeNorth: '上辺をリサイズ',
        resizeSouth: '下辺をリサイズ',
        resizeWest: '左辺をリサイズ',
        resizeEast: '右辺をリサイズ',
        textToolbar: 'テキストレイヤーのスタイル設定',
        textContent: 'テキスト内容',
        textPlaceholder: '字幕テキストを入力',
        defaultText: '新しいテキスト',
        bold: '太字',
        italic: '斜体',
        fontSize: 'フォントサイズ',
        fontColor: '文字色',
        toggleBox: '背景表示の切り替え',
        boxColor: '背景色',
        outlineWidth: 'アウトライン太さ',
        outlineColor: 'アウトライン色',
      },
      video: {
        metadataLoadFailed: '動画メタデータの読み込みに失敗しました。対応形式か確認してください。',
      },
      thumbnail: {
        stageCanvasInitFailed: 'サムネイル合成用のキャンバスを初期化できませんでした。',
        generationFailed: 'サムネイルの生成に失敗しました。',
        seekFailed: 'サムネイルのシークに失敗しました。',
        renderCanvasInitFailed: 'サムネイル描画用のキャンバスを初期化できませんでした。',
        drawFailed: 'サムネイルの描画に失敗しました。',
      },
    },
  },
} as const;

function normalizeLanguageTag(languageTag: string | null | undefined): SupportedLanguage {
  const primaryLanguage = languageTag?.toLowerCase().split('-')[0];
  return primaryLanguage === 'ja' ? 'ja' : 'en';
}

function detectInitialLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const candidate of candidates) {
    const normalized = normalizeLanguageTag(candidate);
    if (SUPPORTED_LANGUAGES.includes(normalized)) {
      return normalized;
    }
  }

  return 'en';
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language;
  void i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language;
  });
}

export { i18n };
