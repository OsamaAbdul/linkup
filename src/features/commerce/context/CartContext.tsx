import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CartItem {
    id?: string; // DB ID
    product_id: string;
    quantity: number;
    user_id?: string;
    products?: {
        id: string;
        title: string;
        price: number;
        images: string[];
        inventory: number;
        profiles?: {
            display_name: string;
        };
    };
}

interface CartContextType {
    cartItems: CartItem[];
    isLoading: boolean;
    addToCart: (productId: string, quantity?: number) => Promise<void>;
    updateQuantity: (productId: string, quantity: number) => Promise<void>;
    removeFromCart: (productId: string) => Promise<void>;
    clearCart: () => Promise<void>;
    totalCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const LOCAL_CART_KEY = "linkup_guest_cart";

export function CartProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [localCart, setLocalCart] = useState<CartItem[]>([]);

    // Load local cart on mount
    useEffect(() => {
        const saved = localStorage.getItem(LOCAL_CART_KEY);
        if (saved) {
            try {
                setLocalCart(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse local cart", e);
            }
        }
    }, []);

    // Save local cart to localStorage whenever it changes
    useEffect(() => {
        if (!user) {
            localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(localCart));
        }
    }, [localCart, user]);

    // DB Cart - only for logged in users
    const { data: dbCart = [], isLoading: isLoadingDb } = useQuery({
        queryKey: ["cart", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("cart_items")
                .select("id, product_id, quantity, products(id, title, price, images, inventory, seller_id)")
                .eq("user_id", user?.id!);
            if (error) throw error;
            return (data as any) as CartItem[];
        },
        enabled: !!user,
    });

    // Guest Cart Details - Fetching product details for items in local storage
    const { data: localCartDetails = [], isLoading: isLoadingLocal } = useQuery({
        queryKey: ["guest-cart-details", localCart.map(i => i.product_id)],
        queryFn: async () => {
            if (localCart.length === 0) return [];
            const productIds = localCart.map(i => i.product_id);
            const { data, error } = await supabase
                .from("products")
                .select("id, title, price, images, inventory, seller_id")
                .in("id", productIds);

            if (error) throw error;

            return localCart.map(item => ({
                ...item,
                products: (data as any[]).find(p => p.id === item.product_id)
            }));
        },
        enabled: !user && localCart.length > 0,
    });

    // Sync guest cart to DB on login
    useEffect(() => {
        const syncCart = async () => {
            if (user && localCart.length > 0) {
                let itemsSynced = 0;
                for (const item of localCart) {
                    // Check if already in DB
                    const { data: existing } = await supabase
                        .from("cart_items")
                        .select("id, quantity")
                        .eq("user_id", user.id)
                        .eq("product_id", item.product_id)
                        .maybeSingle();

                    if (existing) {
                        await supabase
                            .from("cart_items")
                            .update({ quantity: existing.quantity + item.quantity })
                            .eq("id", existing.id);
                    } else {
                        await supabase.from("cart_items").insert({
                            user_id: user.id,
                            product_id: item.product_id,
                            quantity: item.quantity,
                        });
                    }
                    itemsSynced++;
                }

                if (itemsSynced > 0) {
                    toast.success(`${itemsSynced} items from your guest cart have been added to your account.`);
                    queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
                    setLocalCart([]);
                    localStorage.removeItem(LOCAL_CART_KEY);
                }
            }
        };

        syncCart();
    }, [user, queryClient]); // Only run when user/login state changes

    // -- OPTIMISTIC MUTATIONS --

    const updateQuantityMutation = useMutation({
        mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
            if (quantity <= 0) {
                const { error } = await supabase
                    .from("cart_items")
                    .delete()
                    .eq("user_id", user?.id!)
                    .eq("product_id", productId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("cart_items")
                    .update({ quantity })
                    .eq("user_id", user?.id!)
                    .eq("product_id", productId);
                if (error) throw error;
            }
        },
        onMutate: async ({ productId, quantity }) => {
            await queryClient.cancelQueries({ queryKey: ["cart", user?.id] });
            const previousCart = queryClient.getQueryData<CartItem[]>(["cart", user?.id]);

            if (previousCart) {
                queryClient.setQueryData<CartItem[]>(["cart", user?.id], (old) => {
                    if (quantity <= 0) {
                        return old?.filter(item => item.product_id !== productId);
                    }
                    return old?.map(item =>
                        item.product_id === productId ? { ...item, quantity } : item
                    );
                });
            }

            return { previousCart };
        },
        onError: (err, variables, context) => {
            if (context?.previousCart) {
                queryClient.setQueryData(["cart", user?.id], context.previousCart);
            }
            toast.error("Failed to update cart");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
        },
    });

    const addToCartMutation = useMutation({
        mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
            const { data: existing } = await supabase
                .from("cart_items")
                .select("id, quantity")
                .eq("user_id", user?.id!)
                .eq("product_id", productId)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from("cart_items")
                    .update({ quantity: existing.quantity + quantity })
                    .eq("id", existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("cart_items").insert({
                    user_id: user?.id!,
                    product_id: productId,
                    quantity,
                });
                if (error) throw error;
            }
        },
        onMutate: async ({ productId, quantity }) => {
            await queryClient.cancelQueries({ queryKey: ["cart", user?.id] });
            const previousCart = queryClient.getQueryData<CartItem[]>(["cart", user?.id]);

            // Note: Since we don't have full product details for NEW items in the cache immediately,
            // we'll just invalidate for NEW items, but for existing items we can update optimistically.
            if (previousCart) {
                const existing = previousCart.find(item => item.product_id === productId);
                if (existing) {
                    queryClient.setQueryData<CartItem[]>(["cart", user?.id], (old) =>
                        old?.map(item =>
                            item.product_id === productId ? { ...item, quantity: item.quantity + quantity } : item
                        )
                    );
                }
            }

            return { previousCart };
        },
        onError: (err, variables, context) => {
            if (context?.previousCart) {
                queryClient.setQueryData(["cart", user?.id], context.previousCart);
            }
            toast.error("Failed to add to cart");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
        },
    });

    const removeFromCartMutation = useMutation({
        mutationFn: async (productId: string) => {
            const { error } = await supabase
                .from("cart_items")
                .delete()
                .eq("user_id", user?.id!)
                .eq("product_id", productId);
            if (error) throw error;
        },
        onMutate: async (productId) => {
            await queryClient.cancelQueries({ queryKey: ["cart", user?.id] });
            const previousCart = queryClient.getQueryData<CartItem[]>(["cart", user?.id]);

            if (previousCart) {
                queryClient.setQueryData<CartItem[]>(["cart", user?.id], (old) =>
                    old?.filter(item => item.product_id !== productId)
                );
            }

            return { previousCart };
        },
        onError: (err, variables, context) => {
            if (context?.previousCart) {
                queryClient.setQueryData(["cart", user?.id], context.previousCart);
            }
            toast.error("Failed to remove item");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
        },
    });

    const clearCartMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from("cart_items")
                .delete()
                .eq("user_id", user?.id!);
            if (error) throw error;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ["cart", user?.id] });
            const previousCart = queryClient.getQueryData<CartItem[]>(["cart", user?.id]);
            queryClient.setQueryData(["cart", user?.id], []);
            return { previousCart };
        },
        onError: (err, variables, context) => {
            if (context?.previousCart) {
                queryClient.setQueryData(["cart", user?.id], context.previousCart);
            }
            toast.error("Failed to clear cart");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
        },
    });

    const cartItems = user ? dbCart : (localCart.length > 0 ? localCartDetails : []);
    const isLoading = user ? isLoadingDb : isLoadingLocal;
    const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const addToCart = async (productId: string, quantity = 1) => {
        if (user) {
            try {
                await addToCartMutation.mutateAsync({ productId, quantity });
            } catch (error) {
                console.error("Cart mutation failed", error);
                return; // Don't show success toast if it failed
            }
        } else {
            setLocalCart(prev => {
                const existingIdx = prev.findIndex(i => i.product_id === productId);
                if (existingIdx > -1) {
                    const newCart = [...prev];
                    newCart[existingIdx].quantity += quantity;
                    return newCart;
                }
                return [...prev, { product_id: productId, quantity }];
            });
        }
        toast.success("Added to cart!");
    };

    const updateQuantity = async (productId: string, quantity: number) => {
        if (user) {
            updateQuantityMutation.mutate({ productId, quantity });
        } else {
            if (quantity <= 0) {
                removeFromCart(productId);
                return;
            }
            setLocalCart(prev => prev.map(i => i.product_id === productId ? { ...i, quantity } : i));
        }
    };

    const removeFromCart = async (productId: string) => {
        if (user) {
            removeFromCartMutation.mutate(productId);
        } else {
            setLocalCart(prev => prev.filter(i => i.product_id !== productId));
        }
        toast.success("Removed from cart");
    };

    const clearCart = async () => {
        if (user) {
            clearCartMutation.mutate();
        } else {
            setLocalCart([]);
            localStorage.removeItem(LOCAL_CART_KEY);
        }
    };

    return (
        <CartContext.Provider value={{ cartItems, isLoading, addToCart, updateQuantity, removeFromCart, clearCart, totalCount }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
};
