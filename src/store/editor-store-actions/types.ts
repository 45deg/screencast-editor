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
  | 'setFfmpegStatus'
  | 'undo'
  | 'redo'
>;

export type VideoSelectionActions = Pick<
  EditorStoreActions,
  'setVideo' | 'clearVideo' | 'setCurrentTime' | 'setSelectedSliceId' | 'setSelectedAnnotationId'
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
  | 'setFfmpegStatus'
>;

export type CropActions = Pick<
  EditorStoreActions,
  'setGlobalCropPreview' | 'setGlobalCropCommit' | 'setSliceCropPreview' | 'setSliceCropCommit'
>;

export type HistoryActions = Pick<EditorStoreActions, 'undo' | 'redo'>;
