import { Group, Panel, Separator } from 'react-resizable-panels';

import CanvasPreview from '../../components/CanvasPreview';
import PropertyPanel from '../../components/PropertyPanel';
import SliceEditorTimeline from '../../components/SliceEditor';
import type {
  AnnotationModel,
  AnnotationTextStyle,
  CropRect,
  ExportSettings,
  SliceModel,
  TextAnnotation,
  VideoMeta,
} from '../../types/editor';
import type { LayerEdgeDirection } from '../../lib/annotationTimeline';

interface EditorWorkspaceProps {
  video: VideoMeta;
  baseCrop: CropRect;
  currentTime: number;
  previewSourceTime: number;
  totalDuration: number;
  activeSceneCrop: CropRect | null;
  activeAnnotations: AnnotationModel[];
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  selectedTextAnnotation: TextAnnotation | null;
  selectedImageAnnotation: Extract<AnnotationModel, { kind: 'image' }> | null;
  hasActiveVideoSlice: boolean;
  cropEditMode: 'idle' | 'crop' | 'scene';
  effectiveEditCrop: CropRect | null;
  isSceneCropEditing: boolean;
  onStartCropEdit: () => void;
  onEditCropPreview: (crop: CropRect) => void;
  onConfirmCropEdit: () => void;
  onCancelCropEdit: () => void;
  onResetCropEdit: () => void;
  onCurrentTimeChange: (time: number) => void;
  onSelectedAnnotationIdChange: (annotationId: string | null) => void;
  onAnnotationPositionPreview: (annotationId: string, x: number, y: number) => void;
  onAnnotationImageResizePreview: (
    annotationId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  onAnnotationPositionCommit: () => void;
  onTextAnnotationChange: (annotationId: string, text: string) => void;
  onTextAnnotationStyleChange: (next: Partial<AnnotationTextStyle>) => void;
  onSelectedImageOpacityChange: (opacity: number) => void;
  hasSelectedAnnotationLayerOverlap: boolean;
  canBringSelectedAnnotationToFront: boolean;
  canSendSelectedAnnotationToBack: boolean;
  onMoveSelectedAnnotationLayer: (direction: LayerEdgeDirection) => void;
  onDeleteSelectedAnnotation: () => void;
  slices: SliceModel[];
  annotations: AnnotationModel[];
  canUndo: boolean;
  canRedo: boolean;
  onSelectedSliceIdChange: (sliceId: string | null) => void;
  onSceneCropToggle: () => void;
  onSlicesPreview: (slices: SliceModel[]) => void;
  onSlicesCommit: (slices: SliceModel[], selectedSliceId?: string | null) => void;
  onAnnotationsPreview: (annotations: AnnotationModel[]) => void;
  onAnnotationsCommit: (annotations: AnnotationModel[], selectedAnnotationId?: string | null) => void;
  onCreateTextAnnotation: () => void;
  onCreateImageAnnotation: (file: File) => void;
  outputAspectRatio: number;
  onUndo: () => void;
  onRedo: () => void;
  exportSettings: ExportSettings;
  exportRuntimeStatus: 'idle' | 'loading' | 'ready' | 'error';
  exportRuntimeError: string | null;
  isExporting: boolean;
  isCancelling: boolean;
  exportProgress: number | null;
  exportProgressLabel: string | null;
  exportError: string | null;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
  onExport: () => void;
  onCancelExport: () => void;
}

export default function EditorWorkspace({
  video,
  baseCrop,
  currentTime,
  previewSourceTime,
  totalDuration,
  activeSceneCrop,
  activeAnnotations,
  selectedSliceId,
  selectedAnnotationId,
  selectedTextAnnotation,
  selectedImageAnnotation,
  hasActiveVideoSlice,
  cropEditMode,
  effectiveEditCrop,
  isSceneCropEditing,
  onStartCropEdit,
  onEditCropPreview,
  onConfirmCropEdit,
  onCancelCropEdit,
  onResetCropEdit,
  onCurrentTimeChange,
  onSelectedAnnotationIdChange,
  onAnnotationPositionPreview,
  onAnnotationImageResizePreview,
  onAnnotationPositionCommit,
  onTextAnnotationChange,
  onTextAnnotationStyleChange,
  onSelectedImageOpacityChange,
  hasSelectedAnnotationLayerOverlap,
  canBringSelectedAnnotationToFront,
  canSendSelectedAnnotationToBack,
  onMoveSelectedAnnotationLayer,
  onDeleteSelectedAnnotation,
  slices,
  annotations,
  canUndo,
  canRedo,
  onSelectedSliceIdChange,
  onSceneCropToggle,
  onSlicesPreview,
  onSlicesCommit,
  onAnnotationsPreview,
  onAnnotationsCommit,
  onCreateTextAnnotation,
  onCreateImageAnnotation,
  outputAspectRatio,
  onUndo,
  onRedo,
  exportSettings,
  exportRuntimeStatus,
  exportRuntimeError,
  isExporting,
  isCancelling,
  exportProgress,
  exportProgressLabel,
  exportError,
  onChangeExportSettings,
  onExport,
  onCancelExport,
}: EditorWorkspaceProps) {
  return (
    <>
      <main className="fixed inset-x-0 bottom-0 top-16 z-10 overflow-hidden lg:right-[23rem]">
        <Group orientation="vertical" className="h-full min-h-0">
          <Panel defaultSize="52%" minSize="12rem" className="min-h-0">
            <section className="relative h-full min-h-0 px-1 pt-1 lg:pr-1">
              <CanvasPreview
                video={video}
                fileName={video.file.name}
                currentTime={currentTime}
                sourceTime={previewSourceTime}
                totalDuration={totalDuration}
                baseCrop={baseCrop}
                activeSceneCrop={activeSceneCrop}
                activeAnnotations={activeAnnotations}
                selectedAnnotationId={selectedAnnotationId}
                selectedTextAnnotation={selectedTextAnnotation}
                selectedImageAnnotation={selectedImageAnnotation}
                hasActiveVideoSlice={hasActiveVideoSlice}
                editMode={cropEditMode}
                editCrop={effectiveEditCrop}
                onStartCrop={onStartCropEdit}
                onEditCropPreview={onEditCropPreview}
                onConfirmEdit={onConfirmCropEdit}
                onCancelEdit={onCancelCropEdit}
                onResetEdit={onResetCropEdit}
                onCurrentTimeChange={onCurrentTimeChange}
                onSelectedAnnotationIdChange={onSelectedAnnotationIdChange}
                onAnnotationPositionPreview={onAnnotationPositionPreview}
                onAnnotationImageResizePreview={onAnnotationImageResizePreview}
                onAnnotationPositionCommit={onAnnotationPositionCommit}
                onTextAnnotationChange={onTextAnnotationChange}
                onTextAnnotationStyleChange={onTextAnnotationStyleChange}
                onSelectedImageOpacityChange={onSelectedImageOpacityChange}
                hasSelectedAnnotationLayerOverlap={hasSelectedAnnotationLayerOverlap}
                canBringSelectedAnnotationToFront={canBringSelectedAnnotationToFront}
                canSendSelectedAnnotationToBack={canSendSelectedAnnotationToBack}
                onMoveSelectedAnnotationLayer={onMoveSelectedAnnotationLayer}
                onDeleteSelectedAnnotation={onDeleteSelectedAnnotation}
                outputHeight={exportSettings.height}
                className="h-full"
                fillHeight
              />
            </section>
          </Panel>

          <Separator className="group relative mx-1 my-0.5 h-4 shrink-0 lg:mr-1">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-800/90 transition group-hover:bg-cyan-400/60" />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900 transition group-hover:border-cyan-400/60 group-hover:bg-slate-800" />
          </Separator>

          <Panel defaultSize="48%" minSize="16rem" className="min-h-0">
            <div className="h-full min-h-0 px-0.5 pb-[calc(env(safe-area-inset-bottom)+2px)] pt-0 lg:pr-1">
              <SliceEditorTimeline
                video={video}
                slices={slices}
                annotations={annotations}
                currentTime={currentTime}
                selectedSliceId={selectedSliceId}
                selectedAnnotationId={selectedAnnotationId}
                canStartSceneCrop={slices.length > 0}
                isSceneCropEditing={isSceneCropEditing}
                canUndo={canUndo}
                canRedo={canRedo}
                onCurrentTimeChange={onCurrentTimeChange}
                onSelectedSliceIdChange={onSelectedSliceIdChange}
                onSelectedAnnotationIdChange={onSelectedAnnotationIdChange}
                onSceneCropToggle={onSceneCropToggle}
                onSlicesPreview={onSlicesPreview}
                onSlicesCommit={onSlicesCommit}
                onAnnotationsPreview={onAnnotationsPreview}
                onAnnotationsCommit={onAnnotationsCommit}
                onCreateTextAnnotation={onCreateTextAnnotation}
                onCreateImageAnnotation={onCreateImageAnnotation}
                baseCrop={baseCrop}
                outputAspectRatio={outputAspectRatio}
                onUndo={onUndo}
                onRedo={onRedo}
                className="h-full"
                fillHeight
              />
            </div>
          </Panel>
        </Group>
      </main>

      <aside className="fixed bottom-0 right-0 top-16 z-20 hidden overflow-hidden border-l border-slate-800/80 bg-slate-950/30 backdrop-blur lg:block lg:w-[23rem]">
        <div className="h-full overflow-y-auto px-2 py-1">
          <PropertyPanel
            baseCrop={baseCrop}
            exportSettings={exportSettings}
            exportRuntimeStatus={exportRuntimeStatus}
            exportRuntimeError={exportRuntimeError}
            isExporting={isExporting}
            isCancelling={isCancelling}
            exportProgress={exportProgress}
            exportProgressLabel={exportProgressLabel}
            exportError={exportError}
            onChangeExportSettings={onChangeExportSettings}
            onExport={onExport}
            onCancelExport={onCancelExport}
            className="min-h-full border-none bg-transparent p-0 shadow-none rounded-none lg:w-full"
          />
        </div>
      </aside>
    </>
  );
}
