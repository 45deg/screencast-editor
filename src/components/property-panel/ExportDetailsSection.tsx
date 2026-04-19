import { Gauge, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ExportSettings } from '../../types/editor';
import {
  clampInt,
  getMatchingMp4Preset,
  MP4_PROFILE_OPTIONS,
  type Mp4PresetKey,
} from './settings';
import ToggleCardGroup from './ToggleCardGroup';

interface ExportDetailsSectionProps {
  exportSettings: ExportSettings;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
}

export default function ExportDetailsSection({
  exportSettings,
  onChangeExportSettings,
}: ExportDetailsSectionProps) {
  const { t } = useTranslation();
  const activeMp4Preset = getMatchingMp4Preset(exportSettings);
  const mp4PresetOptions: Array<{ value: Mp4PresetKey; label: string }> = [
    { value: 'size', label: t('propertyPanel.lightweight') },
    { value: 'balance', label: t('propertyPanel.balance') },
    { value: 'high_quality', label: t('propertyPanel.highQuality') },
  ];

  return (
    <section className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-3">
      <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
        <Sparkles size={13} />
        {t('propertyPanel.mp4Details')}
      </div>

      <div className="space-y-3">
        <ToggleCardGroup
          value={activeMp4Preset}
          options={mp4PresetOptions}
          onChange={(presetKey) => {
            const preset = MP4_PROFILE_OPTIONS.find((option) => option.value === presetKey);
            if (preset) {
              onChangeExportSettings(preset.settings);
            }
          }}
        />

        <label className="block text-xs text-slate-300">
          <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
            <Gauge size={13} />
            {t('propertyPanel.fpsMp4')}
          </span>
          <input
            type="number"
            min={1}
            max={120}
            value={exportSettings.mp4Fps}
            onChange={(event) => {
              const fps = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(fps)) {
                onChangeExportSettings({ mp4Fps: clampInt(fps, 1, 120) });
              }
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </label>
      </div>
    </section>
  );
}
