import { useEffect } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { useTranslation } from 'react-i18next';
import AppHeader from './app/components/AppHeader';
import EditorWorkspace from './app/components/EditorWorkspace';
import LandingWorkspace from './app/components/LandingWorkspace';
import MobileSettingsDrawer from './app/components/MobileSettingsDrawer';
import { useAppLifecycle } from './app/hooks/useAppLifecycle';
import { useAppScreenCapture } from './app/hooks/useAppScreenCapture';
import { useAppDerivedState } from './app/hooks/useAppDerivedState';
import { useAnnotationHandlers } from './app/hooks/useAnnotationHandlers';
import { useCropEditHandlers } from './app/hooks/useCropEditHandlers';
import { useExportHandler } from './app/hooks/useExportHandler';
import { useGlobalDragAndDrop } from './app/hooks/useGlobalDragAndDrop';
import { useMediaImportHandlers } from './app/hooks/useMediaImportHandlers';
import { useResponsiveSettingsDrawer } from './app/hooks/useResponsiveSettingsDrawer';
import { useEditorStore } from './store/editorStore';

export default function App() {
  const { t } = useTranslation();

  const {
    video,
    slices,
    annotations,
    currentTime,
    selectedSliceId,
    selectedAnnotationId,
    globalCrop,
    exportSettings,
    ffmpegStatus,
    ffmpegError,
    past,
    future,
    setVideo,
    clearVideo,
    setCurrentTime,
    setSelectedSliceId,
    setSelectedAnnotationId,
    replaceSlicesPreview,
    replaceSlicesCommit,
    replaceAnnotationsPreview,
    replaceAnnotationsCommit,
    setGlobalCropCommit,
    setSliceCropCommit,
    updateExportSettings,
    setFfmpegStatus,
    undo,
    redo,
  } = useEditorStore();

  const {
    fullCrop,
    baseCrop,
    previewSlice,
    activeSceneCrop,
    activeAnnotations,
    selectedTextAnnotation,
    hasVideo,
    totalDuration,
    previewSourceTime,
    videoInfoItems,
    outputAspectRatio,
  } = useAppDerivedState({
    video,
    globalCrop,
    slices,
    annotations,
    currentTime,
    selectedAnnotationId,
    exportSettings,
  });

  const { isMobileSettingsDrawerOpen, setIsMobileSettingsDrawerOpen, isDesktopViewport } =
    useResponsiveSettingsDrawer({ hasVideo });

  const {
    resetPendingAnnotationPreview,
    handleSelectedAnnotationChange,
    handleAnnotationPositionPreview,
    handleAnnotationImageResizePreview,
    handleAnnotationPositionCommit,
    handleTextAnnotationChange,
    handleTextAnnotationStyleChange,
  } = useAnnotationHandlers({
    annotations,
    baseCrop,
    selectedAnnotationId,
    selectedTextAnnotation,
    replaceAnnotationsPreview,
    replaceAnnotationsCommit,
    setSelectedSliceId,
    setSelectedAnnotationId,
  });

  const {
    isExporting,
    exportProgress,
    exportProgressLabel,
    exportError,
    ensureFfmpegRuntimeReady,
    handleExport,
    resetExportState,
    syncFfmpegStatusRef,
  } = useExportHandler({
    video,
    slices,
    annotations,
    baseCrop,
    globalCrop,
    exportSettings,
    totalDuration,
    t: (key, options) => t(key, options),
    setFfmpegStatus,
  });

  useEffect(() => {
    syncFfmpegStatusRef(ffmpegStatus);
  }, [ffmpegStatus, syncFfmpegStatusRef]);

  useEffect(() => {
    void ensureFfmpegRuntimeReady();
  }, [ensureFfmpegRuntimeReady]);

  const {
    cropEditMode,
    effectiveEditCrop,
    handleStartCropEdit,
    handleStartSceneCropEdit,
    handleEditCropPreview,
    handleConfirmCropEdit,
    handleCancelCropEdit,
    handleResetCropEdit,
  } = useCropEditHandlers({
    video,
    videoObjectUrl: video?.objectUrl,
    slices,
    selectedSliceId,
    currentTime,
    globalCrop,
    fullCrop,
    baseCrop,
    setSelectedAnnotationId,
    setSelectedSliceId,
    setGlobalCropCommit,
    setSliceCropCommit,
  });

  const {
    importError,
    setImportError,
    isImporting,
    handleImportVideo,
    handleReturnToLanding,
    handleCreateTextAnnotation,
    handleCreateImageAnnotation,
  } = useMediaImportHandlers({
    video,
    annotations,
    baseCrop,
    currentTime,
    setVideo,
    replaceAnnotationsCommit,
    setSelectedSliceId,
    setSelectedAnnotationId,
    clearVideo,
    ensureFfmpegRuntimeReady,
    resetExportState,
    t: (key) => t(key),
  });

  const { supportsScreenCapture, screenCaptureState, handleStartScreenCapture, handleStopScreenCapture } =
    useAppScreenCapture({
      onImportVideo: handleImportVideo,
      onImportError: setImportError,
      resetExportState,
      t: (key) => t(key),
    });

  useGlobalDragAndDrop({
    hasVideo,
    video,
    t: (key) => t(key),
    onImportVideo: handleImportVideo,
    onCreateImageAnnotation: handleCreateImageAnnotation,
  });

  useAppLifecycle({
    videoObjectUrl: video?.objectUrl,
    resetPendingAnnotationPreview,
    baseCrop,
    exportSettings,
    updateExportSettings,
  });

  return (
    <Drawer.Root open={isMobileSettingsDrawerOpen} onOpenChange={setIsMobileSettingsDrawerOpen}>
      <div
        className={`${hasVideo ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'} bg-[linear-gradient(160deg,#020617_0%,#0b1120_42%,#111827_100%)] text-slate-100`}
      >
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(34,211,238,0.2),transparent_38%),radial-gradient(circle_at_92%_4%,rgba(16,185,129,0.2),transparent_30%)]" />

        <AppHeader
          hasVideo={hasVideo}
          video={video}
          videoInfoItems={videoInfoItems}
          canOpenMobileSettings={Boolean(hasVideo && baseCrop)}
          onReturnToLanding={handleReturnToLanding}
        />

        {hasVideo && video && baseCrop ? (
          <EditorWorkspace
            video={video}
            baseCrop={baseCrop}
            currentTime={currentTime}
            previewSourceTime={previewSourceTime}
            totalDuration={totalDuration}
            activeSceneCrop={activeSceneCrop}
            activeAnnotations={activeAnnotations}
            selectedSliceId={selectedSliceId}
            selectedAnnotationId={selectedAnnotationId}
            selectedTextAnnotation={selectedTextAnnotation}
            hasActiveVideoSlice={Boolean(previewSlice)}
            cropEditMode={cropEditMode}
            effectiveEditCrop={effectiveEditCrop}
            onStartCropEdit={handleStartCropEdit}
            onEditCropPreview={handleEditCropPreview}
            onConfirmCropEdit={handleConfirmCropEdit}
            onCancelCropEdit={handleCancelCropEdit}
            onResetCropEdit={handleResetCropEdit}
            onCurrentTimeChange={setCurrentTime}
            onSelectedAnnotationIdChange={handleSelectedAnnotationChange}
            onAnnotationPositionPreview={handleAnnotationPositionPreview}
            onAnnotationImageResizePreview={handleAnnotationImageResizePreview}
            onAnnotationPositionCommit={handleAnnotationPositionCommit}
            onTextAnnotationChange={handleTextAnnotationChange}
            onTextAnnotationStyleChange={handleTextAnnotationStyleChange}
            slices={slices}
            annotations={annotations}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onSelectedSliceIdChange={setSelectedSliceId}
            onStartSceneCropEdit={handleStartSceneCropEdit}
            onSlicesPreview={replaceSlicesPreview}
            onSlicesCommit={replaceSlicesCommit}
            onAnnotationsPreview={replaceAnnotationsPreview}
            onAnnotationsCommit={replaceAnnotationsCommit}
            onCreateTextAnnotation={handleCreateTextAnnotation}
            onCreateImageAnnotation={handleCreateImageAnnotation}
            outputAspectRatio={outputAspectRatio}
            onUndo={undo}
            onRedo={redo}
            exportSettings={exportSettings}
            ffmpegStatus={ffmpegStatus}
            ffmpegError={ffmpegError}
            isExporting={isExporting}
            exportProgress={exportProgress}
            exportProgressLabel={exportProgressLabel}
            exportError={exportError}
            onChangeExportSettings={updateExportSettings}
            onExport={handleExport}
          />
        ) : (
          <LandingWorkspace
            isImporting={isImporting}
            isScreenCaptureProcessing={screenCaptureState === 'processing'}
            importError={importError}
            supportsScreenCapture={supportsScreenCapture}
            isScreenCaptureStarting={screenCaptureState === 'starting'}
            isScreenCaptureRecording={screenCaptureState === 'recording'}
            onImportVideo={handleImportVideo}
            onStartScreenCapture={handleStartScreenCapture}
            onStopScreenCapture={handleStopScreenCapture}
          />
        )}
      </div>

      {hasVideo && baseCrop ? (
        <MobileSettingsDrawer
          isVisible={!isDesktopViewport}
          baseCrop={baseCrop}
          exportSettings={exportSettings}
          ffmpegStatus={ffmpegStatus}
          ffmpegError={ffmpegError}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportProgressLabel={exportProgressLabel}
          exportError={exportError}
          onChangeExportSettings={updateExportSettings}
          onExport={handleExport}
        />
      ) : null}
    </Drawer.Root>
  );
}
