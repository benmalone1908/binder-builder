import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

type SetRow = Tables<"sets">;
type ChecklistItem = Tables<"checklist_items">;

const SET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  insert: "Insert",
  rainbow: "Rainbow",
  multi_year_insert: "Multi-Year Insert",
};

function compareCardNumbers(a: string, b: string): number {
  // Extract prefix and trailing number (e.g. "90AS-12" → prefix="90AS-", num=12)
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

export default function SetDetail() {
  const { id } = useParams<{ id: string }>();
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

  async function loadData() {
    if (!id) return;
    setLoading(true);

    const [setResult, itemsResult] = await Promise.all([
      supabase.from("sets").select("*").eq("id", id).single(),
      supabase.from("checklist_items").select("*").eq("set_id", id),
    ]);

    if (setResult.error) {
      navigate("/");
      return;
    }

    setSet(setResult.data);
    setItems(itemsResult.data || []);
    setSelectedIds(new Set());
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [id]);

  const isMultiYear = set?.set_type === "multi_year_insert";

  const stats = useMemo(() => {
    const total = items.length;
    const owned = items.filter((i) => i.status === "owned").length;
    const pending = items.filter((i) => i.status === "pending").length;
    const need = items.filter((i) => i.status === "need").length;
    return { total, owned, pending, need };
  }, [items]);

  // Get unique years from cards for multi-year sets
  const availableYears = useMemo(() => {
    if (!isMultiYear) return [];
    const years = new Set<number>();
    items.forEach((item) => {
      if (item.year) years.add(item.year);
    });
    return Array.from(years).sort((a, b) => a - b); // Ascending (oldest first)
  }, [items, isMultiYear]);

  // Initialize all years as expanded when they first load
  useEffect(() => {
    if (availableYears.length > 0 && expandedYears.size === 0) {
      setExpandedYears(new Set(availableYears));
    }
  }, [availableYears]);

  // Clean up stale years when cards are moved/deleted
  useEffect(() => {
    const availableSet = new Set(availableYears);

    // Remove stale years from expandedYears
    setExpandedYears((prev) => {
      const cleaned = new Set([...prev].filter((y) => y === null || availableSet.has(y)));
      if (cleaned.size !== prev.size) return cleaned;
      return prev;
    });

    // Reset yearFilter if it points to a year that no longer exists
    if (yearFilter !== "all" && !availableSet.has(yearFilter)) {
      setYearFilter("all");
    }
  }, [availableYears, yearFilter]);

  // Add new year to expanded set when it's created
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

    // Filter by year for multi-year sets
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

  // Group cards by year for display when showing "all" in multi-year sets
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

    // Sort by year ascending (oldest first), with null at the end
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
    // Get the flat list of visible items (handles both grouped and ungrouped views)
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

    // Regular single click
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Cover image */}
        <div className="shrink-0 w-24 h-32 rounded-lg overflow-hidden border bg-muted">
          {set.cover_image_url ? (
            <img
              src={set.cover_image_url}
              alt={`${set.name} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{set.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {!isMultiYear && <span>{set.year}</span>}
            <span>{set.brand}</span>
            <span>{set.product_line}</span>
            <Badge variant="secondary">{SET_TYPE_LABELS[set.set_type] || set.set_type}</Badge>
          </div>
          {set.insert_set_name && (
            <div className="mt-1">
              <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50">
                {set.insert_set_name}
              </Badge>
            </div>
          )}
          {set.notes && (
            <p className="text-sm text-muted-foreground mt-2">{set.notes}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditSetOpen(true)}>
          <Pencil className="h-3 w-3 mr-2" />
          Edit Set
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

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead className="w-24 whitespace-nowrap">Card #</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  {isMultiYear && yearFilter !== "all" && <TableHead className="w-16">Year</TableHead>}
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cardsByYear ? (
                  // Grouped by year with collapsible sections
                  cardsByYear.map((group) => {
                    const isExpanded = expandedYears.has(group.year);
                    const yearLabel = group.year ? String(group.year) : "No Year";
                    const groupStats = {
                      total: group.items.length,
                      owned: group.items.filter((i) => i.status === "owned").length,
                    };
                    return (
                      <>
                        <TableRow
                          key={`year-header-${group.year}`}
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
                          // Split into base cards and parallels
                          const baseCards = group.items.filter((i) => !i.parallel);
                          const parallelCards = group.items.filter((i) => i.parallel);

                          // Group parallels by name
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
                              {/* Base cards */}
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
                              {/* Parallel groups */}
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
                      </>
                    );
                  })
                ) : (
                  // Regular flat list - separate base cards from parallels for multi-year sets
                  (() => {
                    if (!isMultiYear) {
                      // Non-multi-year: simple flat list
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

                    // Multi-year with year filter: separate base cards from parallels
                    const baseCards = filteredAndSorted.filter((i) => !i.parallel);
                    const parallelCards = filteredAndSorted.filter((i) => i.parallel);

                    // Group parallels by name
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
                        {/* Base cards */}
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
                        {/* Parallel groups */}
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
    </div>
  );
}
