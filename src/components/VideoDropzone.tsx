import { useCallback, useRef, useState } from 'react';
import { Clapperboard, UploadCloud } from 'lucide-react';

interface VideoDropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  mode?: 'fullscreen' | 'embedded';
}

export default function VideoDropzone({ onFileSelected, isLoading, error, mode = 'fullscreen' }: VideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isEmbedded = mode === 'embedded';

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
        isEmbedded ? 'min-h-[360px] rounded-2xl border border-slate-800/80 bg-slate-950/70 p-6 shadow-xl' : 'min-h-screen px-6 py-10'
      }`}
    >
      {isEmbedded ? null : (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.25),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(14,116,144,0.35),transparent_40%),linear-gradient(160deg,#020617_0%,#0b1120_45%,#111827_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px] opacity-25" />
        </>
      )}

      <div className={`relative w-full ${isEmbedded ? 'max-w-none' : 'mx-auto max-w-3xl'}`}>
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
          disabled={isLoading}
          className={`group relative w-full overflow-hidden rounded-3xl border p-10 text-left backdrop-blur transition ${
            isDragging
              ? 'border-cyan-300 bg-cyan-300/10 shadow-[0_0_0_2px_rgba(103,232,249,0.35)]'
              : 'border-slate-700/80 bg-slate-900/70 hover:border-cyan-400/60'
          } ${isLoading ? 'cursor-wait opacity-80' : 'cursor-pointer'} ${isEmbedded ? 'rounded-2xl' : 'rounded-3xl'}`}
        >
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative z-10 flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-300/10 px-4 py-1 text-xs font-semibold tracking-[0.18em] text-cyan-100">
              <Clapperboard size={14} />
              SCREENCAST EDITOR
            </div>

            <div>
              <h1 className="font-['Space_Grotesk',sans-serif] text-3xl font-bold leading-tight text-white sm:text-4xl">
                {isEmbedded ? 'Preview Skeleton: 動画をドロップして開始' : 'Click to open or Drag and Drop a video file'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                ローカル動画をブラウザだけでカット、速度調整、クロップ、GIF/MP4エクスポートできます。
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-200">
              <UploadCloud size={16} className="text-cyan-300" />
              {isLoading ? '動画を読み込み中...' : '対応例: mp4 / mov / webm'}
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>
            ) : null}

            {isEmbedded ? (
              <div className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="h-3 w-40 animate-pulse rounded bg-slate-800" />
                <div className="mt-2 h-3 w-64 animate-pulse rounded bg-slate-800/80" />
                <div className="mt-4 h-24 w-full animate-pulse rounded-lg bg-slate-900" />
              </div>
            ) : null}
          </div>
        </button>

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
