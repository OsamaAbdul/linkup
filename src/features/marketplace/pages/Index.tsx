import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useCart } from "@/features/marketplace/context/CartContext";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { haversineDistance, formatDistance } from "@/lib/haversine";
import { ProductCard } from "@/features/marketplace/components/ProductCard";
import { useWishlist } from "@/features/marketplace/hooks/useWishlist";
import { useReferral } from "@/features/promoter/hooks/useReferral";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { WeaveSpinner } from "@/shared/components/ui/weave-spinner";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Search, SlidersHorizontal, Filter, ChevronDown, X, Grid, MapPin,
  Heart, Sparkles, Shirt, Laptop, Home as HomeIcon, ShoppingBag, Apple,
  ChevronLeft, ChevronRight,
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
} from "@/shared/components/ui/sheet";
import { Slider } from "@/shared/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

import { useCategories, useZones } from "@/shared/hooks/use-marketplace-metadata";

// Icon map for categories €” avoids importing entire lucide-react tree
const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Grid, Heart, Sparkles, Shirt, Laptop, Home: HomeIcon, ShoppingBag, Apple, MapPin,
  Filter, Search, SlidersHorizontal, ChevronDown, X,
};

const TABS = ["All Products", "Health & Beauty", "Electronics", "Fashion", "Home & Kitchen", "Grocery"];

export default function Index() {
  const { user, roles, loading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const { position, loading: geoLoading, refresh: refreshGeo } = useGeolocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { likes, toggleLike } = useWishlist();
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
  const [page, setPage] = useState(0);

  // Reset to first page whenever any filter changes
  useEffect(() => { setPage(0); }, [searchQuery, selectedTab, sortOption, priceRange, selectedZone]);

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

  const { data: dbCategories = [] } = useCategories();
  const { data: zones = [] } = useZones();

  // Automatic Zone Matching
  useEffect(() => {
    if (position && zones.length > 0 && !selectedZone) {
      let closestZone = null;
      let minDistance = Infinity;

      zones.forEach((zone: any) => {
        if (zone.latitude && zone.longitude) {
          const dist = haversineDistance(
            position.latitude,
            position.longitude,
            zone.latitude,
            zone.longitude
          );
          if (dist < minDistance) {
            minDistance = dist;
            closestZone = zone.id;
          }
        }
      });

      if (closestZone && minDistance < 10) { // Only auto-select if within 10km
        setSelectedZone(closestZone);
        toast.info(`Detected closest node: ${zones.find((z: any) => z.id === closestZone)?.name}`);
      }
    }
  }, [position, zones, selectedZone]);

  const CATEGORY_TABS = [{ name: "All Products", icon: "Grid" }, ...dbCategories];

  const { data: infiniteProducts, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["products", searchQuery, selectedTab, sortOption, priceRange, selectedZone],
    getNextPageParam: (lastPage: any[], allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      // Use RPC for "nearby" sorting if position is available
      if (sortOption === "nearby" && position) {
        const { data, error } = await (supabase as any).rpc("get_nearby_products", {
          p_latitude: position.latitude,
          p_longitude: position.longitude,
          p_category: selectedTab,
          p_min_price: priceRange[0],
          p_max_price: priceRange[1],
          p_search: searchQuery,
          p_limit: PAGE_SIZE,
          p_offset: pageParam * PAGE_SIZE
        });
        if (error) throw error;
        // Map RPC results to match the expected structure
        return (data as any[]).map((d: any) => ({
          ...d,
          cities: { name: d.city_name },
          delivery_zones: { name: d.zone_name }
        }));
      }

      let q = (supabase as any)
        .from("products")
        .select(`
          id, title, price, images, category, inventory, likes_count, seller_id, 
          latitude, longitude, avg_rating, reviews_count,
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

      return data || [];
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

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const displayProducts = infiniteProducts?.pages.flat() || [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12 max-w-7xl mx-auto">
        {/* Header Section */}
        {/* <div className="space-y-3">
          <h1 className="text-5xl font-black text-foreground tracking-tight sm:text-6xl">Marketplace</h1>
          <p className="text-muted-foreground font-medium text-xl opacity-70">Elevate your lifestyle with our curated daily picks.</p>
        </div> */}

        {/* Command Center: Glassmorphism Search & Filters */}
        <div className="flex flex-row gap-2 sm:gap-4 items-center">
          <div className="relative flex-1 w-full group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-primary/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition duration-1000" />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 sm:h-5 sm:w-5 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search products, brands..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 sm:pl-12 bg-white/70 backdrop-blur-2xl border-border/30 h-11 sm:h-12 rounded-xl text-[13px] sm:text-sm font-medium shadow-sm transition-all focus:bg-white focus:ring-0 focus:border-primary/30"
                aria-label="Search products"
              />
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 sm:h-12 px-3 sm:px-6 gap-2 bg-white/90 backdrop-blur-md border-border/30 rounded-xl font-black text-muted-foreground hover:text-foreground hover:bg-white shadow-sm transition-all active:scale-95 shrink-0 uppercase tracking-widest text-[8px] sm:text-[9px] w-auto">
                <SlidersHorizontal size={16} />
                <span className="hidden xs:inline">Filters</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md rounded-l-2xl border-none shadow-2xl p-0 overflow-hidden">
              <div className="h-full flex flex-col">
                <SheetHeader className="p-6 pb-0">
                  <SheetTitle className="text-xl font-black tracking-tighter">Refine Hub</SheetTitle>
                  <SheetDescription className="text-sm font-medium">Precision filters for your perfect find.</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 no-scrollbar">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                      Sort Order
                    </h3>
                    <RadioGroup value={sortOption} onValueChange={setSortOption} className="gap-1.5">
                      {["newest", "price_asc", "price_desc", "nearby"].map((val) => (
                        <div key={val} className="flex items-center space-x-2.5 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50">
                          <RadioGroupItem value={val} id={val} className="text-primary border-primary/30" />
                          <Label htmlFor={val} className="font-bold flex-1 cursor-pointer capitalize text-xs">
                            {val === "nearby" ? "Nearby (Proximity)" : val.replace("_", ": ").replace("asc", "Low to High").replace("desc", "High to Low")}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <Separator className="opacity-30" />

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Price Spectrum
                      </h3>
                      <span className="text-base font-black text-primary">₦{priceRange[1].toLocaleString()}+</span>
                    </div>
                    <Slider
                      defaultValue={[0, 1000000]}
                      max={1000000}
                      step={5000}
                      value={priceRange}
                      onValueChange={setPriceRange}
                      className="py-2"
                    />
                  </div>

                  <Separator className="opacity-30" />

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      Regional Access
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedZone("")}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                          !selectedZone ? "bg-primary text-white border-primary shadow-xl shadow-primary/20" : "bg-muted/30 text-muted-foreground border-transparent hover:border-primary/20"
                        )}
                      >
                        All Zones
                      </button>
                      {zones.map((z: any) => (
                        <button
                          key={z.id}
                          onClick={() => setSelectedZone(z.id)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                            selectedZone === z.id ? "bg-primary text-white border-primary shadow-xl shadow-primary/20" : "bg-muted/30 text-muted-foreground border-transparent hover:border-primary/20"
                          )}
                        >
                          {z.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <Button variant="ghost" className="w-full h-12 rounded-xl font-black uppercase text-[9px] tracking-[0.25em] text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-all" onClick={() => {
                    setSortOption("newest");
                    setPriceRange([0, 1000000]);
                    setSelectedZone("");
                  }}>
                    Reset Parameters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Premium Category Navigation */}
        <div className="relative pt-1">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
            {CATEGORY_TABS.map(tab => {
              const Icon = CATEGORY_ICON_MAP[(tab as any).icon] || Grid;
              const tabName = (tab as any).name;
              const isActive = selectedTab === tabName;
              return (
                <button
                  key={tabName}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedTab(tabName)}
                  className={cn(
                    "px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-xl text-[10px] sm:text-[11px] font-black transition-all flex items-center gap-2 sm:gap-3 shrink-0 group relative shadow-sm border",
                    isActive
                      ? "bg-primary border-primary text-white shadow-xl sm:shadow-2xl shadow-primary/30 -translate-y-0.5"
                      : "bg-white border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:shadow-md"
                  )}
                >
                  <Icon size={14} className={cn("transition-transform group-hover:scale-125 duration-500", isActive && "text-white scale-110")} />
                  <span className="tracking-tight">{tabName}</span>
                </button>
              );
            })}
          </div>
          {/* Subtle Fade Edge */}
          <div className="absolute right-0 top-0 bottom-2 w-20 bg-gradient-to-l from-[#fafafa] to-transparent pointer-events-none" />
        </div>

        {/* Localized Marketplace Bar */}
        {zones.length > 0 && (
          <div className="flex items-center gap-4 py-2">
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-r pr-6 mr-2">
              <MapPin size={14} className="text-primary" />
              Market Node
              {position && (
                <Badge variant="outline" className="h-5 px-1.5 text-[8px] border-success/30 bg-success/5 text-success animate-in fade-in zoom-in duration-500 ml-1">
                  Live Precision
                </Badge>
              )}
            </div>
            <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshGeo}
                disabled={geoLoading}
                className="px-6 py-6 rounded-xl bg-white border-border/30 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all shrink-0 gap-2 hover:bg-primary/5 hover:text-primary active:scale-95"
              >
                <MapPin size={14} className={cn(geoLoading && "animate-pulse")} />
                {geoLoading ? "Detecting..." : "Detect Location"}
              </Button>

              <button
                onClick={() => setSelectedZone("")}
                className={cn(
                  "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all shrink-0",
                  !selectedZone ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105" : "bg-white text-muted-foreground border border-border/30 hover:bg-muted/30"
                )}
              >
                Nationwide
              </button>
              {zones.map((z: any) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZone(z.id)}
                  className={cn(
                    "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all shrink-0",
                    selectedZone === z.id ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105" : "bg-white text-muted-foreground border border-border/30 hover:bg-muted/30"
                  )}
                >
                  {z.name}
                </button>
              ))}
            </div>
          </div>
        )}


        {/* Product Grid */}
        <div className={cn("grid gap-3 sm:gap-6", isLoading ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4")}>
          {isLoading ? (
            <div className="flex justify-center items-center py-24 min-h-[300px]">
              <WeaveSpinner />
            </div>
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
                latitude={product.latitude}
                longitude={product.longitude}
                userLocation={position}
                onLike={(id) => toggleLike(id)}
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
                avgRating={product.avg_rating}
                reviewsCount={product.reviews_count}
              />
            ))
          )}
        </div>

        {hasNextPage && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isFetchingNextPage ? (
              <WeaveSpinner />
            ) : (
              <div className="h-10"></div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}

