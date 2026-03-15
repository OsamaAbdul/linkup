import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, ShieldCheck, Activity, Smartphone, Edit, X, ArrowLeft, ChevronRight } from "lucide-react";
import { MetricCard } from "./MetricCards";
import { cn } from "@/lib/utils";

interface InventoryTabProps {
    products: any[];
    totalProducts: number;
    productsPage: number;
    setProductsPage: (page: number | ((p: number) => number)) => void;
    setEditingProduct: (product: any) => void;
    deleteProductMutation: any;
    pageSize: number;
    onListProduct?: () => void;
}

export function InventoryTab({
    products,
    totalProducts,
    productsPage,
    setProductsPage,
    setEditingProduct,
    deleteProductMutation,
    pageSize,
    onListProduct
}: InventoryTabProps) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Inventory Control</p>
                    <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Active Products</h1>
                </div>
                <Button
                    className="rounded-full h-14 px-8 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-transform gap-3"
                    onClick={onListProduct}
                >
                    <Plus size={18} strokeWidth={3} />
                    New Asset
                </Button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard title="Total Inventory" value={totalProducts} icon={Package} trend="+2 new" />
                <MetricCard title="Active Listings" value={products.length} icon={ShieldCheck} status="verified" />
                <MetricCard title="Stock Health" value="98%" icon={Activity} color="text-green-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((p) => (
                    <Card key={p.id} className="rounded-[2rem] border-black/[0.03] bg-white shadow-xl shadow-black/[0.02] hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden group">
                        <div className="h-56 bg-muted relative group">
                            {p.images?.[0] ?
                                <img src={p.images[0]} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                : <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30 gap-2">
                                    <Smartphone size={32} strokeWidth={1} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">No visual asset</span>
                                </div>
                            }
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Badge className={cn(
                                "absolute top-4 right-4 rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest border-none shadow-lg",
                                p.inventory < 5 ? "bg-amber-100 text-amber-900" : "bg-white/90 text-black backdrop-blur-sm"
                            )}>
                                {p.inventory} UNIT{p.inventory !== 1 ? 'S' : ''}
                            </Badge>
                        </div>
                        <CardContent className="p-6">
                            <h3 className="text-xl font-black text-foreground tracking-tight truncate group-hover:text-primary transition-colors" title={p.title}>{p.title}</h3>
                            <p className="text-2xl font-black text-primary mt-2 flex items-center gap-1 tracking-tighter">
                                <span className="text-sm opacity-60">₦</span>
                                {p.price.toLocaleString()}
                            </p>
                        </CardContent>
                        <CardFooter className="p-6 pt-0 flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 rounded-2xl h-12 bg-muted hover:bg-primary/5 hover:text-primary text-[10px] font-black uppercase tracking-widest transition-all"
                                onClick={() => setEditingProduct(p)}
                            >
                                <Edit size={14} className="mr-2" strokeWidth={3} /> Configuration
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-2xl h-12 hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-all"
                                onClick={() => {
                                    if (confirm("Execute decommissioning of this asset? This action is irreversible.")) {
                                        deleteProductMutation.mutate(p.id);
                                    }
                                }}
                            >
                                <X size={16} strokeWidth={3} />
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {totalProducts > pageSize && (
                <div className="flex items-center justify-center gap-4 pt-10">
                    <Button
                        variant="outline"
                        className="rounded-full w-12 h-12 p-0 border-black/5 shadow-sm"
                        onClick={() => setProductsPage(p => Math.max(0, p - 1))}
                        disabled={productsPage === 0}
                    >
                        <ArrowLeft size={18} />
                    </Button>
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground bg-white px-6 py-2 rounded-full border border-black/5 shadow-sm">PAGE {productsPage + 1}</span>
                    <Button
                        variant="outline"
                        className="rounded-full w-12 h-12 p-0 border-black/5 shadow-sm"
                        onClick={() => setProductsPage(p => p + 1)}
                        disabled={(productsPage + 1) * pageSize >= totalProducts}
                    >
                        <ChevronRight size={18} />
                    </Button>
                </div>
            )}
        </div>
    );
}
