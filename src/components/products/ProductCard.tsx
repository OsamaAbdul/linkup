import { Heart, Star, ShoppingCart, MapPin, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  oldPrice?: number;
  image?: string;
  sellerName?: string;
  likeCount: number;
  isLiked: boolean;
  cityName?: string;
  zoneName?: string;
  stockQuantity?: number;
  onLike: (id: string) => void;
  onBuyNow?: (id: string) => void;
  onAddToCart?: (id: string) => void;
  index?: number;
  isPromoter?: boolean;
  promoterCode?: string | null;
}

export function ProductCard({
  id, title, price, oldPrice, image, sellerName, likeCount, isLiked, cityName, zoneName, stockQuantity, onLike, onBuyNow, onAddToCart, index = 0, isPromoter, promoterCode,
}: ProductCardProps) {
  const isOutOfStock = stockQuantity !== undefined && stockQuantity <= 0;
  const isLowStock = !isOutOfStock && stockQuantity !== undefined && stockQuantity <= 5;
  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onBuyNow) onBuyNow(id);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) onAddToCart(id);
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
      className="h-full"
    >
      <Card className="group h-full overflow-hidden border border-border/40 bg-card premium-shadow-hover rounded-2xl flex flex-col transition-all duration-500 hover:border-primary/20">
        <Link to={`/product/${id}`} className="block relative">
          <div className="aspect-[4/3] bg-muted relative overflow-hidden">
            {image ? (
              <img
                src={image}
                alt={title}
                className={cn(
                  "w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110",
                  isOutOfStock && "opacity-50 grayscale"
                )}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-secondary/50">No image</div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Out of Stock overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <span className="bg-destructive/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-xl border border-white/10">Out of Stock</span>
              </div>
            )}

            {/* Low stock warning */}
            {isLowStock && (
              <div className="absolute bottom-3 left-3">
                <span className="glass text-foreground dark:text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">Only {stockQuantity} left</span>
              </div>
            )}

            <button
              onClick={(e) => { e.preventDefault(); onLike(id); }}
              aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
              className="absolute top-3 right-3 p-2 rounded-full glass hover:bg-white hover:text-destructive dark:hover:bg-black transition-all duration-300 z-10 shadow-lg group/heart"
            >
              <Heart
                size={18}
                className={cn("transition-all duration-500", isLiked ? "fill-destructive text-destructive scale-110" : "text-foreground group-hover/heart:scale-110")}
              />
            </button>

            {/* Quick action button overlay on hover */}
            {!isOutOfStock && !isPromoter && (
              <div className="absolute inset-x-3 bottom-0 translate-y-full group-hover:-translate-y-3 transition-transform duration-500 pointer-events-none group-hover:pointer-events-auto">
                <Button
                  size="sm"
                  className="w-full glass text-foreground font-bold text-xs h-10 shadow-2xl border-white/20"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart size={16} className="mr-2" /> Quick Add
                </Button>
              </div>
            )}
          </div>
        </Link>

        <CardContent className="p-4 flex flex-col flex-1 space-y-3">
          <div className="flex-1 space-y-1.5">
            <Link to={`/product/${id}`} className="block">
              <h3 className="font-heading font-semibold text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-300">{title}</h3>
            </Link>

            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5">
                <div className="flex text-warning">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={11} fill={i < 4 ? "currentColor" : "none"} className={i < 4 ? "" : "text-muted/40"} />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground font-semibold">4.8</span>
              </div>

              {zoneName ? (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin size={10} className="text-primary" />
                  <span className="text-[10px] font-medium uppercase tracking-tight">{zoneName.split('(')[0].trim()}</span>
                </div>
              ) : cityName && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin size={10} className="text-primary" />
                  <span className="text-[10px] font-medium uppercase tracking-tight">{cityName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Price</span>
              <div className="font-heading font-bold text-xl text-primary">₦{price.toLocaleString()}</div>
            </div>
            {oldPrice && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground line-through">₦{oldPrice.toLocaleString()}</span>
                <span className="text-[10px] text-success font-bold bg-success/10 px-1.5 py-0.5 rounded-md">SAVE 15%</span>
              </div>
            )}
          </div>

          {isPromoter && promoterCode && (
            <Button
              className="w-full font-bold h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2 premium-shadow"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const link = `${window.location.origin}/product/${id}?ref=${promoterCode}`;
                navigator.clipboard.writeText(link);
                toast.success("Referral link copied!");
              }}
            >
              <Share2 size={18} /> Promote & Earn
            </Button>
          )}
        </CardContent>
      </Card>
    </m.div>
  );
}
