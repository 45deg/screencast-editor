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
- Change the main app shell/header/landing/editor workspace layout:
  - src/app/components/AppHeader.tsx
  - src/app/components/LandingWorkspace.tsx
  - src/app/components/EditorWorkspace.tsx
  - src/app/components/MobileSettingsDrawer.tsx
- Change pure function logic shared by App:
  - src/app/appUtils.ts
- Change app lifecycle, derived state, responsive layout, or global DnD behavior:
  - src/app/hooks/useAppLifecycle.ts
  - src/app/hooks/useAppDerivedState.ts
  - src/app/hooks/useResponsiveSettingsDrawer.ts
  - src/app/hooks/useGlobalDragAndDrop.ts
- Change media import, export, crop, annotation, or app-level screen capture wiring:
  - src/app/hooks/useMediaImportHandlers.ts
  - src/app/hooks/useExportHandler.ts
  - src/app/hooks/useCropEditHandlers.ts
  - src/app/hooks/useAnnotationHandlers.ts
  - src/app/hooks/useAppScreenCapture.ts
- Change low-level screen recording start/stop/capture behavior:
  - src/app/hooks/useScreenCapture.ts
- Change canvas rendering or annotation dragging:
  - src/components/CanvasPreview.tsx
  - src/components/canvas-preview/math.ts
  - src/components/canvas-preview/annotationMath.ts
  - src/components/canvas-preview/*
- Change annotation editing UI:
  - src/components/annotation/*
- Change the overall timeline editor:
  - src/components/SliceEditor.tsx
  - src/components/slice-editor/EditorToolbar.tsx
  - src/components/slice-editor/useSliceEditorHandlers.ts
  - src/components/slice-editor/useSliceEditorMutationHandlers.ts
  - src/components/slice-editor/useSliceEditorPointerHandlers.ts
  - src/components/slice-editor/useSliceEditorThumbnails.ts
  - src/components/slice-editor/sliceMutations.ts
- Change individual timeline UI elements (tracks/blocks/ruler/playhead):
  - src/components/slice-editor/TimelineTracks.tsx
  - src/components/slice-editor/TimelineSliceBlock.tsx
  - src/components/slice-editor/AnnotationLayerBlock.tsx
  - src/components/slice-editor/TimelineRuler.tsx
  - src/components/slice-editor/TimelinePlayhead.tsx
  - src/components/slice-editor/timelineTracksConstants.ts
- Change video import/dropzone UI:
  - src/components/VideoDropzone.tsx
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
- Change browser export pipeline or export rendering:
  - src/lib/browserExport.ts
  - src/lib/exportRenderer.ts
  - src/lib/exportVideoUtils.ts
- Change video/image parsing, thumbnails, or mp4 helpers:
  - src/lib/video.ts
  - src/lib/videoThumbnail.ts
  - src/lib/image.ts
  - src/lib/mp4boxClient.ts
- Change annotation timeline helpers or rectangle math:
  - src/lib/annotationTimeline.ts
  - src/lib/containRect.ts
- Change i18n:
  - src/i18n.ts
  - src/i18n/resources/en.ts
  - src/i18n/resources/ja.ts
- Change shared editor data types:
  - src/types/editor.ts
- Change export sanity entry points:
  - src/exportSanityMain.tsx
  - src/exportSanityPage.tsx

## File Structure Overview
- src/App.tsx:
  - The top-level app shell.
  - Wires together the editor store, app hooks, and lazy-loaded workspaces.
- src/app/components/*:
  - App-level layout pieces for the header, landing screen, editor workspace, and mobile settings drawer.
- src/app/appUtils.ts:
  - Pure utility functions used by App and app hooks, such as crop, annotation clamping, formatting, and DnD helpers.
- src/app/hooks/*:
  - App-level orchestration hooks for lifecycle, derived state, import/export, crop editing, annotation editing, screen capture, responsiveness, and drag-and-drop.
- src/app/hooks/useScreenCapture.ts:
  - Manages the lifecycle of getDisplayMedia + MediaRecorder.
- src/components/CanvasPreview.tsx:
  - Renders preview playback, crop editing UI, and annotation editing UI, and handles events.
- src/components/canvas-preview/*:
  - Split preview rendering helpers, overlays, viewport logic, crop dragging, playback syncing, and annotation transform handlers.
- src/components/annotation/*:
  - Annotation-specific editing controls such as text and image style tools.
- src/components/SliceEditor.tsx:
  - The container for the timeline editing screen.
- src/components/slice-editor/*:
  - Split implementations for the timeline UI, toolbar, thumbnails, pointer handlers, and slice mutation helpers.
- src/components/VideoDropzone.tsx:
  - Drag-and-drop surface for bringing media into the editor.
- src/components/PropertyPanel.tsx:
  - The container for the output settings panel.
- src/components/property-panel/*:
  - Section-level UI for the output settings panel.
- src/store/editorStore.ts:
  - Store state definitions and action composition.
- src/store/editorStoreHelpers.ts:
  - Shared helper logic used by store actions.
- src/store/editorStoreActions.ts:
  - Store action composition entry point.
- src/store/editor-store-actions/*:
  - Implementations that split actions by responsibility.
- src/lib/ffmpegCommand.ts:
  - FFmpeg argument and filter construction for export execution.
- src/lib/*:
  - Focused media/export utilities for browser export, renderer orchestration, thumbnail extraction, MP4 parsing, image/video helpers, and geometry/timeline helpers.
- src/i18n.ts, src/i18n/resources/*:
  - i18next initialization and language-specific dictionaries.
- src/types/editor.ts:
  - Shared editor domain types.
- src/exportSanityMain.tsx, src/exportSanityPage.tsx:
  - Alternate entry point and page for export sanity testing.

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
