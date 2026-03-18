import type { ScorecardTile } from "@/features/metrics/scorecard/lib/scorecard.types";
import { GLOBAL_BAND_PRESETS } from "@/features/metrics-admin/lib/globalBandPresets";

type PresetKey = keyof typeof GLOBAL_BAND_PRESETS;
type BandKey = keyof (typeof GLOBAL_BAND_PRESETS)[PresetKey];

function pickPresetKey(activePresetKey: string | null): PresetKey {
  if (activePresetKey && activePresetKey in GLOBAL_BAND_PRESETS) {
    return activePresetKey as PresetKey;
  }

  if ("BRIGHT" in GLOBAL_BAND_PRESETS) {
    return "BRIGHT";
  }

  const first = Object.keys(GLOBAL_BAND_PRESETS)[0];
  return (first ?? "BRIGHT") as PresetKey;
}

export function mapTilesWithPreset(
  tiles: ScorecardTile[],
  activePresetKey: string | null
): ScorecardTile[] {
  const presetKey = pickPresetKey(activePresetKey);
  const preset = GLOBAL_BAND_PRESETS[presetKey];

  return tiles.map((tile) => {
    const bandKey = tile.band.band_key as BandKey;
    const bandPreset = preset?.[bandKey];

    if (!bandPreset) return tile;

    return {
      ...tile,
      band: {
        ...tile.band,
        paint: {
          preset: presetKey,
          bg: bandPreset.bg_color,
          border: bandPreset.border_color,
          ink: bandPreset.text_color,
        },
      },
    };
  });
}