export interface ParsedCard {
  card_number: string;
  player_name: string;
  team: string | null;
  year: number | null;
  raw_line: string;
  line_number: number;
  error?: string;
}

export function parseChecklistText(text: string, defaultYear?: number | null): ParsedCard[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  return lines.map((line, index) => {
    const firstSpaceIndex = line.indexOf(' ');

    if (firstSpaceIndex === -1) {
      return {
        card_number: line,
        player_name: '',
        team: null,
        year: defaultYear || null,
        raw_line: line,
        line_number: index + 1,
        error: 'Could not parse player name',
      };
    }

    const card_number = line.substring(0, firstSpaceIndex).trim();
    const remainder = line.substring(firstSpaceIndex + 1).trim();

    // Try " - " first (handles hyphenated names like "Pete Crow-Armstrong")
    // Then fall back to last comma (e.g. "Mike Trout, Angels")
    const lastDashIndex = remainder.lastIndexOf(' - ');
    const lastCommaIndex = remainder.lastIndexOf(',');

    let player_name: string;
    let team: string | null;

    if (lastDashIndex !== -1) {
      player_name = remainder.substring(0, lastDashIndex).trim();
      team = remainder.substring(lastDashIndex + 3).trim();
    } else if (lastCommaIndex !== -1) {
      player_name = remainder.substring(0, lastCommaIndex).trim();
      team = remainder.substring(lastCommaIndex + 1).trim();
    } else {
      player_name = remainder;
      team = null;
    }

    return {
      card_number,
      player_name,
      team: team || null,
      year: defaultYear || null,
      raw_line: line,
      line_number: index + 1,
      error: player_name ? undefined : 'Could not parse player name',
    };
  });
}
