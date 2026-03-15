import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineDistance, formatDistance } from "@/lib/haversine";
import { ProductCard } from "@/components/products/ProductCard";
import { useReferral } from "@/hooks/useReferral";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, SlidersHorizontal, Filter, ChevronDown, X, Grid, MapPin,
  Heart, Sparkles, Shirt, Laptop, Home as HomeIcon, ShoppingBag, Apple,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

// Icon map for categories — avoids importing entire lucide-react tree
const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Grid, Heart, Sparkles, Shirt, Laptop, Home: HomeIcon, ShoppingBag, Apple, MapPin,
  Filter, Search, SlidersHorizontal, ChevronDown, X,
};



const TABS = ["All Products", "Health & Beauty", "Electronics", "Fashion", "Home & Kitchen", "Grocery"];

export default function Index() {
  const { user, roles, loading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const position = useGeolocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useReferral();

  const isPromoter = roles.includes("promoter");

  // Get promoter code if user is a promoter
  const { data: promoterCode } = useQuery({
    queryKey: ["my-promoter-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("promoter_codes").select("code").eq("user_id", user.id).maybeSingle();
      return data?.code ?? null;
    },
    enabled: !!user && isPromoter,
  });
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [selectedZone, setSelectedZone] = useState("");
  const selectedTab = searchParams.get("category") || "All Products";
  const setSelectedTab = (category: string) => {
    setSearchParams(prev => {
      if (category === "All Products") prev.delete("category");
      else prev.set("category", category);
      return prev;
    });
  };

  const [sortOption, setSortOption] = useState("newest");
  const [priceRange, setPriceRange] = useState([0, 1000000]);

  // Real-time cache invalidation
  useEffect(() => {
    const productChannel = supabase
      .channel("products-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .subscribe();

    let likesChannel: any;
    if (user) {
      likesChannel = supabase
        .channel(`likes-changes-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "likes", filter: `user_id=eq.${user.id}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ["my-likes", user.id] });
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(productChannel);
      if (likesChannel) supabase.removeChannel(likesChannel);
    };
  }, [queryClient, user]);

  const PAGE_SIZE = 12;

  const { data: dbCategories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("categories").select("name, icon").order("name");
      return (data as any[]) ?? [];
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["marketplace-zones"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_zones").select("id, name, city_id, cities:city_id(name)").eq("is_active", true).order("name");
      return (data as any[]) ?? [];
    },
  });

  const CATEGORY_TABS = [{ name: "All Products", icon: "Grid" }, ...dbCategories];

  const { data: infiniteProducts, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["products", searchQuery, selectedTab, sortOption, priceRange, selectedZone],
    getNextPageParam: (lastPage: any[], allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let q = (supabase as any)
        .from("products")
        .select(`
          id, title, price, images, category, inventory, likes_count, seller_id, 
          cities:city_id(name),
          delivery_zones:zone_id(name)
        `)
        .gt("inventory", 0)
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      // Sorting
      if (sortOption === "price_asc") {
        q = q.order("price", { ascending: true });
      } else if (sortOption === "price_desc") {
        q = q.order("price", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
      }

      if (searchQuery) {
        q = q.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Category Filter
      if (selectedTab !== "All Products") {
        q = q.eq("category", selectedTab);
      }

      // Price Filter
      if (priceRange[0] > 0) q = q.gte("price", priceRange[0]);
      if (priceRange[1] < 1000000) q = q.lte("price", priceRange[1]);

      // Zone Filter
      if (selectedZone) q = q.eq("zone_id", selectedZone);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["my-likes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("likes").select("product_id").eq("user_id", user.id);
      return data?.map((l) => l.product_id) ?? [];
    },
    enabled: !!user,
  });

  const likeMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) {
        toast.error("Please sign in to like products");
        navigate("/auth");
        return;
      }
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

      // Cancel relevant queries
      await queryClient.cancelQueries({ queryKey: ["my-likes", user.id] });
      await queryClient.cancelQueries({ queryKey: ["products"] });

      // 1. Update the 'liked' state instantly
      const prevLikes = queryClient.getQueryData<string[]>(["my-likes", user.id]);
      const currentlyLiked = prevLikes?.includes(productId);

      queryClient.setQueryData(["my-likes", user.id], (old: string[] = []) =>
        currentlyLiked ? old.filter((id) => id !== productId) : [...old, productId]
      );

      // 2. Update the 'likes_count' instantly
      queryClient.setQueriesData({ queryKey: ["products"] }, (oldData: any) => {
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

      return { prevLikes };
    },
    onError: (_err, _id, context) => {
      if (user) {
        queryClient.setQueryData(["my-likes", user.id], context?.prevLikes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-likes", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["like-counts"] });
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      await addToCart(productId, 1);
    },
  });

  const handleBuyNow = async (product: any) => {
    if ((product.inventory ?? 0) <= 0) {
      toast.error("This item is out of stock");
      return;
    }
    try {
      await addToCart(product.id, 1);
      navigate("/cart");
    } catch {
      toast.error("Could not add item to cart");
    }
  };


  const displayProducts = infiniteProducts?.pages.flat() || [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back! Here's what's trending.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search products, brands, or sellers..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 bg-card border-border/60 h-11"
              aria-label="Search products"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 px-4 gap-2 bg-white text-muted-foreground hover:text-foreground">
                <SlidersHorizontal size={16} />
                Filters & Sort
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Refine your search results</SheetDescription>
              </SheetHeader>
              <div className="py-6 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Sort By</h3>
                  <RadioGroup value={sortOption} onValueChange={setSortOption}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="newest" id="newest" />
                      <Label htmlFor="newest">Newest Arrivals</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="price_asc" id="price_asc" />
                      <Label htmlFor="price_asc">Price: Low to High</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="price_desc" id="price_desc" />
                      <Label htmlFor="price_desc">Price: High to Low</Label>
                    </div>
                  </RadioGroup>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <h3 className="text-sm font-medium">Price Range</h3>
                    <span className="text-xs text-muted-foreground">₦{priceRange[0].toLocaleString()} - ₦{priceRange[1].toLocaleString()}+</span>
                  </div>
                  <Slider
                    defaultValue={[0, 1000000]}
                    max={1000000}
                    step={5000}
                    value={priceRange}
                    onValueChange={setPriceRange}
                    className="py-4"
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Zone</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedZone("")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        !selectedZone ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      All Zones
                    </button>
                    {zones.map((z: any) => (
                      <button
                        key={z.id}
                        onClick={() => setSelectedZone(z.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          selectedZone === z.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
                        )}
                      >
                        {z.name}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <Button variant="outline" className="w-full" onClick={() => {
                  setSortOption("newest");
                  setPriceRange([0, 1000000]);
                  setSelectedZone("");
                }}>
                  Clear All Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="bg-card p-1 rounded-xl border inline-flex flex-wrap gap-1" role="tablist" aria-label="Product categories">
          {CATEGORY_TABS.map(tab => {
            const Icon = CATEGORY_ICON_MAP[tab.icon] || Grid;
            const isActive = selectedTab === tab.name;
            return (
              <button
                key={tab.name}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedTab(tab.name)}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Zone Quick Filters */}
        {zones.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
            <button
              onClick={() => setSelectedZone("")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0",
                !selectedZone ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              All Zones
            </button>
            {zones.map((z: any) => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0",
                  selectedZone === z.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {z.name}
              </button>
            ))}
          </div>
        )}


        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))
          ) : (
            displayProducts.map((product: any, i) => (
              <ProductCard
                key={`${product.id}-${i}`}
                id={product.id}
                title={product.title}
                price={product.price}
                oldPrice={product.oldPrice}
                image={product.images?.[0]}
                sellerName={product.profiles?.display_name}
                likeCount={product.likes_count || 0}
                isLiked={likes.includes(product.id)}
                cityName={product.cities?.name}
                zoneName={product.delivery_zones?.name}
                stockQuantity={product.inventory ?? 0}
                onLike={(id) => likeMutation.mutate(id)}
                onBuyNow={() => handleBuyNow(product)}
                onAddToCart={() => {
                  if ((product.inventory ?? 0) <= 0) {
                    toast.error("This item is out of stock");
                    return;
                  }
                  addToCartMutation.mutate(product.id);
                }}
                index={i}
                isPromoter={isPromoter}
                promoterCode={promoterCode}
              />
            ))
          )}
        </div>

        {hasNextPage && (
          <div className="flex justify-center py-8">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="min-w-[200px]"
            >
              {isFetchingNextPage ? "Loading more..." : "Load More Products"}
            </Button>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
