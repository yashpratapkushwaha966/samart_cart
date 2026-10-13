import { FiMoon, FiSliders, FiSun } from 'react-icons/fi';
import { ACCENTS, useTheme } from '../context/ThemeContext.jsx';

const MODES = [['light', 'Light', FiSun], ['dark', 'Dark', FiMoon], ['custom', 'Custom', FiSliders]];

export default function ThemePicker() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
        {MODES.map(([k, label, Icon]) => (
          <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-xs font-semibold transition active:scale-95 ${mode === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink/10 text-ink-soft hover:bg-ink/5'}`}>
            <Icon className="h-5 w-5" />{label}
          </button>
        ))}
      </div>
      {mode === 'custom' && (
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-soft">Pick your colour</p>
          <div className="flex gap-3" role="radiogroup" aria-label="Accent colour">
            {Object.entries(ACCENTS).map(([k, hex]) => (
              <button key={k} role="radio" aria-checked={accent === k} aria-label={k} onClick={() => setAccent(k)}
                className={`h-9 w-9 rounded-full transition active:scale-90 ${accent === k ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`} style={{ backgroundColor: hex }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
