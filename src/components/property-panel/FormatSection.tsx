import { Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ExportSettings } from '../../types/editor';
import { FORMAT_OPTIONS } from './settings';
import ToggleCardGroup from './ToggleCardGroup';

interface FormatSectionProps {
  format: ExportSettings['format'];
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
}

export default function FormatSection({ format, onChangeExportSettings }: FormatSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-3">
      <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
        <Film size={13} />
        {t('propertyPanel.format')}
      </div>
      <ToggleCardGroup
        value={format}
        options={FORMAT_OPTIONS}
        onChange={(nextFormat) => onChangeExportSettings({ format: nextFormat })}
      />
    </section>
  );
}
