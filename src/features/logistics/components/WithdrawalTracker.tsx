import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Smartphone, Banknote, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
    id: string;
    label: string;
    description: string;
    icon: any;
    status: "pending" | "current" | "completed" | "error";
}

interface WithdrawalTrackerProps {
    status: string;
    reason?: string;
    amount: number;
}

export function WithdrawalTracker({ status, reason, amount }: WithdrawalTrackerProps) {
    const steps: Step[] = [
        {
            id: "request",
            label: "Request Received",
            description: `We've received your request for ₦${amount.toLocaleString()}.`,
            icon: Smartphone,
            status: "completed",
        },
        {
            id: "review",
            label: "Security Review",
            description: "Admins are verifying your mission history and earnings.",
            icon: ShieldCheck,
            status: status === "pending" ? "current" : "completed",
        },
        {
            id: "processing",
            label: "Funds Processing",
            description: "Payment has been authorized and is being sent to your bank.",
            icon: Banknote,
            status: status === "approved" || status === "processing" ? "current" : 
                    (status === "completed" ? "completed" : "pending"),
        },
        {
            id: "completed",
            label: "Completed",
            description: "Funds should be in your bank account shortly.",
            icon: CheckCircle2,
            status: status === "completed" ? "completed" : "pending",
        },
    ];

    // Handle rejected state
    if (status === "rejected") {
        return (
            <div className="w-full p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <AlertCircle size={32} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-red-900 uppercase tracking-tight">Withdrawal Rejected</h3>
                    <p className="text-sm font-medium text-red-700 mt-1 max-w-sm">
                        {reason || "Your request was declined during the security review. Please contact support."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8 py-4">
            <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-[27px] top-6 bottom-6 w-[2px] bg-black/[0.05]" />
                
                <div className="space-y-10">
                    {steps.map((step, index) => {
                        const isCompleted = step.status === "completed";
                        const isCurrent = step.status === "current";
                        
                        return (
                            <motion.div 
                                key={step.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative flex gap-6"
                            >
                                {/* Circle Indicator */}
                                <div className={cn(
                                    "relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                                    isCompleted ? "bg-green-600 text-white shadow-lg shadow-green-600/20" :
                                    isCurrent ? "bg-[#E96F28] text-white shadow-lg shadow-orange-600/20 animate-pulse" :
                                    "bg-white border-2 border-black/[0.05] text-black/20"
                                )}>
                                    <step.icon size={24} strokeWidth={isCurrent ? 3 : 2} />
                                    {isCompleted && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm"
                                        >
                                            <CheckCircle2 size={14} strokeWidth={3} />
                                        </motion.div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="pt-1.5 min-w-0">
                                    <h4 className={cn(
                                        "text-sm font-black uppercase tracking-tight transition-colors",
                                        isCurrent ? "text-[#E96F28]" : isCompleted ? "text-foreground" : "text-muted-foreground/40"
                                    )}>
                                        {step.label}
                                    </h4>
                                    <p className={cn(
                                        "text-xs font-medium leading-relaxed mt-1 transition-colors",
                                        isCurrent ? "text-[#E96F28]/70" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/20"
                                    )}>
                                        {step.description}
                                    </p>
                                    
                                    {isCurrent && (
                                        <motion.div 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#E96F28]/10 text-[#E96F28] border border-orange-100"
                                        >
                                            <Clock size={12} className="animate-spin" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">In Progress</span>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
