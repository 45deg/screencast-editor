import { useEffect, useMemo, useRef, useState } from 'react';

import { captureVideoThumbnail } from '../../lib/videoThumbnail';
import type { CropRect, DerivedSlice, VideoMeta } from '../../types/editor';

interface UseSliceEditorThumbnailsArgs {
  slicesWithPos: DerivedSlice[];
  sources: VideoMeta[];
  baseCrop: CropRect | null;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export function useSliceEditorThumbnails({
  slicesWithPos,
  sources,
  baseCrop,
  thumbnailWidth,
  thumbnailHeight,
}: UseSliceEditorThumbnailsArgs) {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const cacheRef = useRef<Map<string, string>>(new Map());
  const sourcesById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const thumbnailDescriptors = useMemo(
    () =>
      slicesWithPos.map((slice) => ({
        id: slice.id,
        sourceId: slice.sourceId,
        sourceStart: slice.sourceStart,
        crop: slice.crop,
      })),
    [slicesWithPos],
  );

  const generationKey = useMemo(() => {
    const serializeCrop = (crop: CropRect | null) => (crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : 'none');

    return JSON.stringify({
      thumbnailWidth,
      thumbnailHeight,
      baseCrop: serializeCrop(baseCrop),
      slices: thumbnailDescriptors.map((slice) => ({
        id: slice.id,
        sourceId: slice.sourceId,
        sourceStart: slice.sourceStart,
        crop: serializeCrop(slice.crop),
      })),
      sources: sources.map((source) => ({
        id: source.id,
        objectUrl: source.objectUrl,
      })),
    });
  }, [baseCrop, sources, thumbnailDescriptors, thumbnailHeight, thumbnailWidth]);

  useEffect(() => {
    let cancelled = false;

    const generateThumbnails = async () => {
      await Promise.resolve();

      if (cancelled) {
        return;
      }

      const serializeCrop = (crop: CropRect | null) => (crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : 'none');
      const buildCacheKey = (source: VideoMeta, sourceStart: number, crop: CropRect | null) =>
        `${source.objectUrl}|${thumbnailWidth}|${thumbnailHeight}|${serializeCrop(baseCrop)}|${sourceStart}|${serializeCrop(crop)}`;
      const nextThumbnailUrls: Record<string, string> = {};
      const missingDescriptors: Array<(typeof thumbnailDescriptors)[number] & { cacheKey: string; source: VideoMeta }> = [];

      for (const slice of thumbnailDescriptors) {
        const source = sourcesById.get(slice.sourceId);
        if (!source) {
          continue;
        }

        const cacheKey = buildCacheKey(source, slice.sourceStart, slice.crop);
        const cachedThumbnailUrl = cacheRef.current.get(cacheKey);

        if (cachedThumbnailUrl) {
          nextThumbnailUrls[slice.id] = cachedThumbnailUrl;
          continue;
        }

        missingDescriptors.push({ ...slice, cacheKey, source });
      }

      setThumbnailUrls(nextThumbnailUrls);

      for (const slice of missingDescriptors) {
        try {
          const thumbnailUrl = await captureVideoThumbnail({
            videoUrl: slice.source.objectUrl,
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
  }, [baseCrop, generationKey, sourcesById, thumbnailDescriptors, thumbnailHeight, thumbnailWidth]);

  return thumbnailUrls;
}
