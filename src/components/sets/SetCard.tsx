import { MoreVertical, Pencil, Trash2, Layers, Package, Tag, ImageOff, ImagePlus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SetRow = Tables<"sets">;

const SET_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  base: { bg: "bg-slate-50", text: "text-slate-800", border: "border-slate-300", accent: "bg-slate-100" },
  insert: { bg: "bg-sky-50", text: "text-sky-900", border: "border-sky-300", accent: "bg-sky-100" },
  rainbow: { bg: "bg-slate-50", text: "text-slate-800", border: "border-slate-400", accent: "bg-slate-100" },
  multi_year_insert: { bg: "bg-slate-50", text: "text-slate-800", border: "border-slate-400", accent: "bg-slate-100" },
};

const SET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  insert: "Insert",
  rainbow: "Rainbow",
  multi_year_insert: "Multi-Year",
};

interface SetStats {
  total: number;
  owned: number;
  pending: number;
}

interface SetCardProps {
  set: SetRow;
  stats: SetStats;
  onEdit: (set: SetRow) => void;
  onDelete: (set: SetRow) => void;
  onEditImage: (set: SetRow) => void;
  onClick?: () => void;
}

export function SetCard({ set, stats, onEdit, onDelete, onEditImage, onClick }: SetCardProps) {
  const completionPct = stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0;
  const typeStyle = SET_TYPE_COLORS[set.set_type] || SET_TYPE_COLORS.base;

  return (
    <div
      className={`
        relative cursor-pointer group
        rounded-lg overflow-hidden
        border-2 ${typeStyle.border}
        ${typeStyle.bg}
        shadow-sm hover:shadow-lg
        transition-all duration-300 ease-out
        hover:-translate-y-1
      `}
      onClick={onClick}
    >
      {/* Card layout with optional cover image */}
      <div className="flex">
        {/* Cover image thumbnail */}
        <div className={`
          relative shrink-0 w-20
          ${typeStyle.accent}
          border-r ${typeStyle.border}
        `}>
          {set.cover_image_url ? (
            <img
              src={set.cover_image_url}
              alt={`${set.name} cover`}
              className="absolute inset-0 w-full h-full object-contain p-1"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageOff className={`w-6 h-6 ${typeStyle.text} opacity-20`} />
            </div>
          )}
          {/* Year badge overlay */}
          {set.set_type !== "multi_year_insert" && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <span className={`
                inline-flex items-center justify-center
                px-2 py-0.5 rounded
                text-xs font-bold tracking-tight
                bg-white/90 backdrop-blur-sm
                border ${typeStyle.border}
                ${typeStyle.text}
                shadow-sm
              `}>
                {set.year}
              </span>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="px-3 pt-2.5 pb-1.5 flex items-start justify-between gap-2">
            <span className={`
              text-[10px] font-semibold uppercase tracking-widest
              ${typeStyle.text} opacity-60
            `}>
              {SET_TYPE_LABELS[set.set_type] || set.set_type}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`
                    h-6 w-6 shrink-0 rounded-full -mt-1 -mr-1
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-200
                    hover:bg-white/60
                  `}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEditImage(set)}>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {set.cover_image_url ? "Change Image" : "Add Image"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(set)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(set)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Set name */}
          <div className="px-3 pb-1.5">
            <h3 className={`
              text-sm font-bold leading-tight
              ${typeStyle.text}
              line-clamp-2
            `}>
              {set.name}
            </h3>
          </div>

          {/* Metadata pills */}
          <div className="px-3 pb-2 flex flex-wrap items-center gap-1">
            <span className={`
              inline-flex items-center gap-0.5 px-1.5 py-0.5
              text-[10px] font-medium rounded-full
              bg-white/60 backdrop-blur-sm
              ${typeStyle.text}
              border border-white/40
            `}>
              <Tag className="w-2.5 h-2.5" />
              {set.brand}
            </span>
            <span className={`
              inline-flex items-center gap-0.5 px-1.5 py-0.5
              text-[10px] font-medium rounded-full
              bg-white/60 backdrop-blur-sm
              ${typeStyle.text}
              border border-white/40
            `}>
              <Package className="w-2.5 h-2.5" />
              {set.product_line}
            </span>
            {set.insert_set_name && (
              <span className={`
                inline-flex items-center gap-0.5 px-1.5 py-0.5
                text-[10px] font-medium rounded-full
                bg-sky-100/80 backdrop-blur-sm
                text-sky-800
                border border-sky-200
              `}>
                <Layers className="w-2.5 h-2.5" />
                {set.insert_set_name}
              </span>
            )}
          </div>

          {/* Progress footer */}
          <div className={`
            mt-auto px-3 py-2
            bg-white/40 backdrop-blur-sm
            border-t border-white/60
          `}>
            {stats.total > 0 ? (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`text-[10px] font-medium ${typeStyle.text} opacity-60`}>
                    Progress
                  </span>
                  <span className={`text-xs font-bold ${typeStyle.text}`}>
                    {stats.owned}
                    <span className="text-[10px] font-normal opacity-60">/{stats.total}</span>
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/80 overflow-hidden shadow-inner">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out bg-orange-500"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className={`${typeStyle.text} opacity-40`}>
                    {completionPct}%
                  </span>
                  {stats.pending > 0 && (
                    <span className="text-slate-500 font-medium">
                      {stats.pending} pending
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className={`text-[10px] ${typeStyle.text} opacity-50 text-center`}>
                No cards yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
