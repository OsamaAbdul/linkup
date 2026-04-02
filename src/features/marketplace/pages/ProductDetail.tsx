import { useParams, Navigate, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useCart } from "@/features/marketplace/context/CartContext";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { haversineDistance, formatDistance } from "@/lib/haversine";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Heart, ShoppingCart, Send, ArrowLeft, Share2, MapPin, ShieldCheck, Clock, MessageSquare, Star } from "lucide-react";
import { useWishlist } from "@/features/marketplace/hooks/useWishlist";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useReferral } from "@/features/promoter/hooks/useReferral";
import { cn } from "@/lib/utils";
import { BuyNowModal } from "@/features/marketplace/components/BuyNowModal";
import { m } from "framer-motion";
import { ProductReportModal } from "@/features/marketplace/components/ProductReportModal";

// New components
import { ProductGallery } from "../components/product-detail/ProductGallery";
import { ProductHeader } from "../components/product-detail/ProductHeader";
import { ProductActions } from "../components/product-detail/ProductActions";
import { ProductTrustTags } from "../components/product-detail/ProductTrustTags";
import { ProductDescription } from "../components/product-detail/ProductDescription";
import { SellerCard } from "../components/product-detail/SellerCard";
import { ProductReviews } from "../components/product-detail/ProductReviews";
import { MobileActionFooter } from "../components/product-detail/MobileActionFooter";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const { position } = useGeolocation();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [rating, setRating] = useState(5);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isBuyNowOpen, setIsBuyNowOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  useReferral();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select(`
          id, title, price, images, description,
          latitude, longitude, inventory, seller_id, category,
          avg_rating, reviews_count, sizes,
          profiles!products_seller_id_fkey(display_name, avatar_url, bio)
        `)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { likes, toggleLike } = useWishlist();
  const isProductLiked = likes.includes(id!);

  const { data: likeCount = 0 } = useQuery({
    queryKey: ["like-count", id],
    queryFn: async () => {
      const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("product_id", id!);
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: productReviews = [] } = useQuery({
    queryKey: ["product-reviews", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("product_reviews")
        .select("*, profiles!product_reviews_user_id_fkey(display_name, avatar_url)")
        .eq("product_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`product-detail-sync-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_reviews", filter: `product_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["product-reviews", id] });
        queryClient.invalidateQueries({ queryKey: ["product", id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["product", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `product_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["like-count", id] });
        if (user) queryClient.invalidateQueries({ queryKey: ["my-likes", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient, user]);

  const toggleAuth = () => {
    toast.error("Please sign in to continue");
    navigate("/auth");
  };

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        toggleAuth();
        return;
      }
      const { error } = await (supabase as any)
        .from("product_reviews")
        .upsert({
          user_id: user.id,
          product_id: id!,
          rating: rating,
          review_text: commentText
        }, { onConflict: 'user_id,product_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      setRating(5);
      toast.success("Review submitted!");
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["product-reviews", id] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit review");
    }
  });


  if (isLoading) return (
    <AppLayout hideBottomNav>
      <div className="p-4 sm:p-8 space-y-4">
        <Skeleton className="w-full aspect-square rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </AppLayout>
  );

  if (!product) return <AppLayout hideBottomNav><div className="p-4 text-center">Product not found</div></AppLayout>;

  const rawDist = position && product.latitude && product.longitude
    ? haversineDistance(position.latitude, position.longitude, product.latitude, product.longitude)
    : null;
  const dist = rawDist ? formatDistance(rawDist) : null;
  const deliveryTime = rawDist ? `${Math.round(rawDist * 2.5 + 15)}-${Math.round(rawDist * 4 + 25)}mins` : null;

  const animationProps = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut" as any }
  };


  const images = product.images || [];

  const handleAddToCart = () => {
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      toast.error("Please select a size first");
      return;
    }
    if ((product.inventory || 0) <= 0) {
      toast.error("Out of stock");
      return;
    }
    addToCart(id!, 1, selectedSize || undefined);
  };

  return (
    <AppLayout hideBottomNav>
      <div className="pb-32 bg-background lg:grid lg:grid-cols-2 lg:gap-12 lg:max-w-7xl lg:mx-auto lg:p-12">
        <ProductGallery
          images={images}
          currentImageIndex={currentImageIndex}
          setCurrentImageIndex={setCurrentImageIndex}
          productTitle={product.title}
          productPrice={product.price}
        />

        {/* Content Section */}
        <div className="p-6 lg:p-0 space-y-6 lg:space-y-4">
          <ProductHeader
            product={product}
            dist={dist}
            deliveryTime={deliveryTime}
            productReviews={productReviews}
            animationProps={animationProps}
          />

          <ProductActions
            product={product}
            selectedSize={selectedSize}
            setSelectedSize={setSelectedSize}
            handleAddToCart={handleAddToCart}
            isProductLiked={isProductLiked}
            toggleLike={toggleLike}
            user={user}
            animationProps={animationProps}
            toggleAuth={toggleAuth}
          />

          <Separator className="opacity-50" />

          <ProductTrustTags animationProps={animationProps} />

          <ProductDescription
            description={product.description}
            animationProps={animationProps}
          />

          <SellerCard
            seller={(product as any).profiles}
            animationProps={animationProps}
          />

          <div className="flex justify-center pt-2">
            <ProductReportModal
              productId={product.id}
              sellerId={product.seller_id}
              productTitle={product.title}
            />
          </div>

          <ProductReviews
            productReviews={productReviews}
            user={user}
            rating={rating}
            setRating={setRating}
            commentText={commentText}
            setCommentText={setCommentText}
            toggleAuth={toggleAuth}
            reviewMutation={reviewMutation}
            animationProps={animationProps}
          />
        </div>

        {/* Global Floating Action Bar for Mobile */}
        <MobileActionFooter
          product={product}
          selectedSize={selectedSize}
          addToCart={addToCart}
        />
      </div>

      <BuyNowModal
        product={product}
        isOpen={isBuyNowOpen}
        onClose={() => setIsBuyNowOpen(false)}
      />
    </AppLayout>
  );
}

const Separator = ({ className }: { className?: string }) => <div className={cn("h-[1px] w-full bg-border", className)} />;
