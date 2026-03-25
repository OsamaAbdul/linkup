import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { CheckCircle2, AlertCircle, Edit2, MapPin, Building2, User, Phone, Map, Save, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { format } from "date-fns";

interface ProfileTabProps {
    profile: any;
    onUpdate?: (data: any) => Promise<any>;
    isUpdating?: boolean;
}

export function ProfileTab({ profile, onUpdate, isUpdating }: ProfileTabProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        display_name: profile?.display_name || "",
        phone: profile?.phone || profile?.verification?.phone_number || "",
        business_name: profile?.verification?.business_name || "",
        business_address: profile?.verification?.business_address || ""
    });

    if (!profile) return null;

    const verification = profile.verification || {};
    const kycStatus = verification.kyc_status || 'pending';

    const handleSave = async () => {
        if (onUpdate) {
            try {
                await onUpdate(formData);
                setIsEditing(false);
            } catch (error) {
                // Error is handled in the mutation onSuccess/onError in parent
            }
        }
    };

    const handleCancel = () => {
        setFormData({
            display_name: profile?.display_name || "",
            phone: profile?.phone || profile?.verification?.phone_number || "",
            business_name: profile?.verification?.business_name || "",
            business_address: profile?.verification?.business_address || ""
        });
        setIsEditing(false);
    };
    
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[9px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Store Identity</p>
                    <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Seller Profile</h1>
                </div>
                {!isEditing ? (
                    <Button 
                        onClick={() => setIsEditing(true)}
                        className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
                    >
                        <Edit2 size={14} strokeWidth={3} />
                        Edit Profile
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={handleCancel}
                            className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2"
                        >
                            <X size={14} strokeWidth={3} />
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSave}
                            disabled={isUpdating}
                            className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
                        >
                            <Save size={14} strokeWidth={3} />
                            {isUpdating ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Identity Card */}
                <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white relative">
                    <CardHeader className="bg-primary/5 border-b border-primary/5 pb-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 border-2 border-white shadow-md rounded-2xl">
                                    <AvatarImage src={profile.avatar_url} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-black text-xl rounded-2xl">
                                        {profile.display_name?.[0]?.toUpperCase() || "S"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                    {isEditing ? (
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Store Display Name</Label>
                                            <Input 
                                                value={formData.display_name}
                                                onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                                                className="h-8 text-sm font-bold rounded-lg border-primary/20 focus-visible:ring-primary/20"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <CardTitle className="text-xl font-black">{profile.display_name || "Unverified Store"}</CardTitle>
                                            <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                                {profile.role || "Seller"} Profile
                                            </CardDescription>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="space-y-4">
                            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60">
                                    <Phone size={14} strokeWidth={3} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Contact Identity</p>
                                    {isEditing ? (
                                        <Input 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            className="h-8 text-sm font-bold rounded-lg border-primary/10"
                                        />
                                    ) : (
                                        <p className="font-bold text-sm tracking-tight">{profile.phone || verification.phone_number || "Not provided"}</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60">
                                    <MapPin size={14} strokeWidth={3} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Operational Zone</p>
                                    <p className="font-bold text-sm">{profile.zone || "No zone configured"}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Business & Verification Card */}
                <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b border-primary/5 pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-black">Business Verification</CardTitle>
                                <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                    Store Compliance Status
                                </CardDescription>
                            </div>
                            <Badge className={`
                                px-3 py-1 font-black text-[10px] uppercase tracking-widest rounded-full
                                ${kycStatus === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 
                                  kycStatus === 'rejected' ? 'bg-red-500 hover:bg-red-600 text-white' : 
                                  'bg-amber-500 hover:bg-amber-600 text-white'}
                            `}>
                                {kycStatus}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        
                        {kycStatus === 'rejected' && verification.rejection_reason && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-600 mb-6">
                                <AlertCircle size={16} strokeWidth={3} className="shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-black text-[10px] uppercase tracking-widest mb-1 text-red-500">Compliance Action Required</p>
                                    <p className="text-sm font-medium">{verification.rejection_reason}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60">
                                    <Building2 size={14} strokeWidth={3} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Business Entity Name</p>
                                    {isEditing ? (
                                        <Input 
                                            value={formData.business_name}
                                            onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                                            className="h-8 text-sm font-bold rounded-lg border-primary/10"
                                        />
                                    ) : (
                                        <p className="font-bold text-sm tracking-tight">{verification.business_name || profile.display_name || "Not configured"}</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60 shrink-0">
                                    <Map size={14} strokeWidth={3} />
                                </div>
                                <div className="space-y-0.5 w-full">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Registered Headquarters</p>
                                    {isEditing ? (
                                        <Textarea 
                                            value={formData.business_address}
                                            onChange={(e) => setFormData({...formData, business_address: e.target.value})}
                                            className="min-h-[80px] text-sm font-bold rounded-lg border-primary/10 mt-1"
                                        />
                                    ) : (
                                        <p className="font-medium text-sm leading-snug">{verification.business_address || "No address provided"}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-black/5">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Platform Verification Timestamp</p>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={14} className={kycStatus === 'approved' ? "text-emerald-500" : "text-muted-foreground/30"} strokeWidth={3} />
                                    <span className="font-bold text-xs text-foreground/60">
                                        {verification.updated_at ? format(new Date(verification.updated_at), "PPP") : "Pending Verification"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
