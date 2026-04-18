interface TimelinePlayheadProps {
  currentTime: number;
  pixelsPerSecond: number;
}

export default function TimelinePlayhead({ currentTime, pixelsPerSecond }: TimelinePlayheadProps) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-40 w-[1.5px] bg-rose-500"
      style={{ left: `${currentTime * pixelsPerSecond}px` }}
    >
      <div className="absolute left-1/2 top-0 flex h-3 w-3 -translate-x-1/2 items-center justify-center rounded-b-sm bg-rose-500 shadow-md">
        <div className="mt-0.5 h-0 w-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-white" />
      </div>
    </div>
  );
}
