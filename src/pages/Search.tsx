import { useState, useEffect } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineDistance, formatDistance } from "@/lib/haversine";
import { ProductCard } from "@/components/products/ProductCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

export default function SearchPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const position = useGeolocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Debounce search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setQuery(queryInput), 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  // Real-time synchronization for likes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`search-likes-changes-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-likes", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const PAGE_SIZE = 12;

  const { data: dbCategories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("categories").select("name").order("name");
      return (data as any[])?.map((c: any) => c.name) ?? [];
    },
  });

  const allCategories = ["All", ...dbCategories];

  const { data: infiniteData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["search-products", query, selectedCategory],
    initialPageParam: 0,
    getNextPageParam: (lastPage: any[], allPages: any[][]) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("products")
        .select("id, title, price, images, category, latitude, longitude, inventory, likes_count, seller_id")
        .gt("inventory", 0)
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (query) q = q.ilike("title", `%${query}%`);
      if (selectedCategory !== "All") q = q.eq("category", selectedCategory);

      const { data } = await q.order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const products = infiniteData?.pages.flat() || [];

  const { data: likes = [] } = useQuery({
    queryKey: ["my-likes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("likes").select("product_id").eq("user_id", user!.id);
      return data?.map((l) => l.product_id) ?? [];
    },
    enabled: !!user,
  });


  const likeMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) return;
      const isLiked = likes.includes(productId);
      if (isLiked) {
        await supabase.from("likes").delete().eq("user_id", user.id).eq("product_id", productId);
        toast.success("Removed from wishlist");
      } else {
        await supabase.from("likes").insert({ user_id: user.id, product_id: productId });
        toast.success("Added to wishlist");
      }
    },
    onMutate: async (productId) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ["my-likes", user.id] });
      await queryClient.cancelQueries({ queryKey: ["search-products"] });

      const previousLikes = queryClient.getQueryData<string[]>(["my-likes", user.id]);
      const currentlyLiked = previousLikes?.includes(productId);

      // 1. Update liked state
      queryClient.setQueryData(["my-likes", user.id], (old: string[] = []) =>
        currentlyLiked ? old.filter((id) => id !== productId) : [...old, productId]
      );

      // 2. Update count in search results
      queryClient.setQueriesData({ queryKey: ["search-products"] }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any[]) =>
            page.map((p: any) =>
              p.id === productId
                ? { ...p, likes_count: (p.likes_count || 0) + (currentlyLiked ? -1 : 1) }
                : p
            )
          )
        };
      });

      return { previousLikes };
    },
    onError: (err, productId, context) => {
      if (context?.previousLikes) {
        queryClient.setQueryData(["my-likes", user?.id], context.previousLikes);
      }
      toast.error("Failed to update wishlist");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-likes", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["search-products"] });
      queryClient.invalidateQueries({ queryKey: ["like-counts"] });
    },
  });

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-10" value={queryInput} onChange={(e) => setQueryInput(e.target.value)} aria-label="Search products" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {allCategories.map((c) => (
            <Badge key={c} variant={selectedCategory === c ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap" onClick={() => setSelectedCategory(c)}>
              {c}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {products.map((product: any, i: number) => {
            const dist = position && product.latitude && product.longitude
              ? formatDistance(haversineDistance(position.latitude, position.longitude, product.latitude, product.longitude))
              : undefined;
            return (
              <ProductCard key={product.id} id={product.id} title={product.title} price={product.price}
                image={product.images?.[0]} sellerName={product.profiles?.display_name}
                likeCount={product.likes_count || 0} isLiked={likes.includes(product.id)}
                stockQuantity={product.inventory ?? 0}
                onLike={(id) => likeMutation.mutate(id)}
                onBuyNow={async (productId) => {
                  try {
                    await addToCart(productId, 1);
                    navigate("/cart");
                  } catch {
                    toast.error("Could not add item to cart");
                  }
                }}
                onAddToCart={(productId) => {
                  if ((product.inventory ?? 0) <= 0) {
                    toast.error("This item is out of stock");
                    return;
                  }
                  addToCart(productId, 1);
                }}
                index={i} />
            );
          })}
          {products.length === 0 && !isLoading && (
            <p className="col-span-2 text-center py-8 text-muted-foreground">No products found</p>
          )}
        </div>
        {hasNextPage && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full max-w-xs"
            >
              {isFetchingNextPage ? "Loading more..." : "Load More"}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
