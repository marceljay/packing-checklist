import { useTranslation } from 'react-i18next';
import type { Item, LibraryItem, WeightBandKey } from '../types';
import { tripWeightGrams, weightBand } from '../types';
import { useUnits, formatWeight } from '../lib/units';
import { useWeightThresholds } from '../lib/weightSettings';

/** Per-band accent + suggested luggage icon. */
const BAND_STYLE: Record<WeightBandKey, { chip: string; icon: string }> = {
  light: { chip: 'bg-stamp-soft text-stamp', icon: '🎒' },
  medium: { chip: 'bg-airblue-soft text-airblue', icon: '🧳' },
  heavy: { chip: 'bg-vermilion-soft text-vermilion-deep', icon: '⚠' },
};

/**
 * Trip load gauge: total packed weight (unit-aware) plus the carry band and its
 * advice, driven by the editable thresholds. Hidden when nothing has a weight.
 */
export default function WeightSummary({
  items,
  library,
}: {
  items: Item[];
  library: Map<string, LibraryItem>;
}) {
  const { t } = useTranslation();
  const units = useUnits();
  const thresholds = useWeightThresholds();
  const grams = tripWeightGrams(items, library);
  if (grams <= 0) return null;
  const band = weightBand(grams, thresholds);
  const style = BAND_STYLE[band.key];
  const ADVICE: Record<WeightBandKey, string> = {
    light: 'weight.adviceLight',
    medium: 'weight.adviceMedium',
    heavy: 'weight.adviceHeavy',
  };

  return (
    <section className="card flex items-center gap-4 p-4">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="text-lg">{style.icon}</span>
        <span className="font-display text-xl font-bold tabular-nums">{formatWeight(grams, units)}</span>
      </div>
      <span className={`chip ${style.chip}`}>{t(`weight.${band.key}`)}</span>
      <p className="min-w-0 flex-1 text-sm text-ink-soft">{t(ADVICE[band.key])}</p>
    </section>
  );
}
