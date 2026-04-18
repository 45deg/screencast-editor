import { create } from 'zustand';

import {
  cloneAnnotations,
  cloneCrop,
  cloneSlices,
  cropEquals,
  deriveSlices,
  type AnnotationModel,
  type CropRect,
  type EditorSnapshot,
  type ExportSettings,
  type SliceModel,
  type VideoMeta,
  getTotalDuration,
} from '../types/editor';

const MIN_SLICE_DURATION = 0.5;

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'gif',
  width: 640,
  height: 360,
  keepAspectRatio: true,
  gifFps: 10,
  paletteMode: 'global',
  dither: 'none',
  mp4Fps: 30,
  mp4Preset: 'medium',
};

type FfmpegStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EditorStoreState {
  video: VideoMeta | null;
  slices: SliceModel[];
  annotations: AnnotationModel[];
  currentTime: number;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  ffmpegStatus: FfmpegStatus;
  ffmpegError: string | null;
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
  setFfmpegStatus: (status: FfmpegStatus, error?: string | null) => void;
  undo: () => void;
  redo: () => void;
}

function snapshotFromState(
  state: Pick<EditorStoreState, 'slices' | 'annotations' | 'globalCrop' | 'selectedSliceId' | 'selectedAnnotationId'>,
): EditorSnapshot {
  return {
    slices: cloneSlices(state.slices),
    annotations: cloneAnnotations(state.annotations),
    globalCrop: cloneCrop(state.globalCrop),
    selectedSliceId: state.selectedSliceId,
    selectedAnnotationId: state.selectedAnnotationId,
  };
}

function normalizeSelectedSliceId(selectedSliceId: string | null, slices: SliceModel[]): string | null {
  if (!selectedSliceId) {
    return null;
  }

  return slices.some((slice) => slice.id === selectedSliceId) ? selectedSliceId : null;
}

function normalizeSelectedAnnotationId(
  selectedAnnotationId: string | null,
  annotations: AnnotationModel[],
): string | null {
  if (!selectedAnnotationId) {
    return null;
  }

  return annotations.some((annotation) => annotation.id === selectedAnnotationId) ? selectedAnnotationId : null;
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
  ffmpegStatus: 'idle',
  ffmpegError: null,
  past: [],
  future: [],

  setVideo: (video) => {
    const initialWidth = Math.max(1, Math.round(video.width));
    const initialHeight = Math.max(1, Math.round(video.height));

    const initialSlice: SliceModel = {
      id: crypto.randomUUID(),
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: video.duration,
      duration: video.duration,
      crop: null,
    };

    set({
      video,
      slices: [initialSlice],
      annotations: [],
      currentTime: 0,
      selectedSliceId: null,
      selectedAnnotationId: null,
      globalCrop: null,
      exportSettings: {
        ...DEFAULT_EXPORT_SETTINGS,
        width: initialWidth,
        height: initialHeight,
      },
      ffmpegStatus: 'idle',
      ffmpegError: null,
      past: [],
      future: [],
    });
  },

  clearVideo: () => {
    set({
      video: null,
      slices: [],
      annotations: [],
      currentTime: 0,
      selectedSliceId: null,
      selectedAnnotationId: null,
      globalCrop: null,
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      ffmpegStatus: 'idle',
      ffmpegError: null,
      past: [],
      future: [],
    });
  },

  setCurrentTime: (time) => {
    const state = get();
    const totalDuration = getTotalDuration(state.slices, state.annotations);
    const clamped = Math.max(0, Math.min(totalDuration, time));
    set({ currentTime: clamped });
  },

  setSelectedSliceId: (sliceId) => {
    const nextId = normalizeSelectedSliceId(sliceId, get().slices);
    set({
      selectedSliceId: nextId,
      selectedAnnotationId: nextId ? null : get().selectedAnnotationId,
    });
  },

  setSelectedAnnotationId: (annotationId) => {
    const nextId = normalizeSelectedAnnotationId(annotationId, get().annotations);
    set({
      selectedAnnotationId: nextId,
      selectedSliceId: nextId ? null : get().selectedSliceId,
    });
  },

  replaceSlicesPreview: (slices) => {
    const nextSlices = cloneSlices(slices);
    set((state) => ({
      slices: nextSlices,
      currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
      selectedSliceId: normalizeSelectedSliceId(state.selectedSliceId, nextSlices),
    }));
  },

  replaceSlicesCommit: (slices, selectedSliceId) => {
    const nextSlices = cloneSlices(slices);
    set((state) => ({
      past: [...state.past, snapshotFromState(state)],
      future: [],
      slices: nextSlices,
      currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
      selectedSliceId: normalizeSelectedSliceId(
        selectedSliceId === undefined ? state.selectedSliceId : selectedSliceId,
        nextSlices,
      ),
      selectedAnnotationId:
        selectedSliceId === undefined ? state.selectedAnnotationId : selectedSliceId ? null : state.selectedAnnotationId,
    }));
  },

  replaceAnnotationsPreview: (annotations) => {
    const nextAnnotations = cloneAnnotations(annotations);
    set((state) => ({
      annotations: nextAnnotations,
      currentTime: Math.min(state.currentTime, getTotalDuration(state.slices, nextAnnotations)),
      selectedAnnotationId: normalizeSelectedAnnotationId(state.selectedAnnotationId, nextAnnotations),
    }));
  },

  replaceAnnotationsCommit: (annotations, selectedAnnotationId) => {
    const nextAnnotations = cloneAnnotations(annotations);
    set((state) => ({
      past: [...state.past, snapshotFromState(state)],
      future: [],
      annotations: nextAnnotations,
      currentTime: Math.min(state.currentTime, getTotalDuration(state.slices, nextAnnotations)),
      selectedAnnotationId: normalizeSelectedAnnotationId(
        selectedAnnotationId === undefined ? state.selectedAnnotationId : selectedAnnotationId,
        nextAnnotations,
      ),
      selectedSliceId:
        selectedAnnotationId === undefined
          ? state.selectedSliceId
          : selectedAnnotationId
            ? null
            : state.selectedSliceId,
    }));
  },

  cutAtCurrentTime: () => {
    set((state) => {
      const withPos = deriveSlices(state.slices);
      const target = withPos.find((slice) => state.currentTime > slice.start && state.currentTime < slice.end);

      if (!target) {
        return state;
      }

      const targetIndex = state.slices.findIndex((slice) => slice.id === target.id);
      if (targetIndex === -1) {
        return state;
      }

      const leftDuration = state.currentTime - target.start;
      const rightDuration = target.end - state.currentTime;

      if (leftDuration < MIN_SLICE_DURATION || rightDuration < MIN_SLICE_DURATION) {
        return state;
      }

      const ratio = leftDuration / target.duration;
      const splitSource = target.sourceStart + target.sourceDuration * ratio;

      const leftSlice: SliceModel = {
        id: crypto.randomUUID(),
        timelineStart: target.start,
        sourceStart: target.sourceStart,
        sourceEnd: splitSource,
        duration: leftDuration,
        crop: cloneCrop(target.crop),
      };
      const rightSlice: SliceModel = {
        id: crypto.randomUUID(),
        timelineStart: state.currentTime,
        sourceStart: splitSource,
        sourceEnd: target.sourceEnd,
        duration: rightDuration,
        crop: cloneCrop(target.crop),
      };

      const nextSlices = cloneSlices(state.slices);
      nextSlices.splice(targetIndex, 1, leftSlice, rightSlice);

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        slices: nextSlices,
        selectedSliceId: rightSlice.id,
        selectedAnnotationId: null,
      };
    });
  },

  deleteSelectedSlice: () => {
    set((state) => {
      if (!state.selectedSliceId) {
        return state;
      }

      const nextSlices = state.slices.filter((slice) => slice.id !== state.selectedSliceId);
      if (nextSlices.length === state.slices.length) {
        return state;
      }

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        slices: cloneSlices(nextSlices),
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
        selectedSliceId: null,
      };
    });
  },

  deleteSelectedAnnotation: () => {
    set((state) => {
      if (!state.selectedAnnotationId) {
        return state;
      }

      const nextAnnotations = state.annotations.filter((annotation) => annotation.id !== state.selectedAnnotationId);
      if (nextAnnotations.length === state.annotations.length) {
        return state;
      }

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        annotations: cloneAnnotations(nextAnnotations),
        currentTime: Math.min(state.currentTime, getTotalDuration(state.slices, nextAnnotations)),
        selectedAnnotationId: null,
      };
    });
  },

  setSliceSpeedCommit: (sliceId, speed) => {
    if (!Number.isFinite(speed) || speed <= 0) {
      return;
    }

    set((state) => {
      const nextSlices = cloneSlices(state.slices).map((slice) => {
        if (slice.id !== sliceId) {
          return slice;
        }

        const sourceDuration = slice.sourceEnd - slice.sourceStart;
        return {
          ...slice,
          duration: Math.max(MIN_SLICE_DURATION, sourceDuration / speed),
        };
      });

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        slices: nextSlices,
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
      };
    });
  },

  setGlobalCropPreview: (crop) => {
    set({ globalCrop: cloneCrop(crop) });
  },

  setGlobalCropCommit: (crop) => {
    set((state) => {
      if (cropEquals(state.globalCrop, crop)) {
        return state;
      }

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        globalCrop: cloneCrop(crop),
      };
    });
  },

  setSliceCropPreview: (sliceId, crop) => {
    set((state) => {
      const targetSlice = state.slices.find((slice) => slice.id === sliceId);
      if (!targetSlice || cropEquals(targetSlice.crop, crop)) {
        return state;
      }

      const nextSlices = cloneSlices(state.slices).map((slice) => {
        if (slice.id !== sliceId) {
          return slice;
        }

        return {
          ...slice,
          crop: cloneCrop(crop),
        };
      });

      return { slices: nextSlices };
    });
  },

  setSliceCropCommit: (sliceId, crop) => {
    set((state) => {
      const currentSlice = state.slices.find((slice) => slice.id === sliceId);
      if (!currentSlice || cropEquals(currentSlice.crop, crop)) {
        return state;
      }

      const nextSlices = cloneSlices(state.slices).map((slice) => {
        if (slice.id !== sliceId) {
          return slice;
        }

        return {
          ...slice,
          crop: cloneCrop(crop),
        };
      });

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        slices: nextSlices,
      };
    });
  },

  updateExportSettings: (next) => {
    set((state) => ({
      exportSettings: {
        ...state.exportSettings,
        ...next,
      },
    }));
  },

  setFfmpegStatus: (status, error = null) => {
    set({ ffmpegStatus: status, ffmpegError: error });
  },

  undo: () => {
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) {
        return state;
      }

      const nextSlices = cloneSlices(previous.slices);
      const nextAnnotations = cloneAnnotations(previous.annotations);

      return {
        past: state.past.slice(0, -1),
        future: [snapshotFromState(state), ...state.future],
        slices: nextSlices,
        annotations: nextAnnotations,
        globalCrop: cloneCrop(previous.globalCrop),
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, nextAnnotations)),
        selectedSliceId: normalizeSelectedSliceId(previous.selectedSliceId, nextSlices),
        selectedAnnotationId: normalizeSelectedAnnotationId(previous.selectedAnnotationId, nextAnnotations),
      };
    });
  },

  redo: () => {
    set((state) => {
      const [nextSnapshot, ...restFuture] = state.future;
      if (!nextSnapshot) {
        return state;
      }

      const nextSlices = cloneSlices(nextSnapshot.slices);
      const nextAnnotations = cloneAnnotations(nextSnapshot.annotations);

      return {
        past: [...state.past, snapshotFromState(state)],
        future: restFuture,
        slices: nextSlices,
        annotations: nextAnnotations,
        globalCrop: cloneCrop(nextSnapshot.globalCrop),
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, nextAnnotations)),
        selectedSliceId: normalizeSelectedSliceId(nextSnapshot.selectedSliceId, nextSlices),
        selectedAnnotationId: normalizeSelectedAnnotationId(nextSnapshot.selectedAnnotationId, nextAnnotations),
      };
    });
  },
}));

export const editorConstants = {
  MIN_SLICE_DURATION,
};
