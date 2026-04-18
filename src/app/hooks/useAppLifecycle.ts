import { useEffect } from 'react';

import { revokeAnnotationImageUrls } from '../appUtils';
import { revokeVideoObjectUrl } from '../../lib/video';
import { useEditorStore } from '../../store/editorStore';
import type { CropRect, ExportSettings } from '../../types/editor';

interface UseAppLifecycleArgs {
  videoObjectUrl: string | undefined;
  resetPendingAnnotationPreview: () => void;
  baseCrop: CropRect | null;
  exportSettings: ExportSettings;
  updateExportSettings: (next: Partial<ExportSettings>) => void;
}

export function useAppLifecycle({
  videoObjectUrl,
  resetPendingAnnotationPreview,
  baseCrop,
  exportSettings,
  updateExportSettings,
}: UseAppLifecycleArgs) {
  useEffect(() => {
    resetPendingAnnotationPreview();
  }, [resetPendingAnnotationPreview, videoObjectUrl]);

  useEffect(() => {
    if (!baseCrop) {
      return;
    }

    const nextHeight = Math.max(
      64,
      Math.min(4096, Math.round((exportSettings.width * baseCrop.h) / Math.max(1, baseCrop.w))),
    );
    if (nextHeight !== exportSettings.height) {
      updateExportSettings({ height: nextHeight, keepAspectRatio: true });
    }
  }, [baseCrop, exportSettings.height, exportSettings.width, updateExportSettings]);

  useEffect(() => {
    return () => {
      const state = useEditorStore.getState();
      revokeVideoObjectUrl(state.video);
      revokeAnnotationImageUrls(state.annotations);
    };
  }, []);
}
