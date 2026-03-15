import { ShieldCheck } from "lucide-react";

export function OrdersHeader() {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Registry Management</p>
                <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">My Orders</h1>
            </div>

            <div className="bg-amber-50/50 backdrop-blur-sm border border-amber-100/50 rounded-2xl p-3 flex items-center gap-3 text-[11px] text-amber-900 shadow-sm">
                <ShieldCheck className="text-amber-500 fill-amber-100" size={18} />
                <span className="font-bold flex items-center gap-2">
                    Escrow Safe
                    <span className="h-1 w-1 rounded-full bg-amber-300" />
                    Your payment is secured until delivery is made
                </span>
            </div>
        </div>
    );
}
