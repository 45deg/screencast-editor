import {
  cloneAnnotations,
  cloneCrop,
  cloneSlices,
  type AnnotationModel,
  type CropRect,
  type EditorSnapshot,
  type ExportSettings,
  type SliceModel,
} from '../types/editor';

const DEFAULT_EXPORT_SETTINGS_VALUE: ExportSettings = {
  format: 'mp4',
  width: 640,
  height: 360,
  keepAspectRatio: true,
  mp4Fps: 30,
  mp4Preset: 'medium',
};

export const MIN_SLICE_DURATION = 0.5;

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  ...DEFAULT_EXPORT_SETTINGS_VALUE,
};

interface SnapshotSource {
  slices: SliceModel[];
  annotations: AnnotationModel[];
  globalCrop: CropRect | null;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
}

export function snapshotFromState(state: SnapshotSource): EditorSnapshot {
  return {
    slices: cloneSlices(state.slices),
    annotations: cloneAnnotations(state.annotations),
    globalCrop: cloneCrop(state.globalCrop),
    selectedSliceId: state.selectedSliceId,
    selectedAnnotationId: state.selectedAnnotationId,
  };
}

export function normalizeSelectedSliceId(selectedSliceId: string | null, slices: SliceModel[]): string | null {
  if (!selectedSliceId) {
    return null;
  }

  return slices.some((slice) => slice.id === selectedSliceId) ? selectedSliceId : null;
}

export function normalizeSelectedAnnotationId(
  selectedAnnotationId: string | null,
  annotations: AnnotationModel[],
): string | null {
  if (!selectedAnnotationId) {
    return null;
  }

  return annotations.some((annotation) => annotation.id === selectedAnnotationId)
    ? selectedAnnotationId
    : null;
}
