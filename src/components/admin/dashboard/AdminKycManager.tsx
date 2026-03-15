import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";

export default function AdminKycManager() {
  const queryClient = useQueryClient();
  const [selectedVerification, setSelectedVerification] = useState<any>(null);

  const { data: verifications = [], isLoading } = useQuery({
    queryKey: ["admin-kyc-verifications"],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await supabase
        .from("seller_verifications")
        .select("*, profiles!seller_verifications_user_id_fkey(display_name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) {
        // Fallback without join if FK doesn't exist
        // @ts-ignore
        const { data: fallback, error: fbErr } = await supabase
          .from("seller_verifications")
          .select("*")
          .order("created_at", { ascending: false });
        if (fbErr) throw fbErr;
        return fallback || [];
      }
      return data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // @ts-ignore
      const { error } = await supabase
        .from("seller_verifications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-verifications"] });
      toast.success(`Verification ${status === 'verified' ? 'approved' : 'rejected'} successfully`);
      setSelectedVerification(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-50 text-green-700';
      case 'rejected': return 'bg-red-50 text-red-700';
      default: return 'bg-amber-50 text-amber-700';
    }
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground font-bold bg-white rounded-[2.5rem]">Loading KYC Verifications...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black">KYC Verifications</h2>
          <p className="text-sm text-muted-foreground font-medium">Review and approve seller verification requests.</p>
        </div>
        <Badge variant="outline" className="h-10 px-4 rounded-xl border-white bg-white/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm">
          {verifications.filter((v: any) => v.status === 'pending').length} Pending
        </Badge>
      </div>

      <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Seller</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Business</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Zone</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {verifications.length === 0 && (
                <tr><td colSpan={6} className="px-8 py-12 text-center text-muted-foreground">No verification requests yet.</td></tr>
              )}
              {verifications.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-bold text-sm">{(v.profiles as any)?.display_name || v.user_id?.slice(0, 8)}</p>
                    <p className="text-[10px] text-muted-foreground">{v.phone_number}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="font-bold text-sm">{v.business_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{v.business_address}</p>
                  </td>
                  <td className="px-8 py-6 text-sm text-muted-foreground">{v.zone || '—'}</td>
                  <td className="px-8 py-6">
                    <Badge className={cn("rounded-full border-none text-[9px] font-black uppercase tracking-tight", statusColor(v.status))}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-8 py-6 text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSelectedVerification(v)}>
                        <Eye size={16} />
                      </Button>
                      {v.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-9 px-4"
                            onClick={() => updateStatusMutation.mutate({ id: v.id, status: 'verified' })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle size={14} className="mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold h-9 px-4"
                            onClick={() => updateStatusMutation.mutate({ id: v.id, status: 'rejected' })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle size={14} className="mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black">Verification Details</DialogTitle>
            <DialogDescription>Review seller KYC information</DialogDescription>
          </DialogHeader>
          {selectedVerification && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase">Business Name</p>
                  <p className="font-bold">{selectedVerification.business_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase">Phone</p>
                  <p className="font-bold">{selectedVerification.phone_number}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs font-bold uppercase">Address</p>
                  <p className="font-bold">{selectedVerification.business_address}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase">Zone</p>
                  <p className="font-bold">{selectedVerification.zone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase">Status</p>
                  <Badge className={cn("rounded-full border-none text-[9px] font-black uppercase", statusColor(selectedVerification.status))}>
                    {selectedVerification.status}
                  </Badge>
                </div>
              </div>

              {selectedVerification.bank_details && (
                <div className="border-t pt-4">
                  <p className="text-muted-foreground text-xs font-bold uppercase mb-2">Bank Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Bank</p>
                      <p className="font-bold">{(selectedVerification.bank_details as any).bank_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Account</p>
                      <p className="font-bold">{(selectedVerification.bank_details as any).account_number}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Account Name</p>
                      <p className="font-bold">{(selectedVerification.bank_details as any).account_name}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedVerification.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                    onClick={() => updateStatusMutation.mutate({ id: selectedVerification.id, status: 'verified' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle size={16} className="mr-2" /> Approve Seller
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-bold"
                    onClick={() => updateStatusMutation.mutate({ id: selectedVerification.id, status: 'rejected' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle size={16} className="mr-2" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
