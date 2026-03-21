import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { MessageSquare, Package, ChevronRight, Clock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Messages() {
    const { user } = useAuth();

    const { data: conversations = [], isLoading } = useQuery({
        queryKey: ["conversations", user?.id],
        queryFn: async () => {
            if (!user) return [];
            // Simplified fetch: in a real app, we'd also join the 'messages' table for the latest content
            const { data, error } = await (supabase as any)
                .from("conversations")
                .select(`
                    *,
                    product:products(id, title, images, price),
                    buyer:profiles!conversations_buyer_id_fkey(display_name, avatar_url),
                    seller:profiles!conversations_seller_id_fkey(display_name, avatar_url)
                `)
                .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
                .order('last_message_at', { ascending: false });

            if (error) throw error;
            return (data as any[]) || [];
        },
        enabled: !!user,
    });

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-32">
                <header className="space-y-2">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <MessageSquare size={20} strokeWidth={3} />
                        </div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Neural Channels</p>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tight">Secure Inbox</h1>
                </header>

                <div className="space-y-4">
                    {isLoading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-muted/20 rounded-xl animate-pulse" />
                        ))
                    ) : conversations.length === 0 ? (
                        <div className="text-center py-20 bg-muted/10 rounded-[3rem] border-2 border-dashed border-border/50">
                            <MessageSquare className="mx-auto text-muted-foreground/20 mb-4" size={48} />
                            <h3 className="text-xl font-bold">No Encrypted Links</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto mt-2 text-sm font-medium">Start a conversation from any product page to initiate a secure trade protocol.</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {conversations.map((conv, idx) => {
                                const isBuyer = user?.id === conv.buyer_id;
                                const otherUser = isBuyer ? conv.seller : conv.buyer;
                                const product = conv.product;

                                return (
                                    <m.div
                                        key={conv.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <Link
                                            to={`/chat/${conv.id}`}
                                            className="group block p-4 bg-white border border-black/[0.03] shadow-lg shadow-black/[0.01] rounded-xl hover:shadow-2xl hover:shadow-primary/5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-16 w-16 rounded-xl border-2 border-transparent group-hover:border-primary/20 transition-all shadow-sm">
                                                    <AvatarImage src={otherUser?.avatar_url} />
                                                    <AvatarFallback className="bg-primary/5 text-primary font-black uppercase tracking-widest text-lg">
                                                        {otherUser?.display_name?.[0] || "?"}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="font-black text-foreground text-lg tracking-tight truncate">
                                                            {otherUser?.display_name || "Unknown Agent"}
                                                        </h3>
                                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                            <Clock size={10} /> {new Date(conv.last_message_at).toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-2 max-w-[200px] bg-muted/30 px-2 py-1 rounded-xl border border-black/[0.02]">
                                                            <div className="w-5 h-5 rounded-md overflow-hidden bg-muted">
                                                                {product?.images?.[0] && <img src={product.images[0]} className="w-full h-full object-cover" />}
                                                            </div>
                                                            <span className="text-xs font-bold text-muted-foreground truncate">{product?.title || "Deleted Mission"}</span>
                                                        </div>
                                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-primary/60 border-primary/20 bg-primary/5">
                                                            {isBuyer ? "Buyer" : "Seller"}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="w-10 h-10 rounded-full bg-muted/10 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                                                    <ChevronRight size={20} />
                                                </div>
                                            </div>
                                        </Link>
                                    </m.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

