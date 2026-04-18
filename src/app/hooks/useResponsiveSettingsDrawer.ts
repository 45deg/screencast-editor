import { useEffect, useState } from 'react';

interface UseResponsiveSettingsDrawerArgs {
  hasVideo: boolean;
}

export function useResponsiveSettingsDrawer({ hasVideo }: UseResponsiveSettingsDrawerArgs) {
  const [isMobileSettingsDrawerOpen, setIsMobileSettingsDrawerOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    if (!hasVideo) {
      setIsMobileSettingsDrawerOpen(false);
    }
  }, [hasVideo]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = () => {
      setIsDesktopViewport(mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (isDesktopViewport && isMobileSettingsDrawerOpen) {
      setIsMobileSettingsDrawerOpen(false);
    }
  }, [isDesktopViewport, isMobileSettingsDrawerOpen]);

  return {
    isMobileSettingsDrawerOpen,
    setIsMobileSettingsDrawerOpen,
    isDesktopViewport,
  };
}
