import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield, Trash2, Crown, Search, RefreshCw, AlertTriangle, ArrowLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string;
  subscription_status: string;
  subscription_end_date: string | null;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const callAdmin = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    []
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdmin({ action: "list" });
      setUsers(data.users || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [callAdmin]);

  useEffect(() => {
    if (!authLoading && !adminLoading && isAdmin) {
      fetchUsers();
    }
  }, [authLoading, adminLoading, isAdmin, fetchUsers]);

  // Redirect non-admin
  if (!authLoading && !adminLoading && (!user || !isAdmin)) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
          <Button onClick={() => navigate("/app")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to App
          </Button>
        </div>
      </div>
    );
  }

  if (authLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await callAdmin({ action: "delete_user", user_id: deleteTarget.id });
      toast({ title: "User deleted", description: deleteTarget.email });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleUpgrade = async (u: AdminUser, status: string, days = 30) => {
    try {
      await callAdmin({
        action: "update_subscription",
        user_id: u.id,
        status,
        days,
      });
      toast({ title: "Updated", description: `${u.email} → ${status}` });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Suspicious: no sign in for 30+ days after creation, or multiple accounts from same pattern
  const now = new Date();
  const isSuspicious = (u: AdminUser) => {
    if (!u.last_sign_in_at) return true; // never signed in
    const created = new Date(u.created_at);
    const lastSign = new Date(u.last_sign_in_at);
    const daysSinceCreation = (now.getTime() - created.getTime()) / 86400000;
    const daysSinceLogin = (now.getTime() - lastSign.getTime()) / 86400000;
    // Created >7 days ago but never logged in again, or not logged in for 60+ days
    return daysSinceCreation > 7 && daysSinceLogin > 60;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Admin Control Panel</h1>
          <Badge variant="outline" className="ml-2">{filtered.length} users</Badge>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-[240px] h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className={isSuspicious(u) ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.email}</p>
                      {u.display_name && (
                        <p className="text-xs text-muted-foreground">{u.display_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        u.subscription_status === "active" || u.subscription_status === "pro"
                          ? "default"
                          : "secondary"
                      }
                      className={
                        u.subscription_status === "active" || u.subscription_status === "pro"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : ""
                      }
                    >
                      {u.subscription_status === "active" || u.subscription_status === "pro"
                        ? "PRO"
                        : u.subscription_status}
                    </Badge>
                    {u.subscription_end_date && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        exp: {new Date(u.subscription_end_date).toLocaleDateString()}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {isSuspicious(u) && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                        <AlertTriangle className="h-3 w-3" /> Suspicious
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.subscription_status === "free" || u.subscription_status === "expired" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          onClick={() => handleUpgrade(u, "active", 30)}
                        >
                          <Crown className="h-3 w-3 mr-1" /> Upgrade
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleUpgrade(u, "free")}
                        >
                          Downgrade
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(u)}
                        disabled={u.email === "basoukkas.pnup09@gmail.com"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {loading ? "Loading..." : "No users found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteTarget?.email}</strong>? This removes all their data and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
