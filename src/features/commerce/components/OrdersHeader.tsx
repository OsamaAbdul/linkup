import { ShieldCheck } from "lucide-react";

export function OrdersHeader() {
    return (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-0.5">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Registry Management</p>
                <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">My Orders</h1>
            </div>

            <div className="bg-amber-50/50 backdrop-blur-sm border border-amber-100/50 rounded-xl p-3 flex items-center gap-3 text-[10px] sm:text-[11px] text-amber-900 shadow-sm">
                <ShieldCheck className="text-amber-500 fill-amber-100" size={16} />
                <span className="font-bold flex items-center gap-2">
                    Escrow Safe
                    <span className="h-1 w-1 rounded-full bg-amber-300" />
                    Secure until delivery
                </span>
            </div>
        </div>
    );
}
