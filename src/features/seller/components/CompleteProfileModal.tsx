import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Landmark, Mail, User, Phone, Info, CheckCircle2, ChevronRight, Layout } from "lucide-react";
import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/lib/utils";

interface CompleteProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: any;
    onSave: (data: any) => Promise<void>;
    isSaving: boolean;
}

export function CompleteProfileModal({ isOpen, onClose, profile, onSave, isSaving }: CompleteProfileModalProps) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        display_name: profile?.display_name || "",
        email: profile?.email || "",
        bio: profile?.bio || "",
        payout_bank_name: profile?.payout_bank_name || "",
        payout_account_number: profile?.payout_account_number || "",
        payout_account_name: profile?.payout_account_name || "",
        phone: profile?.phone || "",
        business_name: profile?.verification?.business_name || "",
        business_address: profile?.verification?.business_address || ""
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                display_name: profile.display_name || "",
                email: profile.email || "",
                bio: profile.bio || "",
                payout_bank_name: profile.payout_bank_name || "",
                payout_account_number: profile.payout_account_number || "",
                payout_account_name: profile.payout_account_name || "",
                phone: profile.phone || "",
                business_name: profile?.verification?.business_name || "",
                business_address: profile?.verification?.business_address || ""
            });
        }
    }, [profile]);

    const totalSteps = 2;
    const progress = (step / totalSteps) * 100;

    const handleNext = () => setStep(prev => Math.min(prev + 1, totalSteps));
    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(formData);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                {/* Header Section */}
                <div className="bg-primary p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                             <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md">
                                <Layout size={18} className="text-white" />
                             </div>
                             <DialogTitle className="text-2xl font-black tracking-tight">Complete Store Profile</DialogTitle>
                        </div>
                        <DialogDescription className="text-white/70 font-medium">
                            Follow the steps to ensure your store is fully set up for success and smooth payouts.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stepper */}
                    <div className="mt-8 space-y-3">
                        <div className="flex justify-between items-end">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                                Step {step} of {totalSteps}: {step === 1 ? 'Store Identity' : 'Payment Details'}
                            </p>
                            <p className="text-xs font-black">{Math.round(progress)}%</p>
                        </div>
                        <Progress value={progress} className="h-1.5 bg-white/10" indicatorClassName="bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {step === 1 ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store Display Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                                        <Input 
                                            value={formData.display_name}
                                            onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                                            className="h-12 pl-12 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white transition-all font-bold"
                                            placeholder="Your Store Name"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                                        <Input 
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            className="h-12 pl-12 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white transition-all font-bold"
                                            placeholder="store@email.com"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store Bio / Description</Label>
                                <Textarea 
                                    value={formData.bio}
                                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                    className="min-h-[100px] rounded-2xl border-black/[0.05] bg-gray-50 focus:bg-white transition-all font-medium py-4 px-5"
                                    placeholder="Tell your customers about your store..."
                                    required
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100/50 flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                                    <Landmark size={20} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Bank Details</h4>
                                    <p className="text-[11px] font-bold text-amber-700/80 mt-0.5">Where should we send your earnings? Please ensure details are accurate.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Bank Name</Label>
                                    <Input 
                                        value={formData.payout_bank_name}
                                        onChange={(e) => setFormData({...formData, payout_bank_name: e.target.value})}
                                        className="h-12 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white transition-all font-bold"
                                        placeholder="e.g. GTBank, Zenith Bank"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Number</Label>
                                        <Input 
                                            value={formData.payout_account_number}
                                            onChange={(e) => setFormData({...formData, payout_account_number: e.target.value})}
                                            className="h-12 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white transition-all font-mono font-black"
                                            placeholder="10 digits"
                                            maxLength={10}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Name</Label>
                                        <Input 
                                            value={formData.payout_account_name}
                                            onChange={(e) => setFormData({...formData, payout_account_name: e.target.value})}
                                            className="h-12 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white transition-all font-bold uppercase"
                                            placeholder="FULL NAME ON ACCOUNT"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4 flex items-center gap-3">
                        {step > 1 && (
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={handleBack}
                                className="h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest"
                            >
                                Back
                            </Button>
                        )}
                        {step < totalSteps ? (
                            <Button 
                                type="button" 
                                onClick={handleNext}
                                className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 gap-2"
                            >
                                Next Step
                                <ChevronRight size={16} strokeWidth={3} />
                            </Button>
                        ) : (
                            <Button 
                                type="submit" 
                                disabled={isSaving}
                                className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 gap-2"
                            >
                                {isSaving ? "Saving..." : "Save & Complete"}
                                <CheckCircle2 size={16} strokeWidth={3} />
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
