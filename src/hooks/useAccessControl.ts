import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function useAccessControl() {
  const { hasAccess, profile } = useAuth();
  const navigate = useNavigate();

  const checkAccess = () => {
    if (!hasAccess) {
      toast.error("Your trial has expired. Please subscribe to continue.");
      navigate("/subscription");
      return false;
    }
    return true;
  };

  const daysRemaining = profile?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(profile.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const isTrialing = profile?.subscription_status === "trial";

  return { checkAccess, daysRemaining, isTrialing, hasAccess };
}
