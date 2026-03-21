import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Send, CheckCheck, Package, MapPin, User, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Chat() {
    const { id } = useParams();
    const { user } = useAuth();
    const [message, setMessage] = useState("");
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Fetch Conversation & Product Context
    const { data: conversation } = useQuery({
        queryKey: ["conversation", id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("conversations")
                .select(`
                    *,
                    product:products(*),
                    buyer:profiles!conversations_buyer_id_fkey(*),
                    seller:profiles!conversations_seller_id_fkey(*)
                `)
                .eq("id", id!)
                .single();
            if (error) throw error;
            return data as any;
        },
        enabled: !!id,
    });

    // 2. Fetch Messages
    const { data: messages = [], isLoading } = useQuery({
        queryKey: ["chat-messages", id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("messages")
                .select("*")
                .eq("conversation_id", id!)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return (data as any[]) || [];
        },
        enabled: !!id,
    });

    // 3. Realtime Subscription
    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`chat-${id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${id}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["chat-messages", id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, queryClient]);

    // 4. Auto-Scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // 5. Send Mutation
    const sendMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!user || !id) return;
            const { error } = await (supabase as any)
                .from("messages")
                .insert({
                    conversation_id: id,
                    sender_id: user.id,
                    content,
                });
            if (error) throw error;

            // Update last_message_at in conversation
            await (supabase as any)
                .from("conversations")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", id);
        },
        onSuccess: () => {
            setMessage("");
        },
        onError: () => {
            toast.error("Transmission failed. Retrying...");
        }
    });

    const handleSend = () => {
        if (!message.trim() || sendMutation.isPending) return;
        sendMutation.mutate(message.trim());
    };

    const isBuyer = user?.id === conversation?.buyer_id;
    const otherUser = isBuyer ? conversation?.seller : conversation?.buyer;

    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden lg:max-w-5xl lg:mx-auto lg:border-x lg:border-black/[0.03] lg:bg-white lg:shadow-2xl">
                {/* Header */}
                <header className="p-4 md:p-6 border-b border-black/[0.03] bg-white/80 backdrop-blur-xl shrink-0 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4 min-w-0">
                        <Link to="/messages" className="p-2 hover:bg-muted rounded-xl transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary text-white flex items-center justify-center font-black text-lg shadow-lg shadow-primary/20 shrink-0">
                                {otherUser?.display_name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-extrabold text-foreground truncate">{otherUser?.display_name || "Nexus Agent"}</h3>
                                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Encrypted Link
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Product Context Banner */}
                {conversation?.product && (
                    <div className="p-3 md:p-4 bg-muted/10 border-b border-black/[0.03] flex items-center justify-between gap-4 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted border border-black/[0.05] shrink-0">
                                {conversation.product.images?.[0] && <img src={conversation.product.images[0]} className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">{conversation.product.title}</p>
                                <p className="text-[10px] font-black text-primary uppercase tracking-tight">‚¦{conversation.product.price?.toLocaleString()}</p>
                            </div>
                        </div>
                        <Link to={`/product/${conversation.product.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 px-3">
                                View Item
                            </Button>
                        </Link>
                    </div>
                )}

                {/* Chat Flow */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar scroll-smooth bg-gray-50/10"
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse font-black text-[10px] uppercase tracking-widest">Synchronizing Channels...</div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 grayscale">
                            <div className="p-6 bg-muted/20 rounded-full">
                                <MessageSquare size={48} />
                            </div>
                            <div className="max-w-[200px]">
                                <h4 className="text-sm font-black uppercase tracking-tighter">Channel Open</h4>
                                <p className="text-xs font-medium">Messages are peer-to-peer encrypted and stored on the secure registry.</p>
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {messages.map((msg: any) => {
                                const isOwn = msg.sender_id === user?.id;
                                return (
                                    <m.div
                                        key={msg.id}
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        className={cn(
                                            "flex flex-col max-w-[85%]",
                                            isOwn ? "ml-auto items-end" : "mr-auto items-start"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-4 rounded-xl text-sm md:text-base font-medium shadow-sm leading-relaxed",
                                            isOwn
                                                ? "bg-primary text-white rounded-tr-none shadow-primary/20"
                                                : "bg-white text-foreground rounded-tl-none border border-black/[0.03] shadow-lg shadow-black/[0.01]"
                                        )}>
                                            {msg.content}
                                        </div>
                                        <span className="text-[8px] font-black text-muted-foreground uppercase mt-1.5 flex items-center gap-1 opacity-50 px-2">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {isOwn && <CheckCheck size={10} className="text-primary" />}
                                        </span>
                                    </m.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>

                {/* Input Neural Hub */}
                <footer className="p-4 md:p-6 bg-white border-t border-black/[0.03] shrink-0">
                    <div className="max-w-4xl mx-auto relative flex items-center gap-3">
                        <Input
                            placeholder="Type your message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            className="h-14 md:h-16 pl-6 pr-16 rounded-xl bg-gray-50 border-none font-bold text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all shadow-inner"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!message.trim() || sendMutation.isPending}
                            className="absolute right-2 h-10 w-10 md:h-12 md:w-12 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30 disabled:opacity-50 disabled:scale-100"
                        >
                            <Send size={20} className={cn(sendMutation.isPending && "animate-pulse")} />
                        </button>
                    </div>
                </footer>
            </div>
        </AppLayout>
    );
}

