import { m } from "framer-motion";

interface SellerCardProps {
  seller: any;
  animationProps: any;
}

export function SellerCard({ seller, animationProps }: SellerCardProps) {
  return (
    <m.div {...animationProps} transition={{ delay: 0.3 }}>
      <div className="p-3 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          {seller?.avatar_url ? (
            <img
              src={seller.avatar_url}
              alt={seller.display_name ?? "Seller"}
              className="h-12 w-12 rounded-xl object-cover shadow-sm border border-border/30"
            />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-foreground/20 flex items-center justify-center text-white font-black text-lg shadow-inner">
              {seller?.display_name?.[0]?.toUpperCase() ?? "S"}
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Offered by</p>
            <p className="text-base font-black">{seller?.display_name ?? "Seller"}</p>
            {seller?.bio && (
              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{seller.bio}</p>
            )}
          </div>
        </div>
      </div>
    </m.div>
  );
}
