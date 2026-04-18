# AGENTS.md

## Purpose
This file is the first navigation reference to consult when making changes.
Use it to avoid unnecessary file exploration and to identify the target scope as quickly as possible.

## Required Rules
1. Read this file before starting any change work.
2. First identify the target files through the "Task Routing" section.
3. Read only the identified files first; do not perform unnecessary broad exploration.
4. For fixes that must not change behavior, preserve the existing inputs, outputs, and side effects.
5. Only read additional related sections when the impact scope is broad.

## Task Routing
- Change the overall app layout:
  - src/App.tsx
- Change pure function logic in App:
  - src/app/appUtils.ts
- Change screen recording start/stop/capture behavior:
  - src/app/hooks/useScreenCapture.ts
- Change canvas rendering or annotation dragging:
  - src/components/CanvasPreview.tsx
  - src/components/canvas-preview/math.ts
- Change the overall timeline editor:
  - src/components/SliceEditor.tsx
  - src/components/slice-editor/useSliceEditorHandlers.ts
  - src/components/slice-editor/useSliceEditorMutationHandlers.ts
  - src/components/slice-editor/useSliceEditorPointerHandlers.ts
- Change individual timeline UI elements (tracks/blocks/ruler/playhead):
  - src/components/slice-editor/TimelineTracks.tsx
  - src/components/slice-editor/TimelineSliceBlock.tsx
  - src/components/slice-editor/AnnotationLayerBlock.tsx
  - src/components/slice-editor/TimelineRuler.tsx
  - src/components/slice-editor/TimelinePlayhead.tsx
- Change the output settings UI:
  - src/components/PropertyPanel.tsx
  - src/components/property-panel/*
- Change state management (Zustand):
  - src/store/editorStore.ts
  - src/store/editorStoreHelpers.ts
  - src/store/editorStoreActions.ts
  - src/store/editor-store-actions/*
- Change FFmpeg command generation:
  - src/lib/ffmpegCommand.ts
- Change i18n:
  - src/i18n.ts
  - src/i18n/resources/en.ts
  - src/i18n/resources/ja.ts

## File Structure Overview
- src/App.tsx:
  - The overall screen layout and wiring between feature components.
  - The entry point that ties together the editor store and each hook.
- src/app/appUtils.ts:
  - Pure utility functions used by App, such as crop, annotation clamping, file/size formatting, and DnD helpers.
- src/app/hooks/useScreenCapture.ts:
  - Manages the lifecycle of getDisplayMedia + MediaRecorder.
- src/components/CanvasPreview.tsx:
  - Renders preview playback, crop editing UI, and annotation editing UI, and handles events.
- src/components/canvas-preview/math.ts:
  - Pure functions for display calculations, coordinate calculations, and style calculations used by CanvasPreview.
- src/components/SliceEditor.tsx:
  - The container for the timeline editing screen.
- src/components/slice-editor/*:
  - Split implementations for timeline UI parts and operation hooks.
- src/components/PropertyPanel.tsx:
  - The container for the output settings panel.
- src/components/property-panel/*:
  - Section-level UI for the output settings panel.
- src/store/editorStore.ts:
  - Store state definitions and action composition.
- src/store/editor-store-actions/*:
  - Implementations that split actions by responsibility.
- src/lib/ffmpegCommand.ts:
  - FFmpeg argument and filter construction for export execution.
- src/i18n.ts, src/i18n/resources/*:
  - i18next initialization and language-specific dictionaries.

## Minimum Change Workflow
1. Decide the target in the "Task Routing" section of this file.
2. Read and modify only the relevant files.
3. After changes, run `pnpm -s tsc -p tsconfig.app.json --noEmit` to verify types.
4. If needed, run `pnpm test` for regression checks.

## Behavioral Preservation Notes
- FFmpeg-related:
  - Do not change the command assembly order or the filter input order.
- Timeline-related:
  - Do not break the separation between preview and commit.
- Screen recording-related:
  - Preserve the state transition `starting -> recording -> processing -> idle`.
- i18n-related:
  - Do not change existing key names.
