import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';

interface ToggleCardGroupProps<T extends string> {
  value: T | null;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
}

export default function ToggleCardGroup<T extends string>({
  value,
  options,
  onChange,
}: ToggleCardGroupProps<T>) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => {
        const selected = next[0];
        if (selected) {
          onChange(selected as T);
        }
      }}
      aria-label="toggle group"
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className="inline-flex min-h-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 data-[pressed]:border-cyan-400/50 data-[pressed]:bg-cyan-500/10 data-[pressed]:text-cyan-50"
        >
          <span>{option.label}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
