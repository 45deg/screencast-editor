import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCanvasPlaybackArgs {
  currentTime: number;
  totalDuration: number;
  isEditing: boolean;
  onCurrentTimeChange: (time: number) => void;
}

export function useCanvasPlayback({
  currentTime,
  totalDuration,
  isEditing,
  onCurrentTimeChange,
}: UseCanvasPlaybackArgs) {
  const animationFrameRef = useRef<number | null>(null);
  const timelineTimeRef = useRef(currentTime);
  const lastFrameTimeRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    timelineTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
      return;
    }

    const tick = (frameTime: number) => {
      const previousFrameTime = lastFrameTimeRef.current;
      lastFrameTimeRef.current = frameTime;

      if (previousFrameTime === null) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = (frameTime - previousFrameTime) / 1000;
      const nextTime = Math.min(totalDuration, timelineTimeRef.current + delta);
      timelineTimeRef.current = nextTime;
      onCurrentTimeChange(nextTime);

      if (nextTime >= totalDuration) {
        setIsPlaying(false);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [isPlaying, onCurrentTimeChange, totalDuration]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isEditing || totalDuration <= 0) {
      return;
    }

    if (!isPlaying && currentTime >= totalDuration) {
      timelineTimeRef.current = 0;
      onCurrentTimeChange(0);
    }

    setIsPlaying((value) => !value);
  }, [currentTime, isEditing, isPlaying, onCurrentTimeChange, totalDuration]);

  const handleRestart = useCallback(() => {
    timelineTimeRef.current = 0;
    onCurrentTimeChange(0);
    setIsPlaying(false);
  }, [onCurrentTimeChange]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    handleTogglePlay,
    handleRestart,
    stopPlayback,
  };
}
