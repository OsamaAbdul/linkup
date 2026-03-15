import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditProductModalProps {
    product: any;
    setProduct: (product: any) => void;
    onClose: () => void;
    onSave: (product: any) => void;
}

export function EditProductModal({ product, setProduct, onClose, onSave }: EditProductModalProps) {
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
                            <Input className="rounded-2xl h-14 border-black/5 bg-muted/20 font-bold px-6" value={product.title} onChange={(e) => setProduct({ ...product, title: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Market Price (₦)</Label>
                                <Input type="number" className="rounded-2xl h-14 border-black/5 bg-muted/20 font-bold px-6" value={product.price} onChange={(e) => setProduct({ ...product, price: parseFloat(e.target.value) })} />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registry Stock</Label>
                                <Input type="number" className="rounded-2xl h-14 border-black/5 bg-muted/20 font-bold px-6" value={product.inventory} onChange={(e) => setProduct({ ...product, inventory: parseInt(e.target.value) })} />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Specification Log</Label>
                            <Textarea className="rounded-2xl min-h-[120px] border-black/5 bg-muted/20 font-medium px-6 py-4" value={product.description || ""} onChange={(e) => setProduct({ ...product, description: e.target.value })} />
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
