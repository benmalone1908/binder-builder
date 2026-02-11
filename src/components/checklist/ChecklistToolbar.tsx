import { Search, Upload, Download, ListChecks, X, Trash2, CalendarCog, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
export type StatusFilter = "all" | "need" | "pending" | "owned";

interface ChecklistStats {
  total: number;
  owned: number;
  pending: number;
  need: number;
}

interface ChecklistToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  stats: ChecklistStats;
  selectedCount: number;
  onBulkStatusChange: (status: "need" | "pending" | "owned") => void;
  onBulkDelete?: () => void;
  onBulkYearChange?: () => void;
  isMultiYear?: boolean;
  isRainbow?: boolean;
  onClearSelection: () => void;
  onAddCard: () => void;
  onImport: () => void;
  onExport: () => void;
  onBulkPaste: () => void;
}

export function ChecklistToolbar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  stats,
  selectedCount,
  onBulkStatusChange,
  onBulkDelete,
  onBulkYearChange,
  isMultiYear,
  isRainbow,
  onClearSelection,
  onAddCard,
  onImport,
  onExport,
  onBulkPaste,
}: ChecklistToolbarProps) {
  const completionPct = stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Selection action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <Button size="sm" variant="outline" onClick={() => onBulkStatusChange("need")}>
            Set Need
          </Button>
          <Button size="sm" variant="outline" onClick={() => onBulkStatusChange("pending")}>
            Set Pending
          </Button>
          <Button size="sm" variant="outline" onClick={() => onBulkStatusChange("owned")}>
            Set Have
          </Button>
          {isMultiYear && onBulkYearChange && (
            <Button size="sm" variant="outline" onClick={onBulkYearChange}>
              <CalendarCog className="h-4 w-4 mr-1" />
              Change Year
            </Button>
          )}
          {onBulkDelete && (
            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={onBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClearSelection} className="ml-auto">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Stats bar */}
      {stats.total > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">
            {stats.owned}/{stats.total} have ({completionPct}%)
          </span>
          <Progress value={completionPct} className="flex-1 max-w-xs h-2" />
          {stats.pending > 0 && (
            <span className="text-muted-foreground">{stats.pending} pending</span>
          )}
          <span className="text-muted-foreground">{stats.need} need</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cards..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="need">Need</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="owned">Have</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={onAddCard}>
            <Plus className="h-4 w-4 mr-2" />
            {isRainbow ? "Add Parallel" : "Add Card"}
          </Button>
          {/* Hide Bulk Update for rainbow sets */}
          {!isRainbow && (
            <Button variant="outline" onClick={onBulkPaste}>
              <ListChecks className="h-4 w-4 mr-2" />
              Bulk Update
            </Button>
          )}
          {/* Hide Import for rainbow sets with existing cards */}
          {!(isRainbow && stats.total > 0) && (
            <Button variant="outline" onClick={onImport}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          )}
          <Button variant="outline" onClick={onExport} disabled={stats.total === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
