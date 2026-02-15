export interface ParsedCard {
  card_number: string;
  player_name: string;
  team: string | null;
  year: number | null;
  raw_line: string;
  line_number: number;
  error?: string;
}

export interface ParsedParallel {
  parallel: string;
  parallel_print_run: string | null;
  raw_line: string;
  line_number: number;
  error?: string;
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
      player_name: removeAccents(player_name),
      team: team ? removeAccents(team) : null,
      year: defaultYear || null,
      raw_line: line,
      line_number: index + 1,
      error: player_name ? undefined : 'Could not parse player name',
    };
  });
}

/**
 * Parses rainbow parallel text into structured data
 * Formats: "Sky Blue – /499", "Platinum – 1/1", or just "Base" (unnumbered)
 * Extracts parallel name and print run (if present)
 */
export function parseRainbowText(text: string): ParsedParallel[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  return lines.map((line, index) => {
    // Look for dash separator (regular dash, en-dash, or em-dash)
    const dashMatch = line.match(/^(.+?)\s*[–—-]\s*(.+)$/);

    // If no dash, treat entire line as parallel name (unnumbered parallel)
    if (!dashMatch) {
      return {
        parallel: line,
        parallel_print_run: null,
        raw_line: line,
        line_number: index + 1,
      };
    }

    const parallelName = dashMatch[1].trim();
    const serialPart = dashMatch[2].trim();

    // Extract print run number from formats like "/499" or "1/1"
    let printRun: string | null = null;

    // Match "/499" format
    if (serialPart.startsWith('/')) {
      printRun = serialPart.substring(1);
    }
    // Match "1/1" format
    else if (serialPart.includes('/')) {
      const parts = serialPart.split('/');
      printRun = parts[1];
    }
    // Just a number
    else if (/^\d+$/.test(serialPart)) {
      printRun = serialPart;
    }

    return {
      parallel: parallelName,
      parallel_print_run: printRun,
      raw_line: line,
      line_number: index + 1,
      error: !parallelName ? 'Missing parallel name' : undefined,
    };
  });
}
