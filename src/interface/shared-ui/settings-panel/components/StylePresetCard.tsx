import type { SubtitleStylePreset } from '@/shared/subtitle-style-presets';
import type { SubtitleStyle } from '@/shared/types';

interface Props {
  preset: SubtitleStylePreset;
  isActive: boolean;
  onApply: () => void;
}

function getPresetAccent(presetId: string): { bg: string; color: string; highlight: string } {
  const map: Record<string, { bg: string; color: string; highlight: string }> = {
    classic: { bg: '#1a1a2e', color: '#FFFFFF', highlight: '#FF4D4D' },
    'clear-white': { bg: '#0f172a', color: '#F8FAFC', highlight: '#F59E0B' },
    outline: { bg: '#1a1a2e', color: '#FFFFFF', highlight: '#38BDF8' },
    'just-shadow': { bg: '#0f172a', color: '#E2E8F0', highlight: '#22C55E' },
    'paper-note': { bg: '#1c1917', color: '#FEF3C7', highlight: '#F97316' },
    'frost-glass': { bg: '#0c1622', color: '#BFDBFE', highlight: '#60A5FA' },
    'cyber-neon': { bg: '#0f0f1a', color: '#C084FC', highlight: '#E879F9' },
    'deep-sea': { bg: '#0b1622', color: '#E0F2FE', highlight: '#38BDF8' },
    blackboard: { bg: '#1a2118', color: '#D9F2C7', highlight: '#F97316' },
    'matrix-green': { bg: '#0a0f0a', color: '#22C55E', highlight: '#4ADE80' },
    'macaron-pink': { bg: '#1a1518', color: '#FBCFE8', highlight: '#F472B6' },
    'maple-rust': { bg: '#1a1614', color: '#FED7AA', highlight: '#F97316' },
  };
  return map[presetId] ?? { bg: '#1a1a2e', color: '#FFFFFF', highlight: '#5b8def' };
}

export function StylePresetCard({ preset, isActive, onApply }: Props): JSX.Element {
  const accent = getPresetAccent(preset.id);

  return (
    <button
      type="button"
      className={`sp-preset-card${isActive ? ' active' : ''}`}
      onClick={onApply}
    >
      <div
        className="sp-preset-card-preview"
        style={{ background: accent.bg, color: accent.color, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
      >
        <span style={{ color: accent.highlight, marginRight: 4 }}>●</span>
        Aa
      </div>
      <div className="sp-preset-card-name">{preset.name}</div>
    </button>
  );
}
