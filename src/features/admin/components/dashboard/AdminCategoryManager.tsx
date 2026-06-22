import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { toast } from "sonner";
import * as lucideIcons from "lucide-react";
import { X, Grid } from "lucide-react";
import { useCategories } from "@/shared/hooks/use-marketplace-metadata";

export default function AdminCategoryManager() {
    const queryClient = useQueryClient();
    const [newCategoryName, setNewCategoryName] = useState("");
    const { data: dbCategories = [] } = useCategories();

    const addCategoryMutation = useMutation({
        mutationFn: async (name: string) => {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const { error } = await supabase.from("categories").insert({ name, slug });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-categories", "full"] });
            toast.success("Category added");
            setNewCategoryName("");
        },
        onError: (err: any) => toast.error(err.message),
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("categories").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-categories", "full"] });
            toast.success("Category deleted");
        },
        onError: (err: any) => toast.error(err.message),
    });

    const renderIcon = (iconName: string) => {
        const Icon = (lucideIcons as any)[iconName] || Grid;
        return <Icon size={16} strokeWidth={3} />;
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">
                    System Configuration
                </p>
                <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
                    Manage Categories
                </h1>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
                <Card className="lg:col-span-1 border-none rounded-[3rem] bg-white p-10 shadow-2xl shadow-black/[0.02] h-fit">
                    <CardHeader className="p-0 mb-8">
                        <CardTitle className="text-xl font-black tracking-tight">Add Category</CardTitle>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Expanding Marketplace Reach</p>
                    </CardHeader>
                    <CardContent className="p-0 space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name of Category</Label>
                            <Input
                                placeholder="e.g. Premium Electronics"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="rounded-xl h-14 border-black/5 bg-muted/20 focus-visible:ring-primary font-bold px-6"
                            />
                        </div>
                        <Button
                            className="w-full rounded-xl h-14 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                            onClick={() => newCategoryName.trim() && addCategoryMutation.mutate(newCategoryName.trim())}
                            disabled={addCategoryMutation.isPending}
                        >
                            Add Category
                        </Button>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
                    {dbCategories.map((c) => (
                        <div key={c.id} className="group flex items-center justify-between p-6 bg-white border border-black/[0.03] rounded-xl hover:shadow-xl hover:shadow-black/[0.02] transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                                    {renderIcon(c.icon)}
                                </div>
                                <span className="font-black text-sm uppercase tracking-tight">{c.name}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl w-10 h-10 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                onClick={() => {
                                    if(confirm("Are you sure you want to delete this category?")) {
                                        deleteCategoryMutation.mutate(c.id);
                                    }
                                }}
                                disabled={deleteCategoryMutation.isPending}
                            >
                                <X size={18} strokeWidth={3} />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
