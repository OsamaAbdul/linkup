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
import { WeaveSpinner } from "@/shared/components/ui/weave-spinner";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

import { useCategories, useZones } from "@/shared/hooks/use-marketplace-metadata";

import { MarketplaceSearchBar } from "../components/home/MarketplaceSearchBar";
import { MarketplaceCategoryNav } from "../components/home/MarketplaceCategoryNav";
import { MarketplaceZoneNav } from "../components/home/MarketplaceZoneNav";
import { MarketplaceEmptyState } from "../components/home/MarketplaceEmptyState";

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

        <MarketplaceSearchBar
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          sortOption={sortOption}
          setSortOption={setSortOption}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          zones={zones}
          onReset={() => {
            setSearchInput("");
            setSearchQuery("");
            setSelectedTab("All Products");
            setSortOption("newest");
            setPriceRange([0, 1000000]);
            setSelectedZone("");
          }}
        />

        <MarketplaceCategoryNav
          categories={dbCategories}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
        />

        <MarketplaceZoneNav
          zones={zones}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          position={position}
          geoLoading={geoLoading}
          onRefreshGeo={refreshGeo}
        />

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24 min-h-[300px]">
            <WeaveSpinner />
          </div>
        ) : displayProducts.length === 0 ? (
          <MarketplaceEmptyState 
            onReset={() => {
              setSearchInput("");
              setSearchQuery("");
              setSelectedTab("All Products");
              setSortOption("newest");
              setPriceRange([0, 1000000]);
              setSelectedZone("");
            }}
          />
        ) : (
          <div className="grid gap-3 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {displayProducts.map((product: any, i) => (
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
            ))}
          </div>
        )}

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

