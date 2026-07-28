import { m } from "framer-motion";
import { Badge } from "@/shared/components/ui/badge";
import { MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProductHeaderProps {
  product: any;
  dist: string | null;
  deliveryTime: string | null;
  productReviews: any[];
  animationProps: any;
}

export function ProductHeader({
  product,
  dist,
  deliveryTime,
  productReviews,
  animationProps
}: ProductHeaderProps) {
  const derivedReviewsCount = productReviews.length;
  const derivedAvgRating = derivedReviewsCount > 0
    ? productReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / derivedReviewsCount
    : 0;
  const displayRating = (product.avg_rating || 0) > 0 ? product.avg_rating : derivedAvgRating;
  const displayCount = (product.reviews_count || 0) > 0 ? product.reviews_count : derivedReviewsCount;

  const { data: feeConfigs = [] } = useQuery({
    queryKey: ["fee-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_config").select("*").eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });
  const productFeeConfig = feeConfigs.find((f: any) => f.fee_type === "platform_product");
  const platformProductRate = productFeeConfig?.rate ?? 0.10;
  const markupMultiplier = 1 + platformProductRate;
  const finalPrice = product.price * markupMultiplier;

  return (
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

      <div className="hidden lg:block">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Price (+{platformProductRate * 100}% Fee)</span>
        <p className="text-4xl font-black text-primary leading-tight">₦{finalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        <p className="text-sm text-muted-foreground mt-1">Base: ₦{product.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        {product.category && (
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 block mt-2">{product.category}</span>
        )}
      </div>
    </m.div>
  );
}
