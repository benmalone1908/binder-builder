import type { Tables } from "@/integrations/supabase/types";

type ChecklistItem = Tables<"checklist_items">;

export function exportChecklistToCSV(
  setName: string,
  items: ChecklistItem[]
): void {
  const headers = ['Card Number', 'Player Name', 'Team', 'Subset', 'Parallel', 'Serial Owned', 'Status'];
  const rows = items.map(item => [
    item.card_number,
    item.player_name,
    item.team || '',
    item.subset_name || '',
    item.parallel || '',
    item.serial_owned || '',
    item.status,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${setName.replace(/[^a-z0-9]/gi, '_')}_checklist.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
