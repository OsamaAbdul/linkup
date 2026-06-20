import React from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { Bell, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    transactions: any[];
    wallet?: any;
}

export function WalletTransactionsNotification({ transactions = [], wallet }: Props) {
    const recentTransactions = transactions.slice(0, 5);
    const unreadCount = transactions.filter(t => new Date(t.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length; // Transactions in last 24h

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-xl border border-black/5 bg-white/50 backdrop-blur hover:bg-black/5">
                    <Bell size={20} className="text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 rounded-2xl shadow-xl border border-black/5 overflow-hidden">
                <div className="bg-primary/5 p-4 border-b border-black/5">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="font-black text-sm tracking-tight">Wallet & Activity</h4>
                        {wallet && (
                            <span className="text-sm font-black text-primary">₦{(wallet.balance || 0).toLocaleString()}</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">Your latest wallet activity</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2 no-scrollbar">
                    {recentTransactions.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            <p className="text-xs font-bold tracking-tight">No recent transactions</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {recentTransactions.map((tx, idx) => {
                                const isCredit = tx.type === 'settlement' || tx.type === 'deposit';
                                return (
                                    <div key={tx.id || idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 transition-colors">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                            isCredit ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                                        )}>
                                            {isCredit ? <ArrowDownLeft size={16} strokeWidth={3} /> : <ArrowUpRight size={16} strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black uppercase tracking-widest truncate">
                                                {tx.type.replace('_', ' ')}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">{tx.reference || 'Wallet transaction'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={cn(
                                                "text-sm font-black tracking-tight",
                                                isCredit ? "text-emerald-600" : "text-red-600"
                                            )}>
                                                {isCredit ? '+' : '-'}₦{Number(tx.amount || 0).toLocaleString()}
                                            </p>
                                            <div className="flex items-center justify-end gap-1 mt-0.5 text-emerald-600">
                                                <CheckCircle2 size={10} />
                                                <span className="text-[9px] font-bold uppercase">{tx.status || 'Success'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
