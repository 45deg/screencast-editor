# Screencast Editor

Screencast Editor is a browser-based video editor for short screen recordings and product walkthroughs. It focuses on a small set of editing operations that are common in screencast workflows: cutting a recording into scenes, adjusting timing, applying crop regions, placing text or image overlays, and exporting the result as `GIF` or `MP4`.

The application runs entirely in the browser. Source media is imported locally, previewed in the UI, and exported with WebAssembly FFmpeg.

## Features

- Import local video files including `MP4`, `WebM`, `MOV`, and `AVI`
- Capture the current tab, window, or display with `getDisplayMedia`
- Split recordings into timeline slices and rearrange timing
- Resize and move slices on the timeline
- Adjust playback speed per slice
- Apply a global crop or a crop per scene
- Add text overlays
- Add image overlays
- Preview edits directly in the browser
- Export to `GIF` or `MP4`
- Undo and redo editor operations
- Use the UI in English or Japanese

## Tech Stack

- React 19
- TypeScript
- Vite
- Zustand for editor state management
- Tailwind CSS 4 for styling
- Framer Motion for timeline and UI motion
- `@ffmpeg/ffmpeg` and `@ffmpeg/util` for in-browser export
- `i18next` and `react-i18next` for localization
- Vitest for unit and integration tests

## Requirements

- Node.js 20 or later recommended
- `pnpm`
- A modern browser with support for:
  - `MediaRecorder`
  - `getDisplayMedia`
  - `WebAssembly`
- Network access at runtime to download the FFmpeg core from jsDelivr

## Development

Install dependencies and start the Vite development server:

```bash
pnpm install
pnpm dev
```

Build for production:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm test
pnpm test:ffmpeg
pnpm -s tsc -p tsconfig.app.json --noEmit
```

`pnpm test:ffmpeg` requires a system `ffmpeg` binary. The application itself does not depend on a system FFmpeg installation during normal use; it loads the browser runtime on demand.

## Export

The export pipeline is built around FFmpeg filter generation in the browser.

Supported output settings include:

- Format: `GIF` or `MP4`
- Output width and height
- GIF FPS
- GIF palette mode
- GIF dithering mode
- MP4 FPS
- MP4 encoding preset

Blank regions on the timeline are rendered as black frames in the exported output.

## Project Structure

```text
src/App.tsx                          App shell and feature wiring
src/app/hooks/useScreenCapture.ts    Browser screen recording flow
src/components/SliceEditor.tsx       Timeline editor container
src/components/PropertyPanel.tsx     Export settings UI
src/store/editorStore.ts             Zustand editor state
src/lib/ffmpegCommand.ts             FFmpeg command and filter generation
src/i18n.ts                          i18n initialization
src/i18n/resources/*                 Translation dictionaries
```

## Contributing

Contributions are welcome.

If you plan to make a code change, please:

1. Open an issue or discussion first for larger changes.
2. Keep changes scoped to the relevant area of the app.
3. Run the checks below before submitting.

Recommended verification:

```bash
pnpm -s tsc -p tsconfig.app.json --noEmit
pnpm test
```

If you modify export behavior, it is also useful to run:

```bash
pnpm test:ffmpeg
```

## License

MIT
