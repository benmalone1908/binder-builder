import { useState, useEffect, useMemo, useRef, Fragment, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Upload, ImageOff, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { exportChecklistToCSV } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SetFormDialog } from "@/components/sets/SetFormDialog";
import { ImportChecklistDialog } from "@/components/checklist/ImportChecklistDialog";
import { EditChecklistItemDialog } from "@/components/checklist/EditChecklistItemDialog";
import { BulkStatusDialog } from "@/components/checklist/BulkStatusDialog";
import { ChangeYearDialog } from "@/components/checklist/ChangeYearDialog";
import {
  ChecklistToolbar,
  type StatusFilter,
} from "@/components/checklist/ChecklistToolbar";
import { ChecklistItemRow } from "@/components/checklist/ChecklistItemRow";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SetRow = Tables<"sets">;
type ChecklistItem = Tables<"checklist_items">;

const SET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  insert: "Insert",
  rainbow: "Rainbow",
  multi_year_insert: "Multi-Year Insert",
};

function compareCardNumbers(a: string, b: string): number {
  const regex = /^(.*?)(\d+)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixCmp = matchA[1].localeCompare(matchB[1]);
    if (prefixCmp !== 0) return prefixCmp;
    return parseInt(matchA[2]) - parseInt(matchB[2]);
  }

  return a.localeCompare(b);
}

interface SetDetailContentProps {
  setId: string;
  isCompact?: boolean;
  onClose?: () => void;
}

export function SetDetailContent({ setId, isCompact = false, onClose }: SetDetailContentProps) {
  const navigate = useNavigate();

  const [set, setSet] = useState<SetRow | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("need");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<number | null>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);

  const [editSetOpen, setEditSetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [changeYearOpen, setChangeYearOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!setId) return;
    setLoading(true);

    const [setResult, itemsResult] = await Promise.all([
      supabase.from("sets").select("*").eq("id", setId).single(),
      supabase.from("checklist_items").select("*").eq("set_id", setId),
    ]);

    if (setResult.error) {
      if (isCompact && onClose) {
        onClose();
      } else {
        navigate("/");
      }
      return;
    }

    setSet(setResult.data);
    setItems(itemsResult.data || []);
    setSelectedIds(new Set());
    setLoading(false);
  }, [setId, isCompact, onClose, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isMultiYear = set?.set_type === "multi_year_insert";

  const stats = useMemo(() => {
    const total = items.length;
    const owned = items.filter((i) => i.status === "owned").length;
    const pending = items.filter((i) => i.status === "pending").length;
    const need = items.filter((i) => i.status === "need").length;
    return { total, owned, pending, need };
  }, [items]);

  const availableYears = useMemo(() => {
    if (!isMultiYear) return [];
    const years = new Set<number>();
    items.forEach((item) => {
      if (item.year) years.add(item.year);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [items, isMultiYear]);

  useEffect(() => {
    if (availableYears.length > 0 && expandedYears.size === 0) {
      setExpandedYears(new Set(availableYears));
    }
  }, [availableYears]);

  useEffect(() => {
    const availableSet = new Set(availableYears);
    setExpandedYears((prev) => {
      const cleaned = new Set([...prev].filter((y) => y === null || availableSet.has(y)));
      if (cleaned.size !== prev.size) return cleaned;
      return prev;
    });
    if (yearFilter !== "all" && !availableSet.has(yearFilter)) {
      setYearFilter("all");
    }
  }, [availableYears, yearFilter]);

  useEffect(() => {
    if (availableYears.length > 0) {
      setExpandedYears((prev) => {
        const next = new Set(prev);
        let changed = false;
        availableYears.forEach((year) => {
          if (!next.has(year)) {
            next.add(year);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [availableYears]);

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }

    if (isMultiYear && yearFilter !== "all") {
      result = result.filter((i) => i.year === yearFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (i) =>
          i.card_number.toLowerCase().includes(term) ||
          i.player_name.toLowerCase().includes(term) ||
          (i.team && i.team.toLowerCase().includes(term))
      );
    }

    result.sort((a, b) => compareCardNumbers(a.card_number, b.card_number));

    return result;
  }, [items, statusFilter, searchTerm, isMultiYear, yearFilter]);

  const cardsByYear = useMemo(() => {
    if (!isMultiYear || yearFilter !== "all") return null;

    const groups = new Map<number | null, ChecklistItem[]>();
    filteredAndSorted.forEach((item) => {
      const year = item.year;
      if (!groups.has(year)) {
        groups.set(year, []);
      }
      groups.get(year)!.push(item);
    });

    const sortedYears = Array.from(groups.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });

    return sortedYears.map((year) => ({
      year,
      items: groups.get(year)!,
    }));
  }, [isMultiYear, yearFilter, filteredAndSorted]);

  function toggleYearExpanded(year: number | null) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }

  function handleStatusChange(itemId: string, newStatus: "need" | "pending" | "owned") {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
    );
  }

  function handleFieldChange(itemId: string, field: string, value: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: value || null } : i))
    );
  }

  function handleEditItem(item: ChecklistItem) {
    setEditingItem(item);
    setEditItemOpen(true);
  }

  function handleSelectChange(itemId: string, selected: boolean, shiftKey: boolean) {
    const visibleItems = cardsByYear
      ? cardsByYear.flatMap((g) => (expandedYears.has(g.year) ? g.items : []))
      : filteredAndSorted;

    if (shiftKey && lastClickedIdRef.current) {
      const lastIndex = visibleItems.findIndex((i) => i.id === lastClickedIdRef.current);
      const currentIndex = visibleItems.findIndex((i) => i.id === itemId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = visibleItems.slice(start, end + 1).map((i) => i.id);

        setSelectedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((id) => {
            if (selected) {
              next.add(id);
            } else {
              next.delete(id);
            }
          });
          return next;
        });
        lastClickedIdRef.current = itemId;
        return;
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
    lastClickedIdRef.current = itemId;
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(filteredAndSorted.map((i) => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  async function handleBulkStatusChange(newStatus: "need" | "pending" | "owned") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("checklist_items")
      .update({ status: newStatus })
      .in("id", ids);

    if (error) {
      toast.error("Failed to update: " + error.message);
      return;
    }

    setItems((prev) =>
      prev.map((i) => (selectedIds.has(i.id) ? { ...i, status: newStatus } : i))
    );
    setSelectedIds(new Set());
    toast.success(`Updated ${ids.length} cards to "${newStatus}"`);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = window.confirm(`Delete ${ids.length} selected cards? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("checklist_items")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }

    setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
    toast.success(`Deleted ${ids.length} cards`);
  }

  async function handleBulkYearChange(newYear: number) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("checklist_items")
      .update({ year: newYear })
      .in("id", ids);

    if (error) {
      toast.error("Failed to update year: " + error.message);
      return;
    }

    setItems((prev) =>
      prev.map((i) => (selectedIds.has(i.id) ? { ...i, year: newYear } : i))
    );
    setSelectedIds(new Set());
    toast.success(`Updated ${ids.length} cards to year ${newYear}`);
  }

  function handleBack() {
    if (isCompact && onClose) {
      onClose();
    } else {
      navigate("/");
    }
  }

  const allVisibleSelected =
    filteredAndSorted.length > 0 &&
    filteredAndSorted.every((i) => selectedIds.has(i.id));

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!set) {
    return <p className="text-muted-foreground">Set not found.</p>;
  }

  return (
    <div className={cn("space-y-6", isCompact && "space-y-4")}>
      {/* Header */}
      <div className={cn("flex items-start gap-4", isCompact && "gap-3")}>
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Cover image */}
        <div className={cn(
          "shrink-0 rounded-lg overflow-hidden border bg-muted",
          isCompact ? "w-16 h-20" : "w-24 h-32"
        )}>
          {set.cover_image_url ? (
            <button
              type="button"
              className="w-full h-full cursor-pointer"
              onClick={() => setImageModalOpen(true)}
            >
              <img
                src={set.cover_image_url}
                alt={`${set.name} cover`}
                className="w-full h-full object-cover"
              />
            </button>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className={cn(
                "text-muted-foreground/30",
                isCompact ? "w-5 h-5" : "w-8 h-8"
              )} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className={cn(
            "font-bold truncate",
            isCompact ? "text-lg" : "text-2xl"
          )}>{set.name}</h1>
          <div className={cn(
            "flex items-center gap-2 mt-1 text-muted-foreground flex-wrap",
            isCompact ? "text-xs" : "text-sm"
          )}>
            {!isMultiYear && <span>{set.year}</span>}
            <span>{set.brand}</span>
            <span>{set.product_line}</span>
            <Badge variant="secondary" className={isCompact ? "text-xs" : ""}>
              {SET_TYPE_LABELS[set.set_type] || set.set_type}
            </Badge>
          </div>
          {set.insert_set_name && (
            <div className="mt-1">
              <Badge variant="outline" className={cn(
                "text-violet-700 border-violet-300 bg-violet-50",
                isCompact && "text-xs"
              )}>
                {set.insert_set_name}
              </Badge>
            </div>
          )}
          {set.notes && !isCompact && (
            <p className="text-sm text-muted-foreground mt-2">{set.notes}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className={isCompact ? "mr-6" : ""}
          onClick={() => setEditSetOpen(true)}
        >
          <Pencil className="h-3 w-3 mr-2" />
          Edit
        </Button>
      </div>

      {/* Checklist content */}
      {items.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">
            No cards in this set yet. Import a checklist to get started.
          </p>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Checklist
          </Button>
        </div>
      ) : (
        <>
          <ChecklistToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            stats={stats}
            selectedCount={selectedIds.size}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkDelete={handleBulkDelete}
            onBulkYearChange={() => setChangeYearOpen(true)}
            isMultiYear={isMultiYear}
            onClearSelection={() => setSelectedIds(new Set())}
            onImport={() => setImportOpen(true)}
            onExport={() => exportChecklistToCSV(set.name, items)}
            onBulkPaste={() => setBulkPasteOpen(true)}
          />

          {/* Year filter for multi-year sets */}
          {isMultiYear && availableYears.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Year:</span>
              <Button
                size="sm"
                variant={yearFilter === "all" ? "default" : "outline"}
                onClick={() => setYearFilter("all")}
              >
                All
              </Button>
              {availableYears.map((year) => (
                <Button
                  key={year}
                  size="sm"
                  variant={yearFilter === year ? "default" : "outline"}
                  onClick={() => setYearFilter(year)}
                >
                  {year}
                </Button>
              ))}
              {yearFilter === "all" && (
                <>
                  <span className="text-muted-foreground mx-1">|</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedYears(new Set(availableYears))}
                  >
                    Expand All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedYears(new Set())}
                  >
                    Collapse All
                  </Button>
                </>
              )}
            </div>
          )}

          <div className={cn(
            "border rounded-lg overflow-hidden",
            isCompact && "overflow-x-auto"
          )}>
            <Table className={isCompact ? "min-w-[600px]" : ""}>
              <TableHeader>
                <TableRow>
                  <TableHead className={isCompact ? "w-8" : "w-10"}>
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead className={cn("whitespace-nowrap", isCompact ? "w-16" : "w-24")}>Card #</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className={isCompact ? "w-20" : ""}>Team</TableHead>
                  {isMultiYear && yearFilter !== "all" && (
                    <TableHead className={isCompact ? "w-12" : "w-16"}>Year</TableHead>
                  )}
                  <TableHead className={isCompact ? "w-20" : "w-28"}>Status</TableHead>
                  <TableHead className={isCompact ? "w-12" : "w-10"}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cardsByYear ? (
                  cardsByYear.map((group) => {
                    const isExpanded = expandedYears.has(group.year);
                    const yearLabel = group.year ? String(group.year) : "No Year";
                    const groupStats = {
                      total: group.items.length,
                      owned: group.items.filter((i) => i.status === "owned").length,
                    };
                    return (
                      <Fragment key={`year-group-${group.year}`}>
                        <TableRow
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => toggleYearExpanded(group.year)}
                        >
                          <TableCell colSpan={6} className="py-2">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-semibold">{yearLabel}</span>
                              <span className="text-sm text-muted-foreground">
                                ({groupStats.owned}/{groupStats.total} owned)
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (() => {
                          const baseCards = group.items.filter((i) => !i.parallel);
                          const parallelCards = group.items.filter((i) => i.parallel);

                          const parallelGroups = new Map<string, typeof parallelCards>();
                          parallelCards.forEach((card) => {
                            const key = card.parallel!;
                            if (!parallelGroups.has(key)) {
                              parallelGroups.set(key, []);
                            }
                            parallelGroups.get(key)!.push(card);
                          });

                          return (
                            <>
                              {baseCards.map((item) => (
                                <ChecklistItemRow
                                  key={item.id}
                                  item={item}
                                  setInfo={{ year: set.year, brand: set.brand, product_line: set.product_line }}
                                  isMultiYear={false}
                                  selected={selectedIds.has(item.id)}
                                  onSelectChange={handleSelectChange}
                                  onStatusChange={handleStatusChange}
                                  onFieldChange={handleFieldChange}
                                  onEdit={handleEditItem}
                                />
                              ))}
                              {Array.from(parallelGroups.entries()).map(([parallelName, cards]) => (
                                <Fragment key={`parallel-${group.year}-${parallelName}`}>
                                  <TableRow className="bg-muted/30">
                                    <TableCell colSpan={6} className="py-1.5">
                                      <span className="text-xs font-medium text-muted-foreground ml-4">
                                        {parallelName}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                  {cards.map((item) => (
                                    <ChecklistItemRow
                                      key={item.id}
                                      item={item}
                                      setInfo={{ year: set.year, brand: set.brand, product_line: set.product_line }}
                                      isMultiYear={false}
                                      selected={selectedIds.has(item.id)}
                                      onSelectChange={handleSelectChange}
                                      onStatusChange={handleStatusChange}
                                      onFieldChange={handleFieldChange}
                                      onEdit={handleEditItem}
                                    />
                                  ))}
                                </Fragment>
                              ))}
                            </>
                          );
                        })()}
                      </Fragment>
                    );
                  })
                ) : (
                  (() => {
                    if (!isMultiYear) {
                      return filteredAndSorted.map((item) => (
                        <ChecklistItemRow
                          key={item.id}
                          item={item}
                          setInfo={{ year: set.year, brand: set.brand, product_line: set.product_line }}
                          isMultiYear={false}
                          selected={selectedIds.has(item.id)}
                          onSelectChange={handleSelectChange}
                          onStatusChange={handleStatusChange}
                          onFieldChange={handleFieldChange}
                          onEdit={handleEditItem}
                        />
                      ));
                    }

                    const baseCards = filteredAndSorted.filter((i) => !i.parallel);
                    const parallelCards = filteredAndSorted.filter((i) => i.parallel);

                    const parallelGroups = new Map<string, typeof parallelCards>();
                    parallelCards.forEach((card) => {
                      const key = card.parallel!;
                      if (!parallelGroups.has(key)) {
                        parallelGroups.set(key, []);
                      }
                      parallelGroups.get(key)!.push(card);
                    });

                    return (
                      <>
                        {baseCards.map((item) => (
                          <ChecklistItemRow
                            key={item.id}
                            item={item}
                            setInfo={{ year: set.year, brand: set.brand, product_line: set.product_line }}
                            isMultiYear={isMultiYear}
                            selected={selectedIds.has(item.id)}
                            onSelectChange={handleSelectChange}
                            onStatusChange={handleStatusChange}
                            onFieldChange={handleFieldChange}
                            onEdit={handleEditItem}
                          />
                        ))}
                        {Array.from(parallelGroups.entries()).map(([parallelName, cards]) => (
                          <Fragment key={`parallel-flat-${parallelName}`}>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={isMultiYear && yearFilter !== "all" ? 7 : 6} className="py-1.5">
                                <span className="text-xs font-medium text-muted-foreground ml-4">
                                  {parallelName}
                                </span>
                              </TableCell>
                            </TableRow>
                            {cards.map((item) => (
                              <ChecklistItemRow
                                key={item.id}
                                item={item}
                                setInfo={{ year: set.year, brand: set.brand, product_line: set.product_line }}
                                isMultiYear={isMultiYear}
                                selected={selectedIds.has(item.id)}
                                onSelectChange={handleSelectChange}
                                onStatusChange={handleStatusChange}
                                onFieldChange={handleFieldChange}
                                onEdit={handleEditItem}
                              />
                            ))}
                          </Fragment>
                        ))}
                      </>
                    );
                  })()
                )}
              </TableBody>
            </Table>
          </div>

          {filteredAndSorted.length === 0 && items.length > 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No cards match your current filters.
            </p>
          )}
        </>
      )}

      {/* Dialogs */}
      <SetFormDialog
        open={editSetOpen}
        onOpenChange={setEditSetOpen}
        set={set}
        onSuccess={loadData}
      />

      <ImportChecklistDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        setId={set.id}
        isMultiYear={isMultiYear}
        onSuccess={loadData}
      />

      <EditChecklistItemDialog
        open={editItemOpen}
        onOpenChange={setEditItemOpen}
        item={editingItem}
        isMultiYear={isMultiYear}
        onSuccess={loadData}
      />

      <BulkStatusDialog
        open={bulkPasteOpen}
        onOpenChange={setBulkPasteOpen}
        items={items}
        onSuccess={loadData}
      />

      <ChangeYearDialog
        open={changeYearOpen}
        onOpenChange={setChangeYearOpen}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkYearChange}
      />

      {set.cover_image_url && (
        <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
          <DialogContent className="w-auto max-w-[90vw] p-2">
            <DialogTitle className="sr-only">{set.name} cover image</DialogTitle>
            <img
              src={set.cover_image_url}
              alt={`${set.name} cover`}
              className="h-[500px] w-auto rounded"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
