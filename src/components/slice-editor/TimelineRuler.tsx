import { useMemo, type ReactNode } from 'react';

interface TimelineRulerProps {
  totalDuration: number;
  pixelsPerSecond: number;
}

export default function TimelineRuler({ totalDuration, pixelsPerSecond }: TimelineRulerProps) {
  const markers = useMemo(() => {
    const targetPx = 80;
    const rawInterval = targetPx / pixelsPerSecond;
    const steps = [1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600];
    const interval = steps.find((step) => rawInterval <= step) ?? steps[steps.length - 1];

    let subInterval = interval;
    if (interval >= 60) {
      subInterval = interval / 6;
    } else if (interval === 30) {
      subInterval = 5;
    } else if (interval === 10) {
      subInterval = 2;
    } else if (interval === 5 || interval === 2) {
      subInterval = 1;
    }

    const maxTime = Math.max(10, Math.ceil(totalDuration) + interval);
    const items: ReactNode[] = [];

    for (let time = 0; time <= maxTime; time += subInterval) {
      const isLabel = time % interval === 0;
      items.push(
        <div
          key={time}
          className={`absolute top-0 flex h-full flex-col justify-end border-l pb-0.5 pl-1 font-mono text-[9px] ${
            isLabel ? 'border-slate-500 text-slate-400' : 'border-slate-800 text-slate-700'
          }`}
          style={{ left: `${time * pixelsPerSecond}px` }}
        >
          {isLabel ? `${time}s` : ''}
        </div>,
      );
    }

    return items;
  }, [totalDuration, pixelsPerSecond]);

  return (
    <div id="ruler" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 border-b border-slate-800 bg-slate-950/90">
      {markers}
    </div>
  );
}
