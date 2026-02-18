import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, CheckCircle2, Timer, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ChecklistItem = Tables<"checklist_items">;
type SetRow = Tables<"sets">;

interface SearchResult extends ChecklistItem {
  set: SetRow;
}

interface GroupedResults {
  set: SetRow;
  cards: ChecklistItem[];
}

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToSet: (setId: string) => void;
  collectionId?: string | null;
  collectionName?: string | null;
}

export function GlobalSearchModal({
  open,
  onOpenChange,
  onNavigateToSet,
  collectionId,
  collectionName,
}: GlobalSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<GroupedResults[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  async function handleSearch() {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setSearched(true);

    const term = searchTerm.toLowerCase();

    // If collectionId is provided, first get set IDs in that collection
    let setIdsInCollection: string[] | null = null;
    if (collectionId) {
      const { data: setCollections } = await supabase
        .from("user_collection_sets")
        .select("library_set_id")
        .eq("user_collection_id", collectionId);

      setIdsInCollection = setCollections?.map(sc => sc.library_set_id) || [];

      // If no sets in collection, return empty results
      if (setIdsInCollection.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }
    }

    // Query checklist items matching search term
    let query = supabase
      .from("library_checklist_items")
      .select("*, library_sets(*)")
      .or(`card_number.ilike.%${term}%,player_name.ilike.%${term}%,team.ilike.%${term}%,parallel.ilike.%${term}%`);

    // Filter by collection sets if collectionId provided
    if (setIdsInCollection) {
      query = query.in("library_set_id", setIdsInCollection);
    }

    const { data: items, error } = await query;

    if (error) {
      console.error("Search error:", error);
      setLoading(false);
      return;
    }

    // Group results by set
    const grouped = new Map<string, GroupedResults>();

    items?.forEach((item: any) => {
      const setId = item.library_set_id;
      if (!grouped.has(setId)) {
        grouped.set(setId, {
          set: item.library_sets,
          cards: [],
        });
      }
      grouped.get(setId)!.cards.push(item);
    });

    setResults(Array.from(grouped.values()));
    setLoading(false);
  }

  function handleNavigate(setId: string) {
    onNavigateToSet(setId);
    onOpenChange(false);
  }

  async function updateCardStatus(
    cardId: string,
    newStatus: "need" | "pending" | "owned"
  ) {
    const { error } = await supabase
      .from("library_checklist_items")
      .update({ status: newStatus })
      .eq("id", cardId);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    // Update local state
    setResults((prev) =>
      prev.map((group) => ({
        ...group,
        cards: group.cards.map((card) =>
          card.id === cardId ? { ...card, status: newStatus } : card
        ),
      }))
    );

    toast.success("Status updated");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {collectionName ? `Search in ${collectionName}` : "Search All Collections"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by card number, player name, team, or parallel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
              autoFocus
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !searchTerm.trim()}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {loading && (
            <p className="text-center text-muted-foreground py-8">Searching...</p>
          )}

          {!loading && searched && results.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No cards found matching "{searchTerm}"
            </p>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found {results.reduce((acc, r) => acc + r.cards.length, 0)} card(s) across {results.length} set(s)
              </p>

              {results.map((group) => (
                <div key={group.set.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b">
                    <div>
                      <h3 className="font-semibold">{group.set.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.set.year} • {group.set.brand} • {group.set.product_line}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNavigate(group.set.id)}
                      className="gap-2"
                    >
                      Open Set
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="divide-y">
                    {group.cards.map((card) => (
                      <div
                        key={card.id}
                        className="px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                #{card.card_number}
                              </span>
                              <span className="font-semibold">
                                {card.player_name}
                              </span>
                              {card.team && (
                                <span className="text-muted-foreground">
                                  • {card.team}
                                </span>
                              )}
                            </div>
                            {card.parallel && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium">{card.parallel}</span>
                                {card.parallel_print_run && (
                                  <span>/{card.parallel_print_run}</span>
                                )}
                              </div>
                            )}
                            {card.serial_owned && (
                              <div className="text-sm text-muted-foreground">
                                Serial: {card.serial_owned}
                                {card.parallel_print_run && `/${card.parallel_print_run}`}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7",
                                card.status === "owned"
                                  ? "text-green-600 bg-green-100 hover:bg-green-200"
                                  : "text-muted-foreground hover:text-green-600"
                              )}
                              onClick={() => updateCardStatus(card.id, "owned")}
                              title="Have"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7",
                                card.status === "pending"
                                  ? "text-yellow-600 bg-yellow-100 hover:bg-yellow-200"
                                  : "text-muted-foreground hover:text-yellow-600"
                              )}
                              onClick={() => updateCardStatus(card.id, "pending")}
                              title="Pending"
                            >
                              <Timer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7",
                                card.status === "need"
                                  ? "text-red-600 bg-red-100 hover:bg-red-200"
                                  : "text-muted-foreground hover:text-red-600"
                              )}
                              onClick={() => updateCardStatus(card.id, "need")}
                              title="Need"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searched && (
            <div className="text-center text-muted-foreground py-16">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Enter a search term to find cards across all your collections</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
