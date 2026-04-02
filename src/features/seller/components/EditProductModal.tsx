import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";

interface EditProductModalProps {
    product: any;
    setProduct: (product: any) => void;
    onClose: () => void;
    onSave: (product: any) => void;
}

import { getAvailableSizes } from "@/features/marketplace/utils/product-sizes";

export function EditProductModal({ product, setProduct, onClose, onSave }: EditProductModalProps) {
    const toggleSize = (size: string) => {
        const currentSizes = product.sizes || [];
        const newSizes = currentSizes.includes(size)
            ? currentSizes.filter((s: string) => s !== size)
            : [...currentSizes, size];
        setProduct({ ...product, sizes: newSizes });
    };

    return (
        <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="rounded-[3rem] border-none shadow-2xl p-10 max-w-xl">
                <DialogHeader className="mb-8">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Asset Configuration</p>
                    <DialogTitle className="text-3xl font-black tracking-tight">Edit Repository Item</DialogTitle>
                </DialogHeader>
                {product && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title Assignment</Label>
                            <Input className="rounded-xl h-14 border-black/5 bg-muted/20 font-bold px-6" value={product.title} onChange={(e) => setProduct({ ...product, title: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Market Price (₦)</Label>
                                <Input type="number" className="rounded-xl h-14 border-black/5 bg-muted/20 font-bold px-6" value={product.price} onChange={(e) => setProduct({ ...product, price: parseFloat(e.target.value) })} />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registry Stock</Label>
                                <Input type="number" className="rounded-xl h-14 border-black/5 bg-muted/20 font-bold px-6" value={product.inventory} onChange={(e) => setProduct({ ...product, inventory: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        {getAvailableSizes(product.category) && (
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Available Sizes</Label>
                                <div className="flex flex-wrap gap-2">
                                    {getAvailableSizes(product.category)?.map((size) => (
                                        <Badge
                                            key={size}
                                            variant={(product.sizes || []).includes(size) ? "default" : "outline"}
                                            className={`cursor-pointer h-10 px-4 rounded-xl text-xs font-bold transition-all ${
                                                (product.sizes || []).includes(size) ? "scale-105 shadow-md" : "hover:bg-muted opacity-60"
                                            }`}
                                            onClick={() => toggleSize(size)}
                                        >
                                            {size}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Specification Log</Label>
                            <Textarea className="rounded-xl min-h-[120px] border-black/5 bg-muted/20 font-medium px-6 py-4" value={product.description || ""} onChange={(e) => setProduct({ ...product, description: e.target.value })} />
                        </div>
                    </div>
                )}
                <DialogFooter className="mt-10 gap-2">
                    <Button variant="ghost" className="rounded-full h-14 px-8 font-black text-xs uppercase tracking-widest" onClick={onClose}>Discard</Button>
                    <Button className="rounded-full h-14 px-10 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 grow" onClick={() => onSave(product)}>Commit Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
