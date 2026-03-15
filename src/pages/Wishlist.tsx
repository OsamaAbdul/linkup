import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Heart, Trash2, ShoppingCart, Store, ArrowRight, Loader2
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";

export default function Wishlist() {
    const { user } = useAuth();
    const { addToCart } = useCart();
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
            return data ?? [];
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
            <div className="p-6 space-y-6">
                {/* Page Title */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground">My Wishlist</h1>
                    <p className="text-muted-foreground text-sm mt-1">{wishlistItems.length} Items saved</p>
                </div>

                {wishlistItems.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-medium">Your wishlist is empty</h3>
                        <p className="text-muted-foreground mb-6">Save items you love to buy later.</p>
                        <Link to="/">
                            <Button>Explore Products</Button>
                        </Link>
                    </div>
                ) : (
                    /* Wishlist Items Grid/List */
                    <div className="space-y-4">
                        {wishlistItems.map((item: any) => {
                            const product = item.products;
                            if (!product) return null; // Should not happen with inner join but safe guard

                            return (
                                <Card key={item.id} className="overflow-hidden border border-border/40 shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-0">
                                        <div className="flex flex-col sm:flex-row">
                                            {/* Image */}
                                            <div className="w-full sm:w-48 h-48 sm:h-auto bg-muted relative flex-shrink-0">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 p-4 flex flex-col justify-between gap-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <h3 className="font-semibold text-lg line-clamp-1">{product.title}</h3>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold text-lg">NGN {product.price?.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                                                            <div className="flex items-center gap-1 text-blue-600 font-medium">
                                                                <Store size={14} />
                                                                {product.profiles?.display_name || "Seller"}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-2 items-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            onClick={() => removeFromWishlist.mutate(product.id)}
                                                            disabled={removeFromWishlist.isPending}
                                                        >
                                                            <Trash2 size={18} />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end pt-2 border-t border-dashed mt-auto">
                                                    <Button
                                                        className="bg-[#27ae60] hover:bg-[#219150] text-white gap-2 w-full sm:w-auto"
                                                        onClick={() => moveToCart.mutate(product)}
                                                        disabled={moveToCart.isPending}
                                                    >
                                                        <ArrowRight size={16} />
                                                        Move to Cart
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
