import { Tooltip } from '@base-ui/react/tooltip';
import { Toolbar } from '@base-ui/react/toolbar';
import { GripVertical } from 'lucide-react';
import { type ReactElement, type ReactNode } from 'react';

interface ToolbarTooltipProps {
  label: string;
  children: ReactElement;
}

interface AnnotationToolbarRootProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

interface AnnotationToolbarDragHandleProps {
  ariaLabel: string;
  className?: string;
}

const annotationToolbarRootClassName =
  'timeline-scrollbar inline-flex max-w-[min(92vw,820px)] flex-wrap items-center justify-end gap-1 rounded-lg border border-slate-700/90 bg-slate-950/95 p-1.5 shadow-xl backdrop-blur';

export function ToolbarTooltip({ label, children }: ToolbarTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={8} className="z-[130]">
          <Tooltip.Popup className="rounded-md border border-slate-700 bg-slate-950/98 px-2 py-1 text-[11px] text-slate-100 shadow-xl backdrop-blur">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function AnnotationToolbarRoot({ ariaLabel, children, className }: AnnotationToolbarRootProps) {
  return (
    <Toolbar.Root
      aria-label={ariaLabel}
      className={`${annotationToolbarRootClassName} ${className ?? ''}`.trim()}
    >
      {children}
    </Toolbar.Root>
  );
}

export function AnnotationToolbarDragHandle({ ariaLabel, className }: AnnotationToolbarDragHandleProps) {
  return (
    <ToolbarTooltip label={ariaLabel}>
      <div
        className={`${className ?? ''} inline-flex h-8 w-5 cursor-move touch-none select-none items-center justify-center text-slate-400`}
        aria-label={ariaLabel}
        role="presentation"
      >
        <GripVertical size={14} />
      </div>
    </ToolbarTooltip>
  );
}

export function AnnotationToolbarSeparator() {
  return <Toolbar.Separator className="mx-1 h-5 w-px bg-slate-800" />;
}