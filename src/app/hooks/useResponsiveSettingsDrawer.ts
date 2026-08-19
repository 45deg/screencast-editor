import { useCallback, useEffect, useState } from 'react';

interface UseResponsiveSettingsDrawerArgs {
  hasVideo: boolean;
  videoSessionId: string | undefined;
}

interface MobileDrawerState {
  videoSessionId: string | undefined;
  open: boolean;
}

export function useResponsiveSettingsDrawer({ hasVideo, videoSessionId }: UseResponsiveSettingsDrawerArgs) {
  const [mobileDrawerState, setMobileDrawerState] = useState<MobileDrawerState>({
    videoSessionId,
    open: false,
  });
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const isMobileSettingsDrawerOpen =
    hasVideo && mobileDrawerState.videoSessionId === videoSessionId && mobileDrawerState.open;
  const setIsMobileSettingsDrawerOpen = useCallback(
    (open: boolean) => {
      setMobileDrawerState({ videoSessionId, open });
    },
    [videoSessionId],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = () => {
      setIsDesktopViewport(mediaQuery.matches);
      if (mediaQuery.matches) {
        setMobileDrawerState((current) => (current.open ? { ...current, open: false } : current));
      }
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return {
    isMobileSettingsDrawerOpen,
    setIsMobileSettingsDrawerOpen,
    isDesktopViewport,
  };
}
