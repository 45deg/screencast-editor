import { useCallback, useRef, useState } from 'react';
import { MonitorUp, Square, Upload, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ScreenCaptureControls {
  isSupported: boolean;
  isStarting: boolean;
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

interface VideoDropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  mode?: 'fullscreen' | 'embedded';
  screenCapture?: ScreenCaptureControls;
}

export default function VideoDropzone({
  onFileSelected,
  isLoading,
  error,
  mode = 'fullscreen',
  screenCapture,
}: VideoDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isEmbedded = mode === 'embedded';
  const showScreenCapture = screenCapture?.isSupported ?? false;
  const isBusy = isLoading || screenCapture?.isStarting;

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) {
        return;
      }

      const firstVideo = Array.from(files).find((file) => file.type.startsWith('video/'));
      if (!firstVideo) {
        return;
      }

      onFileSelected(firstVideo);
    },
    [onFileSelected],
  );

  return (
    <section
      className={`relative flex items-center justify-center overflow-hidden ${
        isEmbedded ? 'min-h-[280px] rounded-xl border border-slate-800/80 bg-slate-950/70 p-6 shadow-xl' : 'min-h-screen px-6 py-10'
      }`}
    >
      <div className={`relative w-full ${isEmbedded ? 'mx-auto max-w-5xl' : 'mx-auto max-w-xl'}`}>
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {isLoading ? t('dropzone.loadingTitle') : t('dropzone.idleTitle')}
            </h1>
            <p className="text-sm leading-relaxed text-slate-400 sm:text-base">{t('dropzone.formats')}</p>
          </div>

          <div className={`grid gap-4 ${showScreenCapture ? 'md:grid-cols-2' : ''}`}>
            <button
              type="button"
              onClick={pickFile}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleFiles(event.dataTransfer.files);
              }}
              disabled={isBusy}
              className={`group relative w-full border border-dashed text-left transition ${
                isDragging
                  ? 'border-cyan-300 bg-cyan-300/10'
                  : 'border-slate-700/80 bg-slate-900/50 hover:border-cyan-400/60 hover:bg-slate-900/70'
              } ${isBusy ? 'cursor-wait opacity-80' : 'cursor-pointer'} ${isEmbedded ? 'rounded-xl p-8 sm:p-10' : 'rounded-2xl p-10 sm:p-14'}`}
            >
              <div className="relative flex flex-col items-center justify-center gap-5 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-950/80 text-slate-200 shadow-inner">
                  <Video size={32} className="text-slate-300" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                    {t('dropzone.selectVideos')}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-400">{t('dropzone.openFromDisk')}</p>
                </div>

                <div className="mt-1 inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-sm transition group-hover:border-cyan-400/50 group-hover:bg-slate-900">
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Upload size={16} className="text-cyan-300" />
                      {t('dropzone.readingFile')}
                    </span>
                  ) : (
                    t('dropzone.selectVideos')
                  )}
                </div>
              </div>
            </button>

            {showScreenCapture ? (
              <button
                type="button"
                onClick={screenCapture?.isRecording ? screenCapture.onStop : screenCapture?.onStart}
                disabled={isLoading || screenCapture?.isStarting}
                className={`group relative w-full border text-left transition ${
                  screenCapture?.isRecording
                    ? 'border-rose-400/70 bg-rose-500/10 hover:bg-rose-500/16'
                    : 'border-slate-700/80 bg-slate-900/50 hover:border-emerald-400/60 hover:bg-slate-900/70'
                } ${isLoading || screenCapture?.isStarting ? 'cursor-wait opacity-80' : 'cursor-pointer'} ${isEmbedded ? 'rounded-xl p-8 sm:p-10' : 'rounded-2xl p-10 sm:p-14'}`}
              >
                <div className="relative flex flex-col items-center justify-center gap-5 text-center">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-full border shadow-inner ${
                      screenCapture?.isRecording
                        ? 'border-rose-300/50 bg-rose-500/10 text-rose-100'
                        : 'border-slate-700 bg-slate-950/80 text-slate-200'
                    }`}
                  >
                    {screenCapture?.isRecording ? (
                      <Square size={28} className="fill-current text-rose-300" />
                    ) : (
                      <MonitorUp size={32} className="text-slate-300" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                      {screenCapture?.isRecording ? t('dropzone.recordingTitle') : t('dropzone.captureTitle')}
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {screenCapture?.isRecording ? t('dropzone.recordingDescription') : t('dropzone.captureDescription')}
                    </p>
                  </div>

                  <div
                    className={`mt-1 inline-flex items-center justify-center rounded-xl border px-5 py-3 text-base font-semibold text-white shadow-sm transition ${
                      screenCapture?.isRecording
                        ? 'border-rose-400/60 bg-rose-500/10 group-hover:bg-rose-500/18'
                        : 'border-slate-700 bg-slate-950 group-hover:border-emerald-400/50 group-hover:bg-slate-900'
                    }`}
                  >
                    {screenCapture?.isStarting
                      ? t('dropzone.startingCapture')
                      : screenCapture?.isRecording
                        ? t('dropzone.stopCapture')
                        : t('dropzone.startCapture')}
                  </div>
                </div>
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="video/*"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
    </section>
  );
}
