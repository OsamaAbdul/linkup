import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Landmark, Receipt, Calendar, User, Wallet, AlertCircle, CheckCircle2, Clock, XCircle, Download, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import logo from "@/assets/logo.png";

interface PayoutReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
}

export function PayoutReceiptModal({ isOpen, onClose, request }: PayoutReceiptModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isCopying, setIsCopying] = useState(false);

    if (!request) return null;

    const statusConfig = {
        pending: { icon: Clock, color: "bg-amber-100 text-amber-800", label: "Pending Review" },
        approved: { icon: CheckCircle2, color: "bg-blue-100 text-blue-800", label: "Approved (Processing)" },
        processing: { icon: Clock, color: "bg-blue-100 text-blue-800", label: "Processing" },
        completed: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800", label: "Settled" },
        rejected: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Rejected" },
    };

    const status = (statusConfig as any)[request.status] || statusConfig.pending;
    const StatusIcon = status.icon;

    const handleDownload = async () => {
        if (!receiptRef.current) return;
        try {
            const canvas = await html2canvas(receiptRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
            });
            const image = canvas.toDataURL("image/png", 1.0);
            const link = document.createElement("a");
            link.download = `receipt-${request.id.slice(0, 8)}.png`;
            link.href = image;
            link.click();
            toast.success("Receipt downloaded successfully");
        } catch (err) {
            toast.error("Failed to generate receipt image");
        }
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(request.id);
        setIsCopying(true);
        setTimeout(() => setIsCopying(false), 2000);
        toast.success("ID copied to clipboard");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                {/* Scrollable Container */}
                <div className="max-h-[85vh] overflow-y-auto no-scrollbar pb-6">
                    {/* Capturable Receipt Area */}
                    <div ref={receiptRef} className="bg-white relative overflow-hidden">
                        {/* Watermark Logo */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none scale-150 select-none">
                            <img src={logo} alt="Watermark" className="w-96 grayscale" />
                        </div>

                        {/* Top Header Section */}
                        <div className="bg-primary p-10 text-white relative">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
                            
                            {/* Logo Top Left */}
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-white p-1.5 shadow-xl">
                                    <img src={logo} alt="Linkup Global" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-white">
                                    <p className="font-black text-xs leading-none">Linkup</p>
                                    <p className="font-bold text-[8px] opacity-60 uppercase tracking-widest mt-0.5">Financial Hub</p>
                                </div>
                            </div>

                            <DialogHeader className="relative text-left">
                                <DialogTitle className="text-3xl font-black tracking-tight mb-2">Withdrawal Receipt</DialogTitle>
                                <DialogDescription className="text-white/60 font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
                                    ID: {request.id.slice(0, 13).toUpperCase()}
                                    <button onClick={handleCopyId} className="hover:text-white transition-colors cursor-pointer p-1">
                                        {isCopying ? <Check size={10} /> : <Copy size={10} />}
                                    </button>
                                </DialogDescription>
                            </DialogHeader>

                            {/* Floating Badge */}
                            <div className="absolute -bottom-6 left-10">
                                <Badge className={cn(
                                    "h-10 px-5 rounded-2xl flex items-center gap-2 border-none shadow-xl font-black text-[10px] uppercase tracking-widest",
                                    status.color
                                )}>
                                    <StatusIcon size={14} />
                                    {status.label}
                                </Badge>
                            </div>
                        </div>

                        <div className="px-10 pt-16 pb-10 space-y-8 relative">
                            {/* Financial Summary */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Total Settlement</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-5xl font-black text-foreground tracking-tight">₦{request.amount.toLocaleString()}</h2>
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">NGN</span>
                                </div>
                                <div className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground/60 bg-gray-50 px-3 py-1.5 rounded-xl border border-black/[0.03]">
                                    <Wallet size={12} className="text-primary" />
                                    System Fee Applied: ₦{request.fee_amount.toLocaleString()}
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Payout Details */}
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1.5">
                                        <Label text="Financial Institution" />
                                        <div className="flex items-center gap-2 font-black text-[13px] text-foreground">
                                            <div className="w-5 h-5 rounded-md bg-primary/5 flex items-center justify-center shrink-0">
                                                <Landmark size={12} className="text-primary" />
                                            </div>
                                            {request.bank_name}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label text="Settlement Period" />
                                        <div className="flex items-center gap-2 font-black text-[13px] text-foreground">
                                            <div className="w-5 h-5 rounded-md bg-primary/5 flex items-center justify-center shrink-0">
                                                <Calendar size={12} className="text-primary" />
                                            </div>
                                            {format(new Date(request.created_at), "MMM d, yyyy")}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label text="Beneficiary Narrative" />
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-black/[0.03] space-y-1">
                                        <p className="text-[11px] font-black text-foreground uppercase tracking-tight">{request.account_name}</p>
                                        <p className="text-[13px] font-mono text-muted-foreground font-black tracking-widest">{request.account_number}</p>
                                    </div>
                                </div>

                                {request.admin_notes && (
                                    <div className="space-y-2">
                                        <Label text="Support Remarks" />
                                        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/30 flex gap-3 italic">
                                            <AlertCircle className="text-amber-600 shrink-0" size={16} />
                                            <p className="text-[11px] font-black text-amber-900/60 leading-relaxed">{request.admin_notes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-dashed border-black/[0.1] flex flex-col items-center gap-2 opacity-40">
                                <div className="flex items-center gap-2 mb-1">
                                    <img src={logo} alt="Linkup" className="w-4 h-4 grayscale" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-foreground">Linkup Global Financial Security</p>
                                </div>
                                <p className="text-[8px] font-bold text-muted-foreground text-center px-4">
                                    This document serves as an official confirmation of the withdrawal request. 
                                    Settlements are subject to verification and platform reconciliation rules.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions (Not in the receipt capture area) */}
                    <div className="px-10 pt-4 flex gap-3">
                        <Button 
                            onClick={handleDownload}
                            className="flex-1 bg-foreground text-white h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <Download size={16} className="mr-2" />
                            Secure Download
                        </Button>
                        <Button 
                            onClick={onClose}
                            variant="outline"
                            className="h-12 w-12 rounded-2xl border-none bg-gray-100 font-black text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-all p-0"
                        >
                            <XCircle size={18} className="text-muted-foreground" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Label({ text }: { text: string }) {
    return (
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 block mb-0.5 ml-1">{text}</span>
    );
}
