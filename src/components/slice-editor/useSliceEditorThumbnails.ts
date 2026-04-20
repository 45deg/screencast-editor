import { useEffect, useMemo, useRef, useState } from 'react';

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
  const cacheRef = useRef<Map<string, string>>(new Map());

  const thumbnailDescriptors = useMemo(
    () =>
      slicesWithPos.map((slice) => ({
        id: slice.id,
        sourceStart: slice.sourceStart,
        crop: slice.crop,
      })),
    [slicesWithPos],
  );

  const generationKey = useMemo(() => {
    const serializeCrop = (crop: CropRect | null) => (crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : 'none');

    return JSON.stringify({
      videoObjectUrl,
      thumbnailWidth,
      thumbnailHeight,
      baseCrop: serializeCrop(baseCrop),
      slices: thumbnailDescriptors.map((slice) => ({
        id: slice.id,
        sourceStart: slice.sourceStart,
        crop: serializeCrop(slice.crop),
      })),
    });
  }, [baseCrop, thumbnailDescriptors, thumbnailHeight, thumbnailWidth, videoObjectUrl]);

  useEffect(() => {
    let cancelled = false;

    const generateThumbnails = async () => {
      await Promise.resolve();

      if (cancelled) {
        return;
      }

      const serializeCrop = (crop: CropRect | null) => (crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : 'none');
      const buildCacheKey = (sourceStart: number, crop: CropRect | null) =>
        `${videoObjectUrl}|${thumbnailWidth}|${thumbnailHeight}|${serializeCrop(baseCrop)}|${sourceStart}|${serializeCrop(crop)}`;
      const nextThumbnailUrls: Record<string, string> = {};
      const missingDescriptors = [];

      for (const slice of thumbnailDescriptors) {
        const cacheKey = buildCacheKey(slice.sourceStart, slice.crop);
        const cachedThumbnailUrl = cacheRef.current.get(cacheKey);

        if (cachedThumbnailUrl) {
          nextThumbnailUrls[slice.id] = cachedThumbnailUrl;
          continue;
        }

        missingDescriptors.push({ ...slice, cacheKey });
      }

      setThumbnailUrls(nextThumbnailUrls);

      for (const slice of missingDescriptors) {
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

          cacheRef.current.set(slice.cacheKey, thumbnailUrl);
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
  }, [baseCrop, generationKey, thumbnailDescriptors, thumbnailHeight, thumbnailWidth, videoObjectUrl]);

  return thumbnailUrls;
}
