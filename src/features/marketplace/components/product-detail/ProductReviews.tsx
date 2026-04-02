import { m, AnimatePresence } from "framer-motion";
import { Star, Send } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import RatingSelector from "@/features/marketplace/components/RatingSelector";

interface ProductReviewsProps {
  productReviews: any[];
  user: any;
  rating: number;
  setRating: (r: number) => void;
  commentText: string;
  setCommentText: (t: string) => void;
  toggleAuth: () => void;
  reviewMutation: any;
  animationProps: any;
}

export function ProductReviews({
  productReviews,
  user,
  rating,
  setRating,
  commentText,
  setCommentText,
  toggleAuth,
  reviewMutation,
  animationProps
}: ProductReviewsProps) {
  return (
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
  );
}
