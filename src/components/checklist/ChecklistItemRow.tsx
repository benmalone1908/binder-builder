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

    console.log('setStatus called:', {
      newStatus,
      hasPrintRun: !!item.parallel_print_run,
      printRun: item.parallel_print_run,
      hasCallback: !!onSerialNumberCapture,
    });

    // If marking as owned and card has a print run, prompt for serial number
    if (newStatus === "owned" && item.parallel_print_run && onSerialNumberCapture) {
      console.log('Opening serial number dialog');
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
  }

  function startEditing(field: EditingField) {
    if (!field) return;
    const currentValue = field === "team" ? (item[field] || "") : item[field];
    setEditValue(currentValue);
    setEditingField(field);
  }

  async function saveEdit() {
    if (!editingField) return;

    const originalValue = editingField === "team" ? (item[editingField] || "") : item[editingField];

    // Don't save if unchanged
    if (editValue === originalValue) {
      setEditingField(null);
      return;
    }

    // Validate required fields
    if ((editingField === "card_number" || editingField === "player_name") && !editValue.trim()) {
      toast.error(`${editingField === "card_number" ? "Card #" : "Player name"} cannot be empty`);
      setEditValue(originalValue);
      setEditingField(null);
      return;
    }

    const updateData: Record<string, string | null> = {
      [editingField]: editingField === "team" ? (editValue.trim() || null) : editValue.trim(),
    };

    const { error } = await supabase
      .from("checklist_items")
      .update(updateData)
      .eq("id", item.id);

    if (error) {
      toast.error("Failed to update");
      setEditingField(null);
      return;
    }

    onFieldChange(item.id, editingField, editValue.trim());
    setEditingField(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      setEditingField(null);
    }
  }

  function openImageSearch() {
    // For multi-year sets, use the card's year; otherwise use the set's year
    const year = isMultiYear && item.year ? item.year : setInfo.year;
    const query = `${year} ${setInfo.brand} ${setInfo.product_line} ${item.player_name} #${item.card_number} baseball card`;
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`, "_blank");
  }

  function renderEditableCell(field: "card_number" | "player_name" | "team", className?: string) {
    const value = field === "team" ? (item[field] || "—") : item[field];

    if (editingField === field) {
      return (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm"
        />
      );
    }

    return (
      <span
        className={cn("cursor-pointer hover:bg-accent/50 px-1 -mx-1 rounded", className)}
        onClick={() => startEditing(field)}
      >
        {value}
      </span>
    );
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        selected ? "bg-accent/50" : "",
        isDragging && "opacity-50"
      )}
    >
      {isDraggable && (
        <TableCell className="w-8 py-1.5 cursor-grab active:cursor-grabbing">
          <div {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </TableCell>
      )}
      <TableCell className="w-10 py-1.5">
        <Checkbox
          checked={selected}
          onClick={(e) => onSelectChange(item.id, !selected, e.shiftKey)}
        />
      </TableCell>
      {!isRainbow && (
        <TableCell className="w-24 whitespace-nowrap py-1.5">
          {renderEditableCell("card_number")}
        </TableCell>
      )}
      {!isRainbow && (
        <>
          <TableCell className="font-medium py-1.5">
            {renderEditableCell("player_name")}
          </TableCell>
          <TableCell className="text-muted-foreground py-1.5">
            {renderEditableCell("team")}
          </TableCell>
        </>
      )}
      {isRainbow && (
        <TableCell className="font-medium py-1.5">
          {item.parallel || "—"}
        </TableCell>
      )}
      {isMultiYear && (
        <TableCell className="text-muted-foreground py-1.5">
          {item.year || "—"}
        </TableCell>
      )}
      <TableCell className="text-muted-foreground py-1.5 text-sm">
        {item.serial_owned && item.parallel_print_run
          ? `${item.serial_owned}/${item.parallel_print_run}`
          : item.serial_owned
          ? item.serial_owned
          : item.parallel_print_run
          ? `—/${item.parallel_print_run}`
          : "—"}
      </TableCell>
      <TableCell className="py-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              item.status === "owned"
                ? "text-green-600 bg-green-100 hover:bg-green-200"
                : "text-muted-foreground hover:text-green-600"
            )}
            onClick={() => setStatus("owned")}
            title="Have"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              item.status === "pending"
                ? "text-yellow-600 bg-yellow-100 hover:bg-yellow-200"
                : "text-muted-foreground hover:text-yellow-600"
            )}
            onClick={() => setStatus("pending")}
            title="Pending"
          >
            <Timer className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              item.status === "need"
                ? "text-red-600 bg-red-100 hover:bg-red-200"
                : "text-muted-foreground hover:text-red-600"
            )}
            onClick={() => setStatus("need")}
            title="Need"
          >
            <Ban className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={openImageSearch}
            title="Search for card image"
          >
            <Image className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
