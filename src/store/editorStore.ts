import { create } from 'zustand';

import type {
  AnnotationModel,
  CropRect,
  EditorSnapshot,
  ExportSettings,
  SliceModel,
  VideoMeta,
} from '../types/editor';
import { createEditorStoreActions } from './editorStoreActions';
import { DEFAULT_EXPORT_SETTINGS, MIN_SLICE_DURATION } from './editorStoreHelpers';

export type ExportRuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EditorStoreState {
  video: VideoMeta | null;
  slices: SliceModel[];
  annotations: AnnotationModel[];
  currentTime: number;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  exportRuntimeStatus: ExportRuntimeStatus;
  exportRuntimeError: string | null;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  setVideo: (video: VideoMeta) => void;
  clearVideo: () => void;
  setCurrentTime: (time: number) => void;
  setSelectedSliceId: (sliceId: string | null) => void;
  setSelectedAnnotationId: (annotationId: string | null) => void;
  replaceSlicesPreview: (slices: SliceModel[]) => void;
  replaceSlicesCommit: (slices: SliceModel[], selectedSliceId?: string | null) => void;
  replaceAnnotationsPreview: (annotations: AnnotationModel[]) => void;
  replaceAnnotationsCommit: (annotations: AnnotationModel[], selectedAnnotationId?: string | null) => void;
  cutAtCurrentTime: () => void;
  deleteSelectedSlice: () => void;
  deleteSelectedAnnotation: () => void;
  setSliceSpeedCommit: (sliceId: string, speed: number) => void;
  setGlobalCropPreview: (crop: CropRect | null) => void;
  setGlobalCropCommit: (crop: CropRect | null) => void;
  setSliceCropPreview: (sliceId: string, crop: CropRect | null) => void;
  setSliceCropCommit: (sliceId: string, crop: CropRect | null) => void;
  updateExportSettings: (next: Partial<ExportSettings>) => void;
  setExportRuntimeStatus: (status: ExportRuntimeStatus, error?: string | null) => void;
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  video: null,
  slices: [],
  annotations: [],
  currentTime: 0,
  selectedSliceId: null,
  selectedAnnotationId: null,
  globalCrop: null,
  exportSettings: DEFAULT_EXPORT_SETTINGS,
  exportRuntimeStatus: 'idle',
  exportRuntimeError: null,
  past: [],
  future: [],
  ...createEditorStoreActions(set, get),
}));

export const editorConstants = {
  MIN_SLICE_DURATION,
};
