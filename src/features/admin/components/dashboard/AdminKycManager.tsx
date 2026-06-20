import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/shared/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/shared/components/ui/tabs";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Loader2, 
  ShieldCheck, 
  Truck, 
  Users,
  MapPin
} from "lucide-react";

export default function AdminKycManager() {
  const queryClient = useQueryClient();
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [kycType, setKycType] = useState<"seller" | "logistics">("seller");
  const [signedUrls, setSignedUrls] = useState<{ [key: string]: string }>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: allVerifications = [], isLoading } = useQuery({
    queryKey: ["admin-kyc-verifications-all"],
    queryFn: async () => {
      const [sellerRes, logisticsRes] = await Promise.all([
        supabase.from("seller_verifications").select("*").order("created_at", { ascending: false }),
        supabase.from("logistics_kyc").select("*").order("created_at", { ascending: false })
      ]);

      if (sellerRes.error) throw sellerRes.error;
      if (logisticsRes.error) throw logisticsRes.error;

      const sellerData = (sellerRes.data || []).map(v => ({ ...v, kyc_type: "seller" }));
      const logisticsData = (logisticsRes.data || []).map(v => ({ ...v, kyc_type: "logistics" }));
      
      const combined = [...sellerData, ...logisticsData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (combined.length === 0) return [];

      // Profile Joining (SPOT)
      const userIds = Array.from(new Set(combined.map((v: any) => v.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, phone")
        .in("id", userIds);

      const profileMap = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      return combined.map((v: any) => {
        const hasDocs = v.kyc_type === 'seller' 
          ? !!(v.national_id_url && v.national_id_url !== 'LEGACY_VERIFICATION')
          : !!(v.passport_photo_url && v.passport_photo_url !== 'LEGACY_VERIFICATION');

        return {
          ...v,
          is_virtual: !hasDocs,
          status: (!hasDocs && v.status === 'verified') ? 'role_verified' : v.status,
          profiles: profileMap[v.user_id] || null
        };
      });
    },
  });

  const verifications = allVerifications.filter(v => v.kyc_type === kycType);
  const pendingCount = allVerifications.filter(v => v.status === 'pending').length;

  console.log(`Admin [${kycType}] KYC Data:`, verifications);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, type }: { id: string; status: string; type: "seller" | "logistics" }) => {
      const rpc = type === "seller" ? "verify_seller_kyc" : "verify_logistics_kyc";
      const { data, error } = await (supabase as any).rpc(rpc, {
        [type === "seller" ? "verification_id" : "p_verification_id"]: id,
        [type === "seller" ? "review_status" : "p_review_status"]: status
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-verifications-all"] });
      toast.success(`Verification ${status === 'verified' ? 'approved' : 'rejected'} successfully`);
      setSelectedVerification(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Fetch signed URLs when a verification is selected
  useEffect(() => {
    async function fetchSignedUrls() {
      if (!selectedVerification) {
        setSignedUrls({});
        return;
      }

      const paths: string[] = [];
      if (kycType === 'seller') {
        if (selectedVerification.national_id_url && !selectedVerification.national_id_url.startsWith('http')) paths.push(selectedVerification.national_id_url);
        if (selectedVerification.store_photo_url && !selectedVerification.store_photo_url.startsWith('http')) paths.push(selectedVerification.store_photo_url);
      } else {
        if (selectedVerification.passport_photo_url && !selectedVerification.passport_photo_url.startsWith('http')) paths.push(selectedVerification.passport_photo_url);
        if (selectedVerification.id_card_photo_url && !selectedVerification.id_card_photo_url.startsWith('http')) paths.push(selectedVerification.id_card_photo_url);
      }

      if (paths.length === 0) return;

      const urls: { [key: string]: string } = {};
      for (const path of paths) {
        const { data } = await supabase.storage
          .from('kyc-documents')
          .createSignedUrl(path, 3600); // 1 hour expiry
        
        if (data?.signedUrl) {
          urls[path] = data.signedUrl;
        }
      }
      setSignedUrls(urls);
    }

    fetchSignedUrls();
  }, [selectedVerification, kycType]);

  const getImageUrl = (path: string) => {
    if (!path || path === 'LEGACY_VERIFICATION') return null;
    if (path.startsWith('http')) return path;
    return signedUrls[path] || null;
  };

  const renderImage = (path: string, label: string) => {
    const url = getImageUrl(path);
    if (!url) {
      return (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
          <div className="aspect-[4/3] rounded-xl bg-muted/30 animate-pulse" />
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
        <div 
          className="block aspect-[4/3] rounded-xl bg-muted/30 border border-black/[0.03] overflow-hidden hover:opacity-90 transition-opacity cursor-pointer relative group"
          onClick={() => setPreviewImage(url)}
        >
          <img src={url} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <Eye className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" size={24} />
          </div>
        </div>
      </div>
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-50 text-green-700';
      case 'role_verified': return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
      case 'rejected': return 'bg-red-50 text-red-700';
      default: return 'bg-amber-50 text-amber-700';
    }
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground font-bold bg-white rounded-xl">Checking member identities...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Identity Checks</h2>
          <p className="text-sm text-muted-foreground font-medium">Check and approve new sellers and delivery agents.</p>
        </div>
        <Tabs value={kycType} onValueChange={(v: any) => setKycType(v)} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 w-full sm:w-[350px] h-11 bg-white/50 backdrop-blur-sm border-none p-1 rounded-xl shadow-sm">
            <TabsTrigger value="seller" className="rounded-xl font-bold text-[10px] uppercase tracking-widest gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Users size={14} /> Sellers {allVerifications.filter(v => v.kyc_type === 'seller' && v.status === 'pending').length > 0 && `(${allVerifications.filter(v => v.kyc_type === 'seller' && v.status === 'pending').length})`}
            </TabsTrigger>
            <TabsTrigger value="logistics" className="rounded-xl font-bold text-[10px] uppercase tracking-widest gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Truck size={14} /> Riders {allVerifications.filter(v => v.kyc_type === 'logistics' && v.status === 'pending').length > 0 && `(${allVerifications.filter(v => v.kyc_type === 'logistics' && v.status === 'pending').length})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-none shadow-xl shadow-black/[0.02] rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">{kycType === 'seller' ? 'Seller' : 'Rider'}</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">{kycType === 'seller' ? 'Business' : 'Personal Details'}</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Zone</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {verifications.length === 0 && (
                <tr><td colSpan={6} className="px-8 py-16 text-center text-muted-foreground font-medium uppercase tracking-widest text-xs">No identity checks to do right now.</td></tr>
              )}
              {verifications.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-primary font-bold text-xs">
                        {v.profiles?.display_name?.charAt(0) || v.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">
                          {v.profiles?.display_name || v.full_name || v.business_name || 'Anonymous'}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{v.phone_number}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="font-bold text-sm text-foreground">{kycType === 'seller' ? v.business_name : v.full_name}</p>
                    <p className="text-[10px] font-medium text-muted-foreground truncate max-w-[200px]">{kycType === 'seller' ? v.business_address : v.home_address}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-muted-foreground" />
                      <span className="text-sm font-bold text-muted-foreground">{v.zone || v.profiles?.zone || ''}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <Badge className={cn("rounded-full border-none text-[9px] font-black uppercase tracking-widest px-3 py-1", statusColor(v.status))}>
                      {v.status === 'role_verified' ? 'Role Verified' : v.status}
                    </Badge>
                  </td>
                  <td className="px-8 py-6 text-[11px] font-bold text-muted-foreground">
                    {v.created_at && v.created_at !== new Date(0).toISOString() ? new Date(v.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" className="rounded-xl h-9 px-4 font-bold text-xs gap-2 border-black/[0.05] hover:bg-black/5" onClick={() => setSelectedVerification(v)}>
                        <Eye size={14} /> View Details
                      </Button>
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
        <DialogContent className="max-w-2xl rounded-xl p-0 overflow-hidden border-none shadow-2xl bg-white flex flex-col h-[85vh] max-h-[95vh]">
          <DialogHeader className="p-8 pb-6 shrink-0 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {kycType === 'seller' ? <Users size={24} strokeWidth={2.5} /> : <Truck size={24} strokeWidth={2.5} />}
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                  Identity Details
                </DialogTitle>
                <DialogDescription className="text-muted-foreground font-medium pt-1">
                  Check {kycType === 'seller' ? 'seller' : 'rider'} identity information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 w-full bg-slate-50/10">
              <div className="px-8 py-8">
                {selectedVerification && (
                  <div className="space-y-8 text-sm">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-1">{kycType === 'seller' ? 'Business Name' : 'Full Name'}</p>
                  <p className="font-bold text-sm text-foreground">{kycType === 'seller' ? selectedVerification.business_name : selectedVerification.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-1">Phone</p>
                  <p className="font-bold text-sm text-foreground">{selectedVerification.phone_number}</p>
                </div>
                {kycType === 'logistics' && (
                  <div>
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-1">National ID (NIN)</p>
                    <p className="font-bold text-sm text-foreground">{selectedVerification.nin_number || ''}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-1">{kycType === 'seller' ? 'Business Address' : 'Home Address'}</p>
                  <p className="font-bold text-sm text-foreground leading-tight">{kycType === 'seller' ? selectedVerification.business_address : selectedVerification.home_address}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-1">Zone</p>
                  <p className="font-bold text-sm text-foreground">{selectedVerification.zone || ''}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-1">Submission Date</p>
                  <p className="font-bold text-sm text-foreground">
                    {selectedVerification.created_at && selectedVerification.created_at !== new Date(0).toISOString() ? new Date(selectedVerification.created_at).toLocaleString() : 'Legacy Verification'}
                  </p>
                </div>
              </div>

              {selectedVerification.is_virtual && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-900 uppercase tracking-tighter">Verified by Role</p>
                    <p className="text-[10px] text-indigo-700 font-medium tracking-tight">This member has the active role but no formal identity documents on file.</p>
                  </div>
                </div>
              )}

              {/* Identity Documents */}
              <div className="space-y-3">
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Proof of Identity</p>
                <div className="grid grid-cols-2 gap-4">
                  {kycType === 'seller' ? (
                    <>
                      {renderImage(selectedVerification.national_id_url, 'National ID')}
                      {renderImage(selectedVerification.store_photo_url, 'Store Front')}
                    </>
                  ) : (
                    <>
                      {renderImage(selectedVerification.passport_photo_url, 'Passport Photograph')}
                      {renderImage(selectedVerification.id_card_photo_url, "ID Card (NIN/Voter's)")}
                    </>
                  )}
                </div>
              </div>

              {selectedVerification.bank_details && (
                <div className="border-t border-gray-100 pt-6">
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-4">Payment Details</p>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-black/[0.03]">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Bank</p>
                      <p className="font-bold text-foreground">{(selectedVerification.bank_details as any).bank_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Account</p>
                      <p className="font-bold text-foreground">{(selectedVerification.bank_details as any).account_number}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Account Name</p>
                      <p className="font-bold text-foreground">{(selectedVerification.bank_details as any).account_name}</p>
                    </div>
                  </div>
                </div>
              )}

                  </div>
                )}
              </div>
            </ScrollArea>

            {selectedVerification?.status === 'pending' && (
              <div className="px-8 py-6 border-t border-black/5 bg-white shrink-0 flex flex-col sm:flex-row gap-4">
                <Button
                  className="flex-1 rounded-xl h-14 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-green-600/20 active:scale-95 transition-all gap-2"
                  onClick={() => updateStatusMutation.mutate({ id: selectedVerification.id, status: 'verified', type: kycType })}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle size={18} strokeWidth={3} /> Approve Request
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-14 border-red-200 text-red-600 hover:bg-red-50 font-black text-xs uppercase tracking-widest active:scale-95 transition-all gap-2"
                  onClick={() => updateStatusMutation.mutate({ id: selectedVerification.id, status: 'rejected', type: kycType })}
                  disabled={updateStatusMutation.isPending}
                >
                  <XCircle size={18} strokeWidth={3} /> Reject Request
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] rounded-xl p-0 overflow-hidden border-none shadow-2xl bg-black/95 flex flex-col items-center justify-center">
          {previewImage && <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
