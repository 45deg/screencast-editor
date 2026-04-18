import { useEffect, useState } from 'react';

import { captureVideoThumbnail } from '../../lib/videoThumbnail';
import type { CropRect, DerivedSlice } from '../../types/editor';

interface UseSliceEditorThumbnailsArgs {
  slicesWithPos: DerivedSlice[];
  videoObjectUrl: string;
  baseCrop: CropRect;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export function useSliceEditorThumbnails({
  slicesWithPos,
  videoObjectUrl,
  baseCrop,
  thumbnailWidth,
  thumbnailHeight,
}: UseSliceEditorThumbnailsArgs) {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const generateThumbnails = async () => {
      await Promise.resolve();

      if (cancelled) {
        return;
      }

      setThumbnailUrls({});
      const nextThumbnailUrls: Record<string, string> = {};

      for (const slice of slicesWithPos) {
        try {
          const thumbnailUrl = await captureVideoThumbnail({
            videoUrl: videoObjectUrl,
            time: slice.sourceStart,
            width: thumbnailWidth,
            height: thumbnailHeight,
            baseCrop,
            sceneCrop: slice.crop,
          });

          if (cancelled) {
            return;
          }

          nextThumbnailUrls[slice.id] = thumbnailUrl;
          setThumbnailUrls({ ...nextThumbnailUrls });
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve());
          });
        } catch {
          if (cancelled) {
            return;
          }
        }
      }
    };

    void generateThumbnails();

    return () => {
      cancelled = true;
    };
  }, [baseCrop, slicesWithPos, thumbnailHeight, thumbnailWidth, videoObjectUrl]);

  return thumbnailUrls;
}
