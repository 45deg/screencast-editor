import { Download, FileVideo, MonitorUp, Scissors, Type } from 'lucide-react';
import VideoDropzone from '../../components/VideoDropzone';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  const featureKeys = ['import', 'capture', 'trim', 'annotations', 'export'] as const;
  const featureIcons = {
    import: FileVideo,
    capture: MonitorUp,
    trim: Scissors,
    annotations: Type,
    export: Download,
  } as const;

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] items-center justify-center px-4 pb-10 pt-20 sm:px-6">
      <div className="w-full max-w-6xl space-y-8">
        <section className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{t('landing.title')}</h1>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{t('landing.description')}</p>
          </div>
        </section>

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

        <section className="mx-auto max-w-3xl space-y-6 text-center">
          <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-400/25 bg-slate-950/75 px-5 py-4 text-left shadow-xl shadow-emerald-950/20">
            <p className="text-sm font-semibold text-emerald-200">{t('landing.privacyTitle')}</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{t('landing.privacyDescription')}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {featureKeys.map((featureKey) => (
            (() => {
              const Icon = featureIcons[featureKey];
              return (
                <article
                  key={featureKey}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-5 shadow-lg shadow-slate-950/20"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300">
                      <Icon size={14} strokeWidth={2} />
                    </span>
                    <p className="text-sm font-semibold text-white">{t(`landing.features.${featureKey}.title`)}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{t(`landing.features.${featureKey}.description`)}</p>
                </article>
              );
            })()
          ))}
        </section>
      </div>
    </main>
  );
}
