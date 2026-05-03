import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Loader2,
  UserMinus,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Trash2,
  Timer,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase, EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";

interface DeletionRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "auto_deleted";
  admin_response: string | null;
  created_at: string;
  expires_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

interface DeletionRequestsManagerProps {
  adminPassword: string;
}

async function callAccountDeletionFunction<T = any>(
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${EDGE_FUNCTIONS_URL}/process-account-deletion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return await response.json();
}

export function DeletionRequestsManager({ adminPassword }: DeletionRequestsManagerProps) {
  const { toast } = useEnhancedToast();
  
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [adminResponse, setAdminResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingExpired, setIsProcessingExpired] = useState(false);

  // Fetch deletion requests
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("account_deletion_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data || []) as DeletionRequest[]);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Gagal memuat permintaan",
        description: error.message,
        variant: "error"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Initial fetch and setup realtime subscription
  useEffect(() => {
    fetchRequests();

    // Realtime subscription for deletion requests
    const channel = supabase
      .channel("deletion_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_deletion_requests" },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  // Process a request (approve/reject)
  const handleProcessRequest = async () => {
    if (!selectedRequest) return;

    if (!adminPassword) {
      toast({
        title: "Password diperlukan",
        description: "Isi Password Backend di tab Kredensial untuk memproses penghapusan.",
        variant: "error",
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (actionType === "approve") {
        // Semua penghapusan (DB + auth) dilakukan di backend function menggunakan service role.
        const result = await callAccountDeletionFunction({
          action: "approve",
          requestId: selectedRequest.id,
          adminPassword,
          adminResponse: adminResponse || "Disetujui oleh admin",
        });

        if (!result?.success) throw new Error(result?.error || "Gagal menghapus akun");

        toast({
          title: "Akun Berhasil Dihapus",
          description: `Akun ${selectedRequest.user_email} dan data terkait telah dihapus via backend.`,
          variant: "success",
        });
      } else {
        const result = await callAccountDeletionFunction({
          action: "reject",
          requestId: selectedRequest.id,
          adminPassword,
          adminResponse: adminResponse || "Ditolak oleh admin",
        });

        if (!result?.success) throw new Error(result?.error || "Gagal menolak permintaan");

        toast({
          title: "Permintaan Ditolak",
          description: `Permintaan dari ${selectedRequest.user_email} telah ditolak.`,
        });
      }

      setShowActionDialog(false);
      setSelectedRequest(null);
      setAdminResponse("");
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Gagal memproses",
        description: error.message,
        variant: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process all expired requests
  const handleProcessExpired = async () => {
    setIsProcessingExpired(true);
    try {
      if (!adminPassword) {
        throw new Error("Password admin diperlukan");
      }

      const result = await callAccountDeletionFunction({
        action: "process_expired",
        adminPassword,
      });

      if (!result?.success) throw new Error(result?.error || "Gagal memproses permintaan kadaluarsa");

      const processedCount = Array.isArray(result?.results) ? result.results.length : 0;
      
      toast({
        title: "Permintaan Kadaluarsa Diproses",
        description: processedCount > 0 
          ? `${processedCount} permintaan diproses via backend.`
          : "Tidak ada permintaan yang perlu diproses.",
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Gagal memproses",
        description: error.message,
        variant: "error"
      });
    } finally {
      setIsProcessingExpired(false);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Kadaluarsa";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}j ${minutes}m lagi`;
    return `${minutes}m lagi`;
  };

  // Get status badge
  const getStatusBadge = (status: DeletionRequest["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
      case "approved":
        return <Badge variant="destructive" className="gap-1"><CheckCircle2 className="w-3 h-3" />Disetujui</Badge>;
      case "rejected":
        return <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3" />Ditolak</Badge>;
      case "auto_deleted":
        return <Badge variant="destructive" className="gap-1 bg-orange-500"><Timer className="w-3 h-3" />Otomatis</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-destructive" />
              Permintaan Hapus Akun
            </CardTitle>
            <CardDescription className="mt-1">
              Kelola permintaan penghapusan akun dari pengguna
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleProcessExpired}
              disabled={isProcessingExpired}
            >
              {isProcessingExpired ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Timer className="w-4 h-4 mr-1" />
                  Proses Kadaluarsa
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRequests}
              disabled={isLoading}
            >
              <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pending Requests */}
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Menunggu Persetujuan
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-auto">{pendingRequests.length}</Badge>
            )}
          </h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <UserMinus className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Tidak ada permintaan menunggu</p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{request.user_email}</p>
                        {request.user_name && (
                          <p className="text-xs text-muted-foreground">{request.user_name}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Dibuat: {new Date(request.created_at).toLocaleString("id-ID")}</span>
                        </div>
                        {request.reason && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            "{request.reason}"
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                          <Timer className="w-3 h-3 mr-1" />
                          {getTimeRemaining(request.expires_at)}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType("approve");
                              setShowActionDialog(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Hapus
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType("reject");
                              setShowActionDialog(true);
                            }}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Tolak
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator />

        {/* Processed Requests */}
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            Riwayat
            {processedRequests.length > 0 && (
              <Badge variant="outline" className="ml-auto">{processedRequests.length}</Badge>
            )}
          </h3>
          
          {processedRequests.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">
              Belum ada riwayat
            </p>
          ) : (
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {processedRequests.slice(0, 10).map((request) => (
                  <div
                    key={request.id}
                    className="p-3 rounded-lg border bg-muted/30 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{request.user_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.processed_at && new Date(request.processed_at).toLocaleString("id-ID")}
                          {request.processed_by && ` • Oleh ${request.processed_by}`}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.admin_response && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{request.admin_response}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${actionType === "approve" ? "text-destructive" : ""}`}>
              {actionType === "approve" ? (
                <>
                  <Trash2 className="w-5 h-5" />
                  Hapus Akun Pengguna?
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  Tolak Permintaan?
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" ? (
                <>
                  Akun <strong>{selectedRequest?.user_email}</strong> dan SEMUA data terkait akan dihapus secara permanen. Auth user perlu dihapus manual dari dashboard Supabase.
                </>
              ) : (
                <>
                  Permintaan dari <strong>{selectedRequest?.user_email}</strong> akan ditolak dan akun tetap aktif.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-response">Catatan Admin (opsional)</Label>
              <Textarea
                id="admin-response"
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder={actionType === "approve" 
                  ? "Contoh: Disetujui atas permintaan pengguna"
                  : "Contoh: Ditolak karena masih ada data yang perlu diselesaikan"
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Batal
            </Button>
            <Button
              variant={actionType === "approve" ? "destructive" : "default"}
              onClick={handleProcessRequest}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : actionType === "approve" ? (
                <Trash2 className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              {actionType === "approve" ? "Hapus Akun" : "Tolak Permintaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
