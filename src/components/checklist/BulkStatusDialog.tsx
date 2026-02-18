import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ChecklistItem = Tables<"checklist_items">;
type CardStatus = "need" | "pending" | "owned";

interface MatchResult {
  card_number: string;
  matched: ChecklistItem | null;
}

interface BulkStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ChecklistItem[];
  onSuccess: () => void;
}

export function BulkStatusDialog({
  open,
  onOpenChange,
  items,
  onSuccess,
}: BulkStatusDialogProps) {
  const [rawText, setRawText] = useState("");
  const [targetStatus, setTargetStatus] = useState<CardStatus>("owned");
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [updating, setUpdating] = useState(false);

  function handlePreview() {
    const cardNumbers = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Extract just the card number (first token before space)
        const spaceIdx = line.indexOf(" ");
        return spaceIdx === -1 ? line : line.substring(0, spaceIdx);
      });

    const itemsByNumber = new Map<string, ChecklistItem>();
    for (const item of items) {
      itemsByNumber.set(item.card_number.toLowerCase(), item);
    }

    const results: MatchResult[] = cardNumbers.map((num) => ({
      card_number: num,
      matched: itemsByNumber.get(num.toLowerCase()) || null,
    }));

    setMatches(results);
  }

  async function handleApply() {
    if (!matches) return;

    const toUpdate = matches
      .filter((m) => m.matched && m.matched.status !== targetStatus)
      .map((m) => m.matched!.id);

    if (toUpdate.length === 0) {
      toast.info("No cards need updating");
      return;
    }

    setUpdating(true);

    const { error } = await supabase
      .from("library_checklist_items")
      .update({ status: targetStatus })
      .in("id", toUpdate);

    if (error) {
      toast.error("Failed to update: " + error.message);
      setUpdating(false);
      return;
    }

    toast.success(`Updated ${toUpdate.length} cards to "${targetStatus}"`);
    setUpdating(false);
    handleClose(false);
    onSuccess();
  }

  function handleClose(open: boolean) {
    if (!open) {
      setRawText("");
      setMatches(null);
    }
    onOpenChange(open);
  }

  const matchedCount = matches?.filter((m) => m.matched).length || 0;
  const unmatchedCount = matches?.filter((m) => !m.matched).length || 0;
  const alreadyCorrect =
    matches?.filter((m) => m.matched && m.matched.status === targetStatus).length || 0;
  const willUpdate = matchedCount - alreadyCorrect;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Status Update</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Set status to:</span>
            <Select
              value={targetStatus}
              onValueChange={(v) => {
                setTargetStatus(v as CardStatus);
                setMatches(null);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="need">Need</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="owned">Have</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!matches ? (
            <>
              <p className="text-sm text-muted-foreground">
                Paste card numbers below (one per line). You can paste full lines — only the
                card number (first value) will be used for matching.
              </p>
              <Textarea
                placeholder={"577\n581\n599\n627"}
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="text-sm flex-1"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePreview} disabled={!rawText.trim()}>
                  Preview
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{matchedCount} matched</Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="destructive">{unmatchedCount} not found</Badge>
                )}
                {alreadyCorrect > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {alreadyCorrect} already "{targetStatus}"
                  </span>
                )}
                {willUpdate > 0 && (
                  <span className="text-sm font-medium">
                    {willUpdate} will be updated
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Card #</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="w-24">Current</TableHead>
                      <TableHead className="w-16">Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((m, idx) => (
                      <TableRow
                        key={idx}
                        className={!m.matched ? "bg-destructive/10" : ""}
                      >
                        <TableCell>{m.card_number}</TableCell>
                        <TableCell>
                          {m.matched ? m.matched.player_name : "—"}
                        </TableCell>
                        <TableCell>
                          {m.matched ? (
                            <span className="text-sm">{m.matched.status}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {m.matched ? (
                            <span className="text-green-600 text-sm">Yes</span>
                          ) : (
                            <span className="text-destructive text-sm">No</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMatches(null)}>
                  Back
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={willUpdate === 0 || updating}
                >
                  {updating
                    ? "Updating..."
                    : `Update ${willUpdate} Cards to "${targetStatus}"`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
