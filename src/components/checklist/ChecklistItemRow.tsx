import { useState, useRef, useEffect } from "react";
import { Image, Pencil, CheckCircle2, Ban, Timer, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ChecklistItem = Tables<"checklist_items">;

interface SetInfo {
  year: number;
  brand: string;
  product_line: string;
}

interface ChecklistItemRowProps {
  item: ChecklistItem;
  setInfo: SetInfo;
  isMultiYear?: boolean;
  isRainbow?: boolean;
  isDraggable?: boolean;
  selected: boolean;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  onStatusChange: (id: string, newStatus: "need" | "pending" | "owned") => void;
  onFieldChange: (id: string, field: string, value: string) => void;
  onEdit: (item: ChecklistItem) => void;
  onSerialNumberCapture?: (itemId: string, parallel: string | null, printRun: string | null) => void;
}

type EditingField = "card_number" | "player_name" | "team" | null;

export function ChecklistItemRow({
  item,
  setInfo,
  isMultiYear,
  isRainbow,
  isDraggable = false,
  selected,
  onSelectChange,
  onStatusChange,
  onFieldChange,
  onEdit,
  onSerialNumberCapture,
}: ChecklistItemRowProps) {
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  async function setStatus(newStatus: "need" | "pending" | "owned") {
    if (item.status === newStatus) return;

    if (newStatus === "owned" && item.parallel_print_run && onSerialNumberCapture) {
      onSerialNumberCapture(item.id, item.parallel, item.parallel_print_run);
      return;
    }

    const { error } = await supabase
      .from("checklist_items")
      .update({ status: newStatus })
      .eq("id", item.id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    onStatusChange(item.id, newStatus);
    toast.success(`Card ${newStatus}`);
  }

  function cycleStatus() {
    const statusOrder: Array<"need" | "pending" | "owned"> = ["need", "pending", "owned"];
    const currentIndex = statusOrder.indexOf(item.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    setStatus(nextStatus);
  }

  function startEditing(field: EditingField) {
    if (!field) return;
    setEditingField(field);
    setEditValue(String(item[field] || ""));
  }

  async function commitEdit() {
    if (!editingField) return;

    const trimmed = editValue.trim();
    if (trimmed === (item[editingField] || "")) {
      setEditingField(null);
      return;
    }

    const { error } = await supabase
      .from("checklist_items")
      .update({ [editingField]: trimmed || null })
      .eq("id", item.id);

    if (error) {
      toast.error("Failed to save");
      return;
    }

    onFieldChange(item.id, editingField, trimmed);
    setEditingField(null);
    toast.success("Updated");
  }

  function cancelEdit() {
    setEditingField(null);
  }

  function openImageSearch() {
    // For multi-year sets, use the card's year; otherwise use the set's year
    const year = isMultiYear && item.year ? item.year : setInfo.year;
    const query = `${year} ${setInfo.brand} ${setInfo.product_line} ${item.player_name} #${item.card_number} baseball card`;
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`, "_blank");
  }

  const allStatuses = [
    {
      status: "need" as const,
      Icon: Ban,
      title: "Mark as Need",
      activeClass: "text-muted-foreground bg-muted/50",
      inactiveClass: "text-muted-foreground/20 hover:text-muted-foreground/60",
    },
    {
      status: "pending" as const,
      Icon: Timer,
      title: "Mark as Pending",
      activeClass: "text-amber-600 bg-amber-50",
      inactiveClass: "text-amber-600/20 hover:text-amber-600/60",
    },
    {
      status: "owned" as const,
      Icon: CheckCircle2,
      title: "Mark as Owned",
      activeClass: "text-[#F97316] bg-[#F97316]/10",
      inactiveClass: "text-[#F97316]/20 hover:text-[#F97316]/60",
    },
  ];

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "group hover:bg-muted/40 transition-colors border-b border-border/40",
        selected && "bg-accent/30",
        isDragging && "opacity-50"
      )}
    >
      {/* Drag handle for rainbow sets */}
      {isRainbow && isDraggable && (
        <TableCell className="w-6 py-1 px-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing opacity-30 hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </TableCell>
      )}

      {/* Checkbox */}
      <TableCell className="py-1 px-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => {
            const event = window.event as MouseEvent;
            onSelectChange(item.id, !!checked, event?.shiftKey || false);
          }}
          className="h-3.5 w-3.5"
        />
      </TableCell>

      {/* Card Number (non-rainbow) */}
      {!isRainbow && (
        <TableCell className="py-1 px-2">
          {editingField === "card_number" ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="h-6 px-1.5 text-xs"
            />
          ) : (
            <button
              onClick={() => startEditing("card_number")}
              className="text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              {item.card_number}
            </button>
          )}
        </TableCell>
      )}

      {/* Player Name (non-rainbow) */}
      {!isRainbow && (
        <TableCell className="py-1 px-2">
          {editingField === "player_name" ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="h-6 px-1.5 text-xs"
            />
          ) : (
            <button
              onClick={() => startEditing("player_name")}
              title={item.player_name}
              className="text-[13px] font-medium text-[#0F2A44] hover:text-[#1F4E79] transition-colors truncate w-full text-left"
            >
              {item.player_name}
            </button>
          )}
        </TableCell>
      )}

      {/* Team (non-rainbow) */}
      {!isRainbow && (
        <TableCell className="py-1 px-2">
          {editingField === "team" ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="h-6 px-1.5 text-xs"
            />
          ) : (
            <button
              onClick={() => startEditing("team")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate w-full text-left"
            >
              {item.team || "—"}
            </button>
          )}
        </TableCell>
      )}

      {/* Parallel (rainbow only) */}
      {isRainbow && (
        <TableCell className="py-1 px-2">
          <button
            onClick={() => onEdit(item)}
            title={`${item.parallel || "Base"}${item.parallel_print_run ? ` /${item.parallel_print_run}` : ""}`}
            className="text-[13px] font-medium text-[#0F2A44] hover:text-[#1F4E79] transition-colors truncate w-full text-left"
          >
            {item.parallel || "Base"}
            {item.parallel_print_run && (
              <span className="text-muted-foreground ml-1">
                /{item.parallel_print_run}
              </span>
            )}
          </button>
        </TableCell>
      )}

      {/* Year (multi-year only when not in year filter mode) */}
      {isMultiYear && (
        <TableCell className="py-1 px-2">
          <span className="text-xs text-muted-foreground">{item.year || "—"}</span>
        </TableCell>
      )}

      {/* Serial Number (rainbow only) */}
      {isRainbow && (
        <TableCell className="py-1 px-2 text-right" style={{ paddingRight: '256px' }}>
          {item.parallel_print_run ? (
            <button
              onClick={() => onSerialNumberCapture?.(item.id, item.parallel, item.parallel_print_run)}
              className={cn(
                "text-xs font-mono font-medium transition-colors",
                item.serial_owned
                  ? "text-[#F97316] hover:text-[#EA580C]"
                  : "text-muted-foreground/40 hover:text-muted-foreground"
              )}
              title="Click to capture/update serial number"
            >
              {item.serial_owned || "—"}/{item.parallel_print_run}
            </button>
          ) : item.serial_owned ? (
            <button
              onClick={() => onSerialNumberCapture?.(item.id, item.parallel, item.parallel_print_run)}
              className="text-xs font-mono text-[#F97316] font-medium hover:text-[#EA580C] transition-colors"
              title="Click to update serial number"
            >
              {item.serial_owned}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          )}
        </TableCell>
      )}

      {/* Status Icons - All Three */}
      <TableCell className={cn("py-1", isRainbow ? "px-4" : "px-1")}>
        <div className="flex items-center gap-0.5">
          {allStatuses.map(({ status, Icon, title, activeClass, inactiveClass }) => {
            const isActive = item.status === status;
            return (
              <button
                key={status}
                onClick={() => setStatus(status)}
                title={title}
                className={cn(
                  "inline-flex items-center justify-center w-6 h-6 rounded transition-all",
                  isActive ? activeClass : inactiveClass,
                  "hover:scale-110"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="py-1 px-2 text-right">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={openImageSearch}
            title="Search for card image"
            className="h-6 w-6 p-0"
          >
            <Image className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(item)}
            className="h-6 w-6 p-0"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
