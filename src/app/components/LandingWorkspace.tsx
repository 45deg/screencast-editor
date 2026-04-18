import VideoDropzone from '../../components/VideoDropzone';

interface LandingWorkspaceProps {
  isImporting: boolean;
  isScreenCaptureProcessing: boolean;
  importError: string | null;
  supportsScreenCapture: boolean;
  isScreenCaptureStarting: boolean;
  isScreenCaptureRecording: boolean;
  onImportVideo: (file: File) => Promise<void>;
  onStartScreenCapture: () => Promise<void>;
  onStopScreenCapture: () => void;
}

export default function LandingWorkspace({
  isImporting,
  isScreenCaptureProcessing,
  importError,
  supportsScreenCapture,
  isScreenCaptureStarting,
  isScreenCaptureRecording,
  onImportVideo,
  onStartScreenCapture,
  onStopScreenCapture,
}: LandingWorkspaceProps) {
  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] items-center justify-center px-4 pb-6 pt-20 sm:px-6">
      <VideoDropzone
        onFileSelected={onImportVideo}
        isLoading={isImporting || isScreenCaptureProcessing}
        error={importError}
        mode="embedded"
        screenCapture={{
          isSupported: supportsScreenCapture,
          isStarting: isScreenCaptureStarting || isScreenCaptureProcessing,
          isRecording: isScreenCaptureRecording,
          onStart: onStartScreenCapture,
          onStop: onStopScreenCapture,
        }}
      />
    </main>
  );
}
