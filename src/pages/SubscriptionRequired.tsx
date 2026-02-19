import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SubscriptionRequired() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const trialExpired =
    profile?.subscription_status === "trial" &&
    profile.trial_ends_at &&
    new Date(profile.trial_ends_at) <= new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center gap-1 mb-4">
            <img src="/image2.png" alt="Bindered mascot" style={{ height: "60px" }} />
            <img src="/image.png" alt="Bindered logo" style={{ height: "55px" }} />
          </div>
          <CardTitle className="text-2xl">
            {trialExpired ? "Trial Expired" : "Access Required"}
          </CardTitle>
          <CardDescription className="mt-2">
            {trialExpired
              ? "Your 14-day free trial has ended. Please contact the administrator to continue using Bindered."
              : "Your account doesn't currently have access. Please contact the administrator."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {profile?.email && (
            <p className="text-sm text-muted-foreground">
              Signed in as {profile.email}
            </p>
          )}
          <Button variant="outline" onClick={async () => { await signOut(); navigate("/login"); }} className="w-full max-w-[200px]">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
