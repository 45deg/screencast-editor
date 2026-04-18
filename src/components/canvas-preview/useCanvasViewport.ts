import { useCallback, useEffect, useRef, useState } from 'react';

import { measureViewport, type ViewportInfo } from './math';
import type { VideoMeta } from '../../types/editor';

interface FrameSize {
  width: number;
  height: number;
}

interface UseCanvasViewportArgs {
  video: VideoMeta;
  sourceTime: number;
  hasActiveVideoSlice: boolean;
  isEditing: boolean;
}

export function useCanvasViewport({
  video,
  sourceTime,
  hasActiveVideoSlice,
  isEditing,
}: UseCanvasViewportArgs) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportInfo>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    width: video.width,
    height: video.height,
  });
  const [frameSize, setFrameSize] = useState<FrameSize>({ width: 1, height: 1 });

  const syncVideoTime = useCallback(
    (element: HTMLVideoElement | null) => {
      if (!element) {
        return;
      }

      if (Math.abs(element.currentTime - sourceTime) > 0.04) {
        element.currentTime = Math.max(0, Math.min(video.duration || 0, sourceTime));
      }
    },
    [sourceTime, video.duration],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      setViewport(measureViewport(element, video));
      const rect = element.getBoundingClientRect();
      setFrameSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();

    return () => {
      observer.disconnect();
    };
  }, [video]);

  useEffect(() => {
    syncVideoTime(videoRef.current);
  }, [hasActiveVideoSlice, isEditing, syncVideoTime, video.objectUrl]);

  const handleVideoLoadedMetadata = useCallback(() => {
    const host = viewportRef.current;
    if (host) {
      setViewport(measureViewport(host, video));
    }
    syncVideoTime(videoRef.current);
  }, [syncVideoTime, video]);

  return {
    videoRef,
    viewportRef,
    viewport,
    frameSize,
    syncVideoTime,
    handleVideoLoadedMetadata,
  };
}
