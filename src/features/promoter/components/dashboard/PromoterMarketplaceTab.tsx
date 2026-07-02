import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Package } from "lucide-react";
import { PromoteAction } from "@/features/promoter/components/PromoteAction";

interface PromoterMarketplaceTabProps {
  products: any[];
  productsLoading: boolean;
  promoterCode: string | null | undefined;
}

export function PromoterMarketplaceTab({ products, productsLoading, promoterCode }: PromoterMarketplaceTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Marketplace</h2>
        <div className="text-sm text-muted-foreground">
          Showing {products.length} popular products
        </div>
      </div>

      {productsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="text-center py-12">
          <Package className="mx-auto mb-4 opacity-20" size={48} />
          <p className="text-muted-foreground">The marketplace is empty right now. Check back later!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p: any) => (
            <Card key={p.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-all group border-muted/50">
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img
                  src={p.images?.[0] || "/placeholder.svg"}
                  alt={p.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <Badge className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border-none">
                  5% Comm.
                </Badge>
              </div>
              <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold line-clamp-1 h-5">{p.title}</h3>
                  <p className="text-primary font-bold text-lg mt-1">₦{p.price.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                </div>
                <div className="pt-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {p.inventory} in stock
                  </Badge>
                  <PromoteAction
                    productId={p.id}
                    productTitle={p.title}
                    promoterCode={promoterCode || ""}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
