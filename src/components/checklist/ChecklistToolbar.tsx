import { Search, MoreHorizontal, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
    <div className="space-y-2">
      {/* Main toolbar - single row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 pr-2 text-sm"
          />
        </div>

        {/* Status filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <span className="text-xs font-medium">
                {statusFilter === "all" && "All"}
                {statusFilter === "need" && "Need"}
                {statusFilter === "pending" && "Pending"}
                {statusFilter === "owned" && "Have"}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-32">
            <DropdownMenuItem
              onClick={() => onStatusFilterChange("all")}
              className={cn("text-xs", statusFilter === "all" && "bg-accent")}
            >
              All
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusFilterChange("need")}
              className={cn("text-xs", statusFilter === "need" && "bg-accent")}
            >
              Need
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusFilterChange("pending")}
              className={cn("text-xs", statusFilter === "pending" && "bg-accent")}
            >
              Pending
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusFilterChange("owned")}
              className={cn("text-xs", statusFilter === "owned" && "bg-accent")}
            >
              Have
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Stats - inline compact display */}
        <div className="flex items-center gap-3 px-3 py-1 rounded-md bg-[#0F2A44]/5 border border-[#0F2A44]/10">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#0F2A44]">{stats.owned}/{stats.total}</span>
            <span className="text-[10px] text-muted-foreground font-medium">({completionPct}%)</span>
          </div>
          {stats.pending > 0 && (
            <>
              <div className="w-px h-3 bg-border" />
              <span className="text-[10px] text-muted-foreground">
                <span className="font-medium">{stats.pending}</span> pending
              </span>
            </>
          )}
          <div className="w-px h-3 bg-border" />
          <span className="text-[10px] text-muted-foreground">
            <span className="font-medium">{stats.need}</span> need
          </span>
        </div>

        {/* Selection state */}
        {selectedCount > 0 && (
          <>
            <div className="w-px h-4 bg-border ml-1" />
            <Badge variant="secondary" className="h-6 gap-1 px-2">
              <span className="text-xs font-medium">{selectedCount} selected</span>
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        )}

        {/* Actions menu */}
        <div className="ml-auto flex items-center gap-1">
          {selectedCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <span className="text-xs font-medium">Batch Actions</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-xs">Set Status</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onBulkStatusChange("need")}
                  className="text-xs"
                >
                  Mark as Need
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onBulkStatusChange("pending")}
                  className="text-xs"
                >
                  Mark as Pending
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onBulkStatusChange("owned")}
                  className="text-xs"
                >
                  Mark as Have
                </DropdownMenuItem>
                {isMultiYear && onBulkYearChange && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onBulkYearChange}
                      className="text-xs"
                    >
                      Change Year
                    </DropdownMenuItem>
                  </>
                )}
                {onBulkDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onBulkDelete}
                      className="text-xs text-destructive focus:text-destructive"
                    >
                      Delete Selected
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <span className="text-xs font-medium">Actions</span>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {isRainbow ? (
                <DropdownMenuItem onClick={onAddCard} className="text-xs">
                  Add Parallel
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs">
                    Add Card(s)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={onAddCard} className="text-xs">
                      Single Card
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onImport} className="text-xs">
                      Bulk Cards
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {!isRainbow && (
                <DropdownMenuItem onClick={onBulkPaste} className="text-xs">
                  Bulk Status Update
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onExport}
                disabled={stats.total === 0}
                className="text-xs"
              >
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Completion bar - subtle visual feedback */}
      {stats.total > 0 && (
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#F97316] to-[#F97316]/80 transition-all duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
