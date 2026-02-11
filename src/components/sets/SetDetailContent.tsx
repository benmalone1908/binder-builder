import { useState, useEffect, useMemo, useRef, Fragment, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Upload, ImageOff, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
import { NotesDialog } from "@/components/sets/NotesDialog";
import { ImportChecklistDialog } from "@/components/checklist/ImportChecklistDialog";
import { EditChecklistItemDialog } from "@/components/checklist/EditChecklistItemDialog";
import { AddParallelDialog } from "@/components/checklist/AddParallelDialog";
import { SerialNumberDialog } from "@/components/checklist/SerialNumberDialog";
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
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addParallelOpen, setAddParallelOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [changeYearOpen, setChangeYearOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);
  const [serialDialogData, setSerialDialogData] = useState<{
    itemId: string;
    parallel: string | null;
    printRun: string | null;
  } | null>(null);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
  const isRainbow = set?.set_type === "rainbow";

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

    // When searching, show all statuses; otherwise apply status filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (i) =>
          i.card_number.toLowerCase().includes(term) ||
          i.player_name.toLowerCase().includes(term) ||
          (i.team && i.team.toLowerCase().includes(term))
      );
    } else if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }

    if (isMultiYear && yearFilter !== "all") {
      result = result.filter((i) => i.year === yearFilter);
    }

    // Sort by parallel print run (descending) for rainbow sets, otherwise by card number
    if (isRainbow) {
      result.sort((a, b) => {
        // First: Check if manual ordering is set
        const aHasOrder = a.display_order !== null && a.display_order !== undefined;
        const bHasOrder = b.display_order !== null && b.display_order !== undefined;

        // If both have display_order, sort by that
        if (aHasOrder && bHasOrder) {
          return a.display_order! - b.display_order!;
        }

        // If only one has display_order, items with display_order come first
        if (aHasOrder) return -1;
        if (bHasOrder) return 1;

        // Neither has display_order: use automatic sorting
        // Cards without print run (base/unnumbered) come first
        const aHasRun = a.parallel_print_run && a.parallel_print_run.trim();
        const bHasRun = b.parallel_print_run && b.parallel_print_run.trim();

        if (!aHasRun && !bHasRun) return 0;
        if (!aHasRun) return -1; // a (no print run) comes before b
        if (!bHasRun) return 1;  // b (no print run) comes before a

        // Both have print runs - sort descending (largest first)
        const aRun = parseInt(a.parallel_print_run, 10);
        const bRun = parseInt(b.parallel_print_run, 10);
        return bRun - aRun;
      });
    } else {
      result.sort((a, b) => compareCardNumbers(a.card_number, b.card_number));
    }

    return result;
  }, [items, statusFilter, searchTerm, isMultiYear, yearFilter, isRainbow]);

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

  function handleSerialNumberCapture(itemId: string, parallel: string | null, printRun: string | null) {
    console.log('handleSerialNumberCapture called!', { itemId, parallel, printRun });
    setSerialDialogData({ itemId, parallel, printRun });
    setSerialDialogOpen(true);
  }

  console.log('SetDetailContent render - handleSerialNumberCapture exists:', !!handleSerialNumberCapture);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = filteredAndSorted.findIndex((item) => item.id === active.id);
    const newIndex = filteredAndSorted.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedItems = arrayMove(filteredAndSorted, oldIndex, newIndex);

    // Assign display_order to all items (0-indexed)
    const updates = reorderedItems.map((item, index) => ({
      id: item.id,
      display_order: index,
    }));

    // Update database
    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('checklist_items')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      // Refresh data
      await loadData();
      toast.success('Order updated');
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order');
    }
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
          {isRainbow && items.length > 0 && (
            <div className={cn(
              "mt-2",
              isCompact ? "text-xs" : "text-sm"
            )}>
              <span className="font-medium">#{items[0].card_number} - {items[0].player_name}</span>
              {items[0].team && <span className="text-muted-foreground ml-2">• {items[0].team}</span>}
            </div>
          )}
          {!isCompact && (
            <button
              onClick={() => setNotesDialogOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1.5 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="underline decoration-dotted underline-offset-2">
                {set.notes ? "View notes" : "Add notes"}
              </span>
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotesDialogOpen(true)}
            title="Notes"
          >
            <FileText className="h-3 w-3" />
          </Button>
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
            isRainbow={isRainbow}
            onClearSelection={() => setSelectedIds(new Set())}
            onAddCard={() => setAddParallelOpen(true)}
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
            <Table className={cn(isCompact ? "min-w-[600px]" : "", "table-fixed")}>
              <TableHeader>
                <TableRow>
                  {isRainbow && <TableHead className="w-8"></TableHead>}
                  <TableHead className={isCompact ? "w-8" : "w-10"}>
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  {!isRainbow && <TableHead className={cn("whitespace-nowrap", isCompact ? "w-16" : "w-20")}>Card #</TableHead>}
                  {!isRainbow && <TableHead className={isCompact ? "w-[35%]" : "w-[40%]"}>Player</TableHead>}
                  {!isRainbow && <TableHead className={isCompact ? "w-24" : "w-32"}>Team</TableHead>}
                  {isRainbow && <TableHead className="w-64">Parallel</TableHead>}
                  {isMultiYear && yearFilter !== "all" && (
                    <TableHead className={isCompact ? "w-12" : "w-14"}>Year</TableHead>
                  )}
                  <TableHead className={isRainbow ? "w-28" : (isCompact ? "w-20" : "w-24")}>Serial #</TableHead>
                  <TableHead className={isCompact ? "w-24" : "w-28"}>Status</TableHead>
                  <TableHead className={isCompact ? "w-14" : "w-16"}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRainbow && !cardsByYear ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={filteredAndSorted.map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredAndSorted.map((item) => (
                        <ChecklistItemRow
                          key={item.id}
                          item={item}
                          setInfo={{ year: set.year, brand: set.brand, product_line: set.product_line }}
                          isMultiYear={false}
                          isRainbow={isRainbow}
                          isDraggable={true}
                          selected={selectedIds.has(item.id)}
                          onSelectChange={handleSelectChange}
                          onStatusChange={handleStatusChange}
                          onFieldChange={handleFieldChange}
                          onEdit={handleEditItem}
                          onSerialNumberCapture={handleSerialNumberCapture}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : cardsByYear ? (
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
                          <TableCell colSpan={isRainbow ? 5 : 7} className="py-2">
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
                                  isRainbow={isRainbow}
                                  selected={selectedIds.has(item.id)}
                                  onSelectChange={handleSelectChange}
                                  onStatusChange={handleStatusChange}
                                  onFieldChange={handleFieldChange}
                                  onEdit={handleEditItem}
                                  onSerialNumberCapture={handleSerialNumberCapture}
                                />
                              ))}
                              {Array.from(parallelGroups.entries()).map(([parallelName, cards]) => (
                                <Fragment key={`parallel-${group.year}-${parallelName}`}>
                                  <TableRow className="bg-muted/30">
                                    <TableCell colSpan={isRainbow ? 5 : 7} className="py-1.5">
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
                                      onSerialNumberCapture={handleSerialNumberCapture}
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
                          isRainbow={isRainbow}
                          selected={selectedIds.has(item.id)}
                          onSelectChange={handleSelectChange}
                          onStatusChange={handleStatusChange}
                          onFieldChange={handleFieldChange}
                          onEdit={handleEditItem}
                          onSerialNumberCapture={handleSerialNumberCapture}
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
                            isRainbow={isRainbow}
                            selected={selectedIds.has(item.id)}
                            onSelectChange={handleSelectChange}
                            onStatusChange={handleStatusChange}
                            onFieldChange={handleFieldChange}
                            onEdit={handleEditItem}
                            onSerialNumberCapture={handleSerialNumberCapture}
                          />
                        ))}
                        {Array.from(parallelGroups.entries()).map(([parallelName, cards]) => (
                          <Fragment key={`parallel-flat-${parallelName}`}>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={isMultiYear && yearFilter !== "all" ? (isRainbow ? 6 : 8) : (isRainbow ? 5 : 7)} className="py-1.5">
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
                                onSerialNumberCapture={handleSerialNumberCapture}
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

      <NotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        setId={set.id}
        setName={set.name}
        initialNotes={set.notes}
        onSuccess={loadData}
      />

      <ImportChecklistDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        setId={set.id}
        setType={set?.set_type}
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

      {isRainbow && items.length > 0 && (
        <AddParallelDialog
          open={addParallelOpen}
          onOpenChange={setAddParallelOpen}
          setId={set.id}
          cardNumber={items[0].card_number}
          playerName={items[0].player_name}
          team={items[0].team}
          onSuccess={loadData}
        />
      )}

      {serialDialogData && (
        <SerialNumberDialog
          open={serialDialogOpen}
          onOpenChange={setSerialDialogOpen}
          itemId={serialDialogData.itemId}
          parallel={serialDialogData.parallel}
          printRun={serialDialogData.printRun}
          onSuccess={loadData}
        />
      )}

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
