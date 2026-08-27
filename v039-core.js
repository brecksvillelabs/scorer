export const QUICK_START_STEPS = ['sport', 'teams', 'format'];

export function sportRoleCopy(sport) {
  if (sport === 'tennis' || sport === 'badminton') {
    return {
      title: 'Who is playing?',
      sideA: 'Player / Team A',
      sideB: 'Player / Team B',
      nameA: 'Player / team name',
      nameB: 'Player / team name'
    };
  }
  return {
    title: 'Who is playing?',
    sideA: 'Home / Team A',
    sideB: 'Away / Team B',
    nameA: 'Team name',
    nameB: 'Team name'
  };
}

export function quickFormatPresets(sport) {
  switch (sport) {
    case 'volleyball':
      return [
        { id: 'bo3', label: 'Best of 3', note: 'Great for most youth and school matches', values: { settingBestOf: '3' } },
        { id: 'bo5', label: 'Best of 5', note: 'Longer match format', values: { settingBestOf: '5' } }
      ];
    case 'baseball':
      return [
        { id: '6', label: '6 innings', note: 'Youth', values: { settingBaseballInnings: '6' } },
        { id: '7', label: '7 innings', note: 'School / shortened', values: { settingBaseballInnings: '7' } },
        { id: '9', label: '9 innings', note: 'Regulation', values: { settingBaseballInnings: '9' } }
      ];
    case 'cricket':
      return [
        { id: 't20', label: 'T20', note: '20 overs', values: { settingCricketFormat: 'T20', settingOvers: '20' } },
        { id: 'odi', label: 'ODI', note: '50 overs', values: { settingCricketFormat: 'ODI', settingOvers: '50' } },
        { id: 'custom', label: 'Custom', note: 'Choose overs below', values: { settingCricketFormat: 'Custom' } }
      ];
    case 'tennis':
      return [
        { id: 'bo3', label: 'Best of 3 sets', note: 'Most common', values: { settingTennisBestOf: '3' } },
        { id: 'bo5', label: 'Best of 5 sets', note: 'Long format', values: { settingTennisBestOf: '5' } }
      ];
    case 'badminton':
      return [
        { id: 'bo3', label: 'Best of 3 games', note: '21-point rally scoring', values: { settingBadmintonBestOf: '3', settingBadmintonGameTo: '21' } }
      ];
    case 'lacrosse':
      return [
        { id: 'field', label: 'Field', note: '4 × 15 min', values: { settingLacrosseDiscipline: 'field', settingMinutes: '15', settingLacrosseShotClock: '0' } },
        { id: 'sixes', label: 'Sixes', note: '4 × 8 min · 30s shot clock', values: { settingLacrosseDiscipline: 'sixes', settingMinutes: '8', settingLacrosseShotClock: '30' } }
      ];
    case 'kabaddi':
      return [
        { id: 'standard', label: 'Standard', note: '20-minute halves · 30s raid', values: { settingMinutes: '20', settingKabaddiRaidSeconds: '30' } }
      ];
    case 'basketball':
      return [
        { id: '8', label: '8 min quarters', note: 'Common youth format', values: { settingMinutes: '8' } },
        { id: '10', label: '10 min quarters', note: 'International-style length', values: { settingMinutes: '10' } },
        { id: '12', label: '12 min quarters', note: 'Long format', values: { settingMinutes: '12' } }
      ];
    case 'soccer':
      return [
        { id: '30', label: '30 min halves', note: 'Short / youth format', values: { settingMinutes: '30' } },
        { id: '40', label: '40 min halves', note: 'Common school format', values: { settingMinutes: '40' } },
        { id: '45', label: '45 min halves', note: 'Standard full match', values: { settingMinutes: '45' } }
      ];
    case 'football':
      return [
        { id: '12', label: '12 min quarters', note: 'Common school format', values: { settingMinutes: '12' } },
        { id: '15', label: '15 min quarters', note: 'Long format', values: { settingMinutes: '15' } }
      ];
    default:
      return [];
  }
}

export function presetMatchesValues(preset, values) {
  const entries = Object.entries(preset?.values || {});
  if (!entries.length) return false;
  return entries.every(([id, value]) => String(values?.[id] ?? '') === String(value));
}

export function nextQuickStep(current, direction = 1) {
  const index = QUICK_START_STEPS.indexOf(current);
  if (index < 0) return QUICK_START_STEPS[0];
  const next = Math.min(QUICK_START_STEPS.length - 1, Math.max(0, index + direction));
  return QUICK_START_STEPS[next];
}
