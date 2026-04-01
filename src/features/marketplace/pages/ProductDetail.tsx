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
import RatingSelector from "@/features/marketplace/components/RatingSelector";
import { useReferral } from "@/features/promoter/hooks/useReferral";
import { cn } from "@/lib/utils";
import { BuyNowModal } from "@/features/marketplace/components/BuyNowModal";
import { m, AnimatePresence } from "framer-motion";
import { ProductReportModal } from "@/features/marketplace/components/ProductReportModal";

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

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold && currentImageIndex < images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    } else if (info.offset.x > swipeThreshold && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

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
        {/* Media Section */}
        <m.div
          className="relative lg:h-fit"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative aspect-square overflow-hidden bg-muted lg:rounded-xl lg:shadow-xl group">
            <Link to="/" aria-label="Go back" className="absolute top-4 left-4 z-20 bg-foreground/20 backdrop-blur-xl p-2.5 rounded-xl text-card hover:bg-foreground/40 transition-all border border-card/10 shadow-lg focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft size={20} />
            </Link>

            <button aria-label="Share product" className="absolute top-4 right-4 z-20 bg-foreground/20 backdrop-blur-xl p-2.5 rounded-xl text-card hover:bg-foreground/40 transition-all border border-card/10 shadow-lg focus-visible:ring-2 focus-visible:ring-ring">
              <Share2 size={20} />
            </button>

            <div className="w-full h-full flex items-center justify-center">
              <AnimatePresence mode="wait">
                {images.length > 0 ? (
                  <m.img
                    key={currentImageIndex}
                    src={images[currentImageIndex]}
                    alt={`${product.title} - image ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover touch-none"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleDragEnd}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image available</div>
                )}
              </AnimatePresence>
            </div>

            {/* Pagination Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10 px-3 py-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      idx === currentImageIndex ? "bg-white w-4" : "bg-white/40"
                    )}
                  />
                ))}
              </div>
            )}

            {/* Desktop Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                  className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 backdrop-blur-xl p-3 rounded-xl text-white hover:bg-black/40 transition-all border border-white/10 opacity-0 group-hover:opacity-100 hidden lg:block",
                    currentImageIndex === 0 && "pointer-events-none opacity-0"
                  )}
                >
                  <ArrowLeft size={20} />
                </button>
                <button
                  onClick={() => setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1))}
                  className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 backdrop-blur-xl p-2.5 rounded-xl text-white hover:bg-black/40 transition-all border border-white/10 opacity-0 group-hover:opacity-100 hidden lg:block",
                    currentImageIndex === images.length - 1 && "pointer-events-none opacity-0"
                  )}
                >
                  <ArrowLeft size={20} className="rotate-180" />
                </button>
              </>
            )}

            {/* Price Floating Badge for Mobile */}
            <div className="absolute bottom-6 right-6 lg:hidden">
              <div className="bg-primary/90 backdrop-blur-xl px-4 py-1.5 rounded-xl border border-white/20 shadow-2xl">
                <p className="text-white font-black text-lg">₦{product.price.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </m.div>

        {/* Content Section */}
        <div className="p-6 lg:p-0 space-y-6 lg:space-y-4">
          <m.div {...animationProps}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className={cn(
                "border-none px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                (product.inventory || 0) > 0
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}>
                {(product.inventory || 0) > 0 ? `In Stock: ${product.inventory}` : "Out of Stock"}
              </Badge>
              {dist && (
                <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border-primary/20 bg-primary/5 text-primary">
                  <MapPin size={12} /> {dist} • {deliveryTime}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-1 text-foreground">{product.title}</h1>
            
            {(() => {
              const derivedReviewsCount = productReviews.length;
              const derivedAvgRating = derivedReviewsCount > 0 
                ? productReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / derivedReviewsCount 
                : 0;
              const displayRating = (product.avg_rating || 0) > 0 ? product.avg_rating : derivedAvgRating;
              const displayCount = (product.reviews_count || 0) > 0 ? product.reviews_count : derivedReviewsCount;

              return (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={16} 
                        fill={i < Math.floor(displayRating) ? "currentColor" : "none"} 
                        className={cn("transition-colors", i < Math.floor(displayRating) ? "drop-shadow-[0_0_2px_rgba(251,191,36,0.5)]" : "text-muted-foreground/60")} 
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold">
                    {displayRating > 0 ? displayRating.toFixed(1) : "New"}
                    {displayCount > 0 && ` (${displayCount} ${displayCount === 1 ? 'review' : 'reviews'})`}
                  </span>
                </div>
              );
            })()}

            <div className="hidden lg:block">
              <p className="text-4xl font-black text-primary leading-tight">₦{product.price.toLocaleString()}</p>
              {(product as any).category && (
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">{(product as any).category}</span>
              )}
            </div>
          </m.div>

          {/* Sizes Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <m.div {...animationProps} transition={{ delay: 0.05 }} className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">Select Size</Label>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size: string) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={cn(
                      "h-12 w-16 rounded-xl border-2 font-black text-xs transition-all",
                      selectedSize === size
                        ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                        : "bg-surface border-border/50 text-foreground/70 hover:border-primary/50"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </m.div>
          )}

          {/* Action Row */}
          <m.div {...animationProps} transition={{ delay: 0.1 }} className="lg:space-y-3 space-y-4">
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 lg:h-11 rounded-xl text-base lg:text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={handleAddToCart}
                disabled={(product.inventory || 0) <= 0}
              >
                <ShoppingCart className="mr-2" size={20} /> Add to Cart
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 lg:h-11 rounded-xl text-base lg:text-sm font-black uppercase tracking-widest border-primary text-primary hover:bg-primary/5 transition-all"
                onClick={() => {
                  if (product.sizes && product.sizes.length > 0 && !selectedSize) {
                    toast.error("Please select a size first");
                    return;
                  }
                  if ((product.inventory || 0) <= 0) {
                    toast.error("Out of stock");
                    return;
                  }
                  addToCart(id!, 1, selectedSize || undefined);
                  navigate("/checkout");
                }}
                disabled={(product.inventory || 0) <= 0}
              >
                Buy Now
              </Button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => toggleLike(id!)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-12 lg:h-10 rounded-xl border transition-all text-sm font-bold shadow-sm",
                  isProductLiked
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-surface border-border text-foreground/70"
                )}
              >
                <Heart size={18} className={cn(isProductLiked && "fill-current")} />
                {isProductLiked ? "Saved" : "Save Item"}
              </button>

              <button
                onClick={async () => {
                  if (!user) {
                    toggleAuth();
                    return;
                  }
                  if (user.id === product.seller_id) {
                    toast.error("You cannot chat with yourself");
                    return;
                  }

                  const { data: existing } = await (supabase as any)
                    .from("conversations")
                    .select("id")
                    .eq("product_id", id!)
                    .eq("buyer_id", user.id)
                    .eq("seller_id", product.seller_id)
                    .maybeSingle();

                  if (existing) {
                    navigate(`/chat/${existing.id}`);
                  } else {
                    const { data: newConv, error } = await (supabase as any)
                      .from("conversations")
                      .insert({
                        product_id: id!,
                        buyer_id: user.id,
                        seller_id: product.seller_id
                      })
                      .select("id")
                      .single();

                    if (error) {
                      toast.error("Failed to initiate secure channel");
                      return;
                    }
                    navigate(`/chat/${newConv.id}`);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 h-12 lg:h-10 rounded-xl bg-surface border border-border text-foreground/70 hover:bg-muted transition-all text-sm font-bold shadow-sm"
              >
                <MessageSquare size={18} />
                Ask Our Partner
              </button>
            </div>
          </m.div>

          <Separator className="opacity-50" />

          {/* Seller & Trust Tags */}
          <m.div {...animationProps} transition={{ delay: 0.2 }} className="flex flex-wrap gap-x-6 gap-y-3 py-4 border-y border-border/40">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary" size={20} />
              <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80">Authenticity Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-primary" size={20} />
              <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80">Fast Delivery</span>
            </div>
          </m.div>

          {/* Detailed Content */}
          <m.div {...animationProps} transition={{ delay: 0.3 }} className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl font-bold">About this item</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {product.description || "No description available."}
              </p>
            </div>

            <div className="p-3 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(product as any).profiles?.avatar_url ? (
                  <img
                    src={(product as any).profiles.avatar_url}
                    alt={(product as any).profiles.display_name ?? "Seller"}
                    className="h-12 w-12 rounded-xl object-cover shadow-sm border border-border/30"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-foreground/20 flex items-center justify-center text-white font-black text-lg shadow-inner">
                    {(product as any).profiles?.display_name?.[0]?.toUpperCase() ?? "S"}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Offered by</p>
                  <p className="text-base font-black">{(product as any).profiles?.display_name ?? "Seller"}</p>
                  {(product as any).profiles?.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{(product as any).profiles.bio}</p>
                  )}
                </div>
              </div>

            </div>
          </m.div>

          <div className="flex justify-center pt-2">
            <ProductReportModal
              productId={product.id}
              sellerId={product.seller_id}
              productTitle={product.title}
            />
          </div>


          {/* Reviews Section */}
          <m.div {...animationProps} transition={{ delay: 0.4 }} className="space-y-6 pt-6 border-t border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black tracking-tight">Customer Reviews</h3>
              <span className="px-3 py-1 bg-muted rounded-full text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {productReviews.length} Review{productReviews.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Review Input */}
            <div className="bg-muted/20 p-6 rounded-2xl border border-border/50 space-y-4">
              <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Rate this product</h4>
              <RatingSelector rating={rating} setRating={setRating} />
              <div className="relative group">
                <Input
                  placeholder={user ? "Share your experience with this product..." : "Sign in to leave a review..."}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onFocus={() => !user && toggleAuth()}
                  className="h-12 pl-6 pr-14 rounded-xl bg-background border-border/50 group-focus-within:border-primary/50 transition-all shadow-inner"
                />
                <button
                  aria-label="Submit review"
                  className="absolute right-3 top-[0.5rem] p-2 bg-primary text-primary-foreground rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
                  onClick={() => commentText.trim() && reviewMutation.mutate()}
                  disabled={!commentText.trim() || reviewMutation.isPending}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {productReviews.map((r: any, idx: number) => (
                  <m.div
                    key={r.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-4 group pb-6 border-b border-border/30 last:border-0"
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {r.profiles?.avatar_url ? (
                        <img src={r.profiles.avatar_url} alt={r.profiles.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xs">
                          {r.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-foreground">{r.profiles?.display_name ?? "Anonymous"}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex text-yellow-500">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={10} fill={i < r.rating ? "currentColor" : "none"} className={i < r.rating ? "drop-shadow-[0_0_2px_rgba(251,191,36,0.3)]" : "text-muted-foreground/30"} />
                          ))}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl border border-border/20 group-hover:bg-muted/50 transition-colors">
                        <p className="text-sm leading-relaxed text-foreground/90">{r.review_text}</p>
                      </div>
                    </div>
                  </m.div>
                ))}
              </AnimatePresence>
              {productReviews.length === 0 && (
                <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed border-border/50">
                  <Star className="mx-auto text-muted-foreground/30 mb-3" size={32} />
                  <p className="text-muted-foreground italic font-medium">No reviews yet. Be the first to rate this product!</p>
                </div>
              )}
            </div>
          </m.div>
        </div>

        {/* Global Floating Action Bar for Mobile */}
        <div className="fixed bottom-0 left-0 right-0 lg:hidden z-50 p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="bg-foreground/90 backdrop-blur-3xl p-3 px-4 rounded-xl border border-white/10 shadow-2xl flex items-center justify-between gap-4">
            <div className="flex flex-col pl-2">
              <span className="text-[10px] text-accent font-bold uppercase tracking-widest leading-none mb-1">Total Due</span>
              <span className="text-card font-black text-lg leading-none">₦{product.price.toLocaleString()}</span>
            </div>
            <Button
              className="bg-primary text-primary-foreground h-11 rounded-xl px-8 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 flex-1"
              onClick={() => {
                if (product.sizes && product.sizes.length > 0 && !selectedSize) {
                  toast.error("Please select a size first");
                  return;
                }
                if ((product.inventory || 0) <= 0) {
                  toast.error("This item is out of stock");
                  return;
                }
                addToCart(id!, 1, selectedSize || undefined);
                navigate("/checkout");
              }}
            >
              Buy Now
            </Button>
          </div>
        </div>
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
