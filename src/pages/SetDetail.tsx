import { useParams } from "react-router-dom";
import { SetDetailContent } from "@/components/sets/SetDetailContent";

export default function SetDetail() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="text-muted-foreground">Set not found.</p>;
  }

  return <SetDetailContent setId={id} isCompact={false} />;
}
