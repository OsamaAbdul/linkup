import { useEffect } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import {
    Heart, Trash2, ShoppingCart, Store, ArrowRight, Loader2, Star, MapPin
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/features/commerce/context/CartContext";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { haversineDistance, formatDistance } from "@/lib/haversine";

export default function Wishlist() {
    const { user } = useAuth();
    const { addToCart } = useCart();
    const { position } = useGeolocation();
    const queryClient = useQueryClient();

    const { data: wishlistItems = [], isLoading } = useQuery({
        queryKey: ["wishlist", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data } = await supabase
                .from("likes")
                .select("*, products(*, profiles(display_name))")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (!data) return [];

            // Real-time synchronization fallback: Aggregating ratings if database fields are lagging
            const { data: allReviews } = await (supabase as any)
                .from('product_reviews')
                .select('product_id, rating');
            
            const statsMap = (allReviews || []).reduce((acc: any, r: any) => {
                if (!acc[r.product_id]) acc[r.product_id] = { sum: 0, count: 0 };
                acc[r.product_id].sum += r.rating;
                acc[r.product_id].count += 1;
                return acc;
            }, {});

            return data.map((item: any) => {
                if (!item.products) return item;
                const p = item.products;
                const hasReviews = statsMap[p.id];
                const derivedAvg = hasReviews ? statsMap[p.id].sum / statsMap[p.id].count : 0;
                const derivedCount = hasReviews ? statsMap[p.id].count : 0;
                
                return {
                    ...item,
                    products: {
                        ...p,
                        avg_rating: (p.avg_rating || 0) > 0 ? p.avg_rating : derivedAvg,
                        reviews_count: (p.reviews_count || 0) > 0 ? p.reviews_count : derivedCount
                    }
                };
            });
        },
        enabled: !!user
    });

    // Real-time synchronization
    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel(`wishlist-changes-${user.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "likes", filter: `user_id=eq.${user.id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const removeFromWishlist = useMutation({
        mutationFn: async (productId: string) => {
            const { error } = await supabase.from("likes").delete().eq("user_id", user!.id).eq("product_id", productId);
            if (error) throw error;
        },
        onMutate: async (productId) => {
            await queryClient.cancelQueries({ queryKey: ["wishlist", user?.id] });
            const previousWishlist = queryClient.getQueryData<any[]>(["wishlist", user?.id]);
            queryClient.setQueryData(["wishlist", user?.id], (old: any[] = []) =>
                old.filter(item => item.product_id !== productId)
            );
            return { previousWishlist };
        },
        onError: (err, productId, context) => {
            if (context?.previousWishlist) {
                queryClient.setQueryData(["wishlist", user?.id], context.previousWishlist);
            }
            toast.error("Failed to remove item");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["wishlist", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["my-likes", user?.id] });
        }
    });

    const moveToCart = useMutation({
        mutationFn: async (product: any) => {
            if (!user) return;
            await addToCart(product.id, 1);
            const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("product_id", product.id);
            if (error) throw error;
        },
        onMutate: async (product) => {
            await queryClient.cancelQueries({ queryKey: ["wishlist", user?.id] });
            const previousWishlist = queryClient.getQueryData<any[]>(["wishlist", user?.id]);
            queryClient.setQueryData(["wishlist", user?.id], (old: any[] = []) =>
                old.filter(item => item.product_id !== product.id)
            );
            return { previousWishlist };
        },
        onError: (err, product, context) => {
            if (context?.previousWishlist) {
                queryClient.setQueryData(["wishlist", user?.id], context.previousWishlist);
            }
            toast.error("Failed to move to cart");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["wishlist", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["my-likes", user?.id] });
        }
    });

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex h-[50vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-w-4xl mx-auto">
                {/* Page Title */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Wishlist Registry</h1>
                    <p className="text-muted-foreground text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] mt-0.5">{wishlistItems.length} Securely Preserved Items</p>
                </div>

                {wishlistItems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-black/[0.05] shadow-inner">
                        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                        <h3 className="text-lg font-black tracking-tight">Registry Empty</h3>
                        <p className="text-xs text-muted-foreground mb-6 max-w-[200px] mx-auto">Save items you love to your commercial registry for future acquisition.</p>
                        <Link to="/">
                            <Button className="rounded-full px-8 font-bold text-xs shadow-xl shadow-primary/20 transition-transform active:scale-95">Explore Index</Button>
                        </Link>
                    </div>
                ) : (
                    /* Wishlist Items Grid/List */
                    <div className="space-y-4">
                        {wishlistItems.map((item: any) => {
                            const product = item.products;
                            if (!product) return null; // Should not happen with inner join but safe guard

                            return (
                                <Card key={item.id} className="overflow-hidden border border-border/40 shadow-sm hover:shadow-md transition-shadow rounded-xl">
                                    <CardContent className="p-0">
                                        <div className="flex flex-row items-center">
                                            {/* Image */}
                                            <div className="w-20 sm:w-28 h-20 sm:h-28 bg-muted/30 relative flex-shrink-0 border-r border-black/[0.03]">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[8px] font-black uppercase tracking-widest opacity-30">No asset</div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 p-3 sm:p-4 flex flex-row items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-[14px] sm:text-[15px] tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">{product.title}</h3>
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/30 rounded-full w-fit my-1">
                                                        <div className="flex text-yellow-500">
                                                            <Star size={10} fill={product.avg_rating > 0 ? "currentColor" : "none"} className={product.avg_rating > 0 ? "drop-shadow-[0_0_2px_rgba(251,191,36,0.3)]" : "text-muted-foreground/30"} />
                                                        </div>
                                                        <span className="text-[10px] text-foreground font-bold">
                                                            {product.avg_rating > 0 ? product.avg_rating.toFixed(1) : "NEW"}
                                                        </span>
                                                        {position && product.latitude && product.longitude && (() => {
                                                            const dist = haversineDistance(position.latitude, position.longitude, product.latitude, product.longitude);
                                                            const minTime = Math.round(dist * 2.5 + 15);
                                                            const maxTime = Math.round(dist * 4 + 25);
                                                            return (
                                                                <span className="text-[9px] text-muted-foreground font-medium ml-1 flex items-center gap-1 border-l pl-2 border-black/[0.05]">
                                                                    <MapPin size={8} className="text-primary" />
                                                                    {formatDistance(dist)} • {minTime}-{maxTime}mins
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="font-black text-base sm:text-lg tracking-tighter text-primary">₦{product.price?.toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                                    <Button
                                                        size="sm"
                                                        className="bg-[#27ae60] hover:bg-[#219150] text-white gap-2 rounded-xl h-9 sm:h-10 px-4 sm:px-6 text-[10px] sm:text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
                                                        onClick={() => moveToCart.mutate(product)}
                                                        disabled={moveToCart.isPending}
                                                    >
                                                        <ShoppingCart size={14} className="sm:hidden" />
                                                        <ShoppingCart size={16} className="hidden sm:block" />
                                                        <span className="hidden xs:inline">Acquire</span>
                                                    </Button>
                                                    
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 active:scale-90 transition-all border border-transparent hover:border-destructive/10"
                                                        onClick={() => removeFromWishlist.mutate(product.id)}
                                                        disabled={removeFromWishlist.isPending}
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
