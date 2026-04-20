import { useEffect, useRef } from 'react';

import { revokeAnnotationImageUrls, revokeVideoSourceUrls } from '../appUtils';
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
  const previousBaseCropRef = useRef<CropRect | null>(baseCrop);

  useEffect(() => {
    resetPendingAnnotationPreview();
  }, [resetPendingAnnotationPreview, videoObjectUrl]);

  useEffect(() => {
    if (!baseCrop) {
      previousBaseCropRef.current = baseCrop;
      return;
    }

    const previousBaseCrop = previousBaseCropRef.current;
    const cropChanged =
      !previousBaseCrop ||
      previousBaseCrop.x !== baseCrop.x ||
      previousBaseCrop.y !== baseCrop.y ||
      previousBaseCrop.w !== baseCrop.w ||
      previousBaseCrop.h !== baseCrop.h;

    if (cropChanged && previousBaseCrop) {
      const previousScale = exportSettings.width / Math.max(1, previousBaseCrop.w);
      const nextWidth = Math.max(64, Math.min(4096, Math.round(baseCrop.w * previousScale)));
      const nextHeight = Math.max(64, Math.min(4096, Math.round((nextWidth * baseCrop.h) / Math.max(1, baseCrop.w))));

      previousBaseCropRef.current = baseCrop;

      if (nextWidth !== exportSettings.width || nextHeight !== exportSettings.height) {
        updateExportSettings({
          width: nextWidth,
          height: nextHeight,
          keepAspectRatio: true,
        });
      }

      return;
    }

    previousBaseCropRef.current = baseCrop;

    const nextHeight = Math.max(64, Math.min(4096, Math.round((exportSettings.width * baseCrop.h) / Math.max(1, baseCrop.w))));
    if (nextHeight !== exportSettings.height) {
      updateExportSettings({ height: nextHeight, keepAspectRatio: true });
    }
  }, [baseCrop, exportSettings.height, exportSettings.width, updateExportSettings]);

  useEffect(() => {
    return () => {
      const state = useEditorStore.getState();
      revokeVideoSourceUrls(state.sources);
      revokeAnnotationImageUrls(state.annotations);
    };
  }, []);
}
