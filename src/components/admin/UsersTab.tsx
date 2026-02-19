import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Shield, ShieldOff } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  trial_ends_at: string | null;
  subscription_status: string;
  subscription_tier: string;
  created_at: string;
}

export function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [setCounts, setSetCounts] = useState<Map<string, number>>(new Map());

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load users: " + error.message);
      setLoading(false);
      return;
    }

    setUsers(data || []);

    // Load set counts per user
    const { data: userSets } = await supabase
      .from("user_sets")
      .select("user_id");

    if (userSets) {
      const counts = new Map<string, number>();
      for (const row of userSets) {
        counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
      }
      setSetCounts(counts);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateStatus(userId: string, status: string) {
    const updates: Record<string, unknown> = {
      subscription_status: status,
      updated_at: new Date().toISOString(),
    };

    // If setting to active, clear trial_ends_at (they're paid now)
    if (status === "active") {
      updates.trial_ends_at = null;
    }

    const { error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      toast.error("Failed to update: " + error.message);
      return;
    }

    toast.success(`Status updated to ${status}`);
    loadUsers();
  }

  async function extendTrial(userId: string, days: number) {
    const newEnd = new Date();
    newEnd.setDate(newEnd.getDate() + days);

    const { error } = await supabase
      .from("user_profiles")
      .update({
        trial_ends_at: newEnd.toISOString(),
        subscription_status: "trial",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to extend trial: " + error.message);
      return;
    }

    toast.success(`Trial extended by ${days} days`);
    loadUsers();
  }

  async function toggleAdmin(userId: string, currentIsAdmin: boolean) {
    const { error } = await supabase
      .from("user_profiles")
      .update({
        is_admin: !currentIsAdmin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to update: " + error.message);
      return;
    }

    toast.success(currentIsAdmin ? "Admin revoked" : "Admin granted");
    loadUsers();
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getTrialStatus(user: UserProfile) {
    if (user.subscription_status === "active") return null;
    if (user.subscription_status !== "trial" || !user.trial_ends_at) return null;
    const diff = new Date(user.trial_ends_at).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "expired";
    return `${days}d left`;
  }

  const filteredUsers = searchTerm
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : users;

  if (loading) {
    return <p className="text-muted-foreground">Loading users...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-28">Trial</TableHead>
              <TableHead className="w-16 text-center">Sets</TableHead>
              <TableHead className="w-24">Joined</TableHead>
              <TableHead className="w-64">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const trialStatus = getTrialStatus(user);
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{user.email}</span>
                        {user.is_admin && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            Admin
                          </Badge>
                        )}
                      </div>
                      {user.full_name && (
                        <span className="text-xs text-muted-foreground">{user.full_name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.subscription_status === "active"
                          ? "default"
                          : user.subscription_status === "trial"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {user.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.subscription_status === "active" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : trialStatus === "expired" ? (
                      <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                    ) : trialStatus ? (
                      <span className="text-xs text-muted-foreground">{trialStatus}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm">{setCounts.get(user.id) || 0}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(user.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={user.subscription_status}
                        onValueChange={(v) => updateStatus(user.id, v)}
                      >
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Paid</SelectItem>
                          <SelectItem value="canceled">Canceled</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                      {user.subscription_status === "trial" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => extendTrial(user.id, 14)}
                        >
                          +14 days
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => toggleAdmin(user.id, user.is_admin)}
                        title={user.is_admin ? "Revoke admin" : "Grant admin"}
                      >
                        {user.is_admin ? (
                          <ShieldOff className="h-3.5 w-3.5" />
                        ) : (
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
