import { createCropActions } from './editor-store-actions/cropActions';
import { createHistoryActions } from './editor-store-actions/historyActions';
import { createTimelineActions } from './editor-store-actions/timelineActions';
import type { EditorStoreActions, EditorStoreGet, EditorStoreSet } from './editor-store-actions/types';
import { createVideoSelectionActions } from './editor-store-actions/videoSelectionActions';

export function createEditorStoreActions(set: EditorStoreSet, get: EditorStoreGet): EditorStoreActions {
  return {
    ...createVideoSelectionActions(set, get),
    ...createTimelineActions(set),
    ...createCropActions(set),
    ...createHistoryActions(set),
  };
}
