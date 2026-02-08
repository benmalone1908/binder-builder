import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SetDetailContent } from "./SetDetailContent";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface SetDetailSheetProps {
  setId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetDetailSheet({ setId, open, onOpenChange }: SetDetailSheetProps) {
  if (!setId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[60vw] sm:max-w-none overflow-y-auto"
      >
        <VisuallyHidden>
          <SheetTitle>Set Details</SheetTitle>
        </VisuallyHidden>
        <SetDetailContent
          setId={setId}
          isCompact={true}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
