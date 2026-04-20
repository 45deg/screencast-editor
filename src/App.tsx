import { lazy, Suspense, useEffect } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { useTranslation } from 'react-i18next';
import AppHeader from './app/components/AppHeader';
import LandingWorkspace from './app/components/LandingWorkspace';
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

const EditorWorkspace = lazy(() => import('./app/components/EditorWorkspace'));
const MobileSettingsDrawer = lazy(() => import('./app/components/MobileSettingsDrawer'));

function EditorWorkspaceFallback() {
  return (
    <main className="fixed inset-x-0 bottom-0 top-16 z-10 overflow-hidden lg:right-[23rem]">
      <div className="flex h-full min-h-0 items-center justify-center rounded-none border border-slate-800/70 bg-slate-950/50 px-4 text-sm text-slate-300">
        Loading editor workspace...
      </div>
    </main>
  );
}

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
    exportRuntimeStatus,
    exportRuntimeError,
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
    setExportRuntimeStatus,
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
    selectedImageAnnotation,
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
    handleSelectedImageOpacityChange,
    hasSelectedAnnotationLayerOverlap,
    canBringSelectedAnnotationToFront,
    canSendSelectedAnnotationToBack,
    handleMoveSelectedAnnotationLayer,
    handleDeleteSelectedAnnotation,
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
    isCancelling,
    exportProgress,
    exportProgressLabel,
    exportError,
    ensureExportRuntimeReady,
    handleExport,
    cancelExport,
    resetExportState,
    syncExportRuntimeStatusRef,
  } = useExportHandler({
    video,
    slices,
    annotations,
    baseCrop,
    globalCrop,
    exportSettings,
    totalDuration,
    t: (key, options) => t(key, options),
    setExportRuntimeStatus,
  });

  useEffect(() => {
    syncExportRuntimeStatusRef(exportRuntimeStatus);
  }, [exportRuntimeStatus, syncExportRuntimeStatusRef]);

  useEffect(() => {
    void ensureExportRuntimeReady();
  }, [ensureExportRuntimeReady]);

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

  const handleToggleSceneCropEdit = cropEditMode === 'scene' ? handleCancelCropEdit : handleStartSceneCropEdit;

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
    ensureExportRuntimeReady,
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
          <Suspense fallback={<EditorWorkspaceFallback />}>
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
              selectedImageAnnotation={selectedImageAnnotation}
              hasActiveVideoSlice={Boolean(previewSlice)}
              cropEditMode={cropEditMode}
              effectiveEditCrop={effectiveEditCrop}
              isSceneCropEditing={cropEditMode === 'scene'}
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
              onSelectedImageOpacityChange={handleSelectedImageOpacityChange}
              hasSelectedAnnotationLayerOverlap={hasSelectedAnnotationLayerOverlap}
              canBringSelectedAnnotationToFront={canBringSelectedAnnotationToFront}
              canSendSelectedAnnotationToBack={canSendSelectedAnnotationToBack}
              onMoveSelectedAnnotationLayer={handleMoveSelectedAnnotationLayer}
              onDeleteSelectedAnnotation={handleDeleteSelectedAnnotation}
              slices={slices}
              annotations={annotations}
              canUndo={past.length > 0}
              canRedo={future.length > 0}
              onSelectedSliceIdChange={setSelectedSliceId}
              onSceneCropToggle={handleToggleSceneCropEdit}
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
              exportRuntimeStatus={exportRuntimeStatus}
              exportRuntimeError={exportRuntimeError}
              isExporting={isExporting}
              isCancelling={isCancelling}
              exportProgress={exportProgress}
              exportProgressLabel={exportProgressLabel}
              exportError={exportError}
              onChangeExportSettings={updateExportSettings}
              onExport={handleExport}
              onCancelExport={cancelExport}
            />
          </Suspense>
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
        <Suspense fallback={null}>
          <MobileSettingsDrawer
            isVisible={!isDesktopViewport}
            baseCrop={baseCrop}
            exportSettings={exportSettings}
            exportRuntimeStatus={exportRuntimeStatus}
            exportRuntimeError={exportRuntimeError}
            isExporting={isExporting}
            isCancelling={isCancelling}
            exportProgress={exportProgress}
            exportProgressLabel={exportProgressLabel}
            exportError={exportError}
            onChangeExportSettings={updateExportSettings}
            onExport={handleExport}
            onCancelExport={cancelExport}
          />
        </Suspense>
      ) : null}
    </Drawer.Root>
  );
}
