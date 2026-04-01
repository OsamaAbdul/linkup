import { useState, useEffect } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { haversineDistance, formatDistance } from "@/lib/haversine";
import { ProductCard } from "@/features/marketplace/components/ProductCard";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Search as SearchIcon } from "lucide-react";
import { useWishlist } from "@/features/marketplace/hooks/useWishlist";
import { useNavigate, Navigate } from "react-router-dom";
import { useCart } from "@/features/marketplace/context/CartContext";
import { toast } from "sonner";

export default function SearchPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { position } = useGeolocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { likes, toggleLike } = useWishlist();

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
      let q = (supabase as any)
        .from("products")
        .select("id, title, price, images, category, latitude, longitude, inventory, likes_count, seller_id, avg_rating, reviews_count")
        .gt("inventory", 0)
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (query) q = q.ilike("title", `%${query}%`);
      if (selectedCategory !== "All") q = q.eq("category", selectedCategory);

      const { data } = await q.order("created_at", { ascending: false });
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

      return data.map((p: any) => {
        const hasReviews = statsMap[p.id];
        const derivedAvg = hasReviews ? statsMap[p.id].sum / statsMap[p.id].count : 0;
        const derivedCount = hasReviews ? statsMap[p.id].count : 0;
        
        return {
          ...p,
          avg_rating: (p.avg_rating || 0) > 0 ? p.avg_rating : derivedAvg,
          reviews_count: (p.reviews_count || 0) > 0 ? p.reviews_count : derivedCount
        };
      });
    },
  });

  const products = infiniteData?.pages.flat() || [];

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-10" value={queryInput} onChange={(e) => setQueryInput(e.target.value)} aria-label="Search products" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {allCategories.map((c) => (
            <Badge key={typeof c === 'object' ? c.name : c} variant={selectedCategory === (typeof c === 'object' ? c.name : c) ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap" onClick={() => setSelectedCategory(typeof c === 'object' ? c.name : c)}>
              {typeof c === 'object' ? c.name : c}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {products.map((product: any, i: number) => (
            <ProductCard key={product.id} id={product.id} title={product.title} price={product.price}
              image={product.images?.[0]} sellerName={product.profiles?.display_name}
              likeCount={product.likes_count || 0} isLiked={likes.includes(product.id)}
              stockQuantity={product.inventory ?? 0}
              latitude={product.latitude}
              longitude={product.longitude}
              userLocation={position}
              onLike={(id) => toggleLike(id)}
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
              avgRating={product.avg_rating}
              reviewsCount={product.reviews_count}
              index={i} />
          ))}
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
