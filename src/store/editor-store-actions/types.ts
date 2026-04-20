import type { EditorStoreState } from '../editorStore';

export type EditorStoreSet = (
  partial:
    | EditorStoreState
    | Partial<EditorStoreState>
    | ((state: EditorStoreState) => EditorStoreState | Partial<EditorStoreState>),
) => void;

export type EditorStoreGet = () => EditorStoreState;

export type EditorStoreActions = Pick<
  EditorStoreState,
  | 'setVideo'
  | 'addVideoSource'
  | 'clearVideo'
  | 'setCurrentTime'
  | 'setSelectedSliceId'
  | 'setSelectedAnnotationId'
  | 'replaceSlicesPreview'
  | 'replaceSlicesCommit'
  | 'replaceAnnotationsPreview'
  | 'replaceAnnotationsCommit'
  | 'cutAtCurrentTime'
  | 'deleteSelectedSlice'
  | 'deleteSelectedAnnotation'
  | 'setSliceSpeedCommit'
  | 'setGlobalCropPreview'
  | 'setGlobalCropCommit'
  | 'setSliceCropPreview'
  | 'setSliceCropCommit'
  | 'updateExportSettings'
  | 'setExportRuntimeStatus'
  | 'undo'
  | 'redo'
>;

export type VideoSelectionActions = Pick<
  EditorStoreActions,
  'setVideo' | 'addVideoSource' | 'clearVideo' | 'setCurrentTime' | 'setSelectedSliceId' | 'setSelectedAnnotationId'
>;

export type TimelineActions = Pick<
  EditorStoreActions,
  | 'replaceSlicesPreview'
  | 'replaceSlicesCommit'
  | 'replaceAnnotationsPreview'
  | 'replaceAnnotationsCommit'
  | 'cutAtCurrentTime'
  | 'deleteSelectedSlice'
  | 'deleteSelectedAnnotation'
  | 'setSliceSpeedCommit'
  | 'updateExportSettings'
  | 'setExportRuntimeStatus'
>;

export type CropActions = Pick<
  EditorStoreActions,
  'setGlobalCropPreview' | 'setGlobalCropCommit' | 'setSliceCropPreview' | 'setSliceCropCommit'
>;

export type HistoryActions = Pick<EditorStoreActions, 'undo' | 'redo'>;
