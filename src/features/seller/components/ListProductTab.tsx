import { useState, useReducer, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { toast } from "sonner";
import { Upload, X, Plus, PackagePlus } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import imageCompression from "browser-image-compression";

type FormState = {
  title: string;
  description: string;
  price: string;
  category: string;
  inventory: string;
  city_id: string;
  zone_id: string;
  sizes: string[];
};

type FormAction = { type: "SET_FIELD"; field: keyof FormState; value: string | string[] } | { type: "RESET" };

const initialState: FormState = {
  title: "",
  description: "",
  price: "",
  category: "",
  inventory: "1",
  city_id: "",
  zone_id: "",
  sizes: [],
};

const formReducer = (state: FormState, action: FormAction): FormState => {
  if (action.type === "RESET") return initialState;
  return { ...state, [action.field]: action.value };
};

import { getAvailableSizes } from "@/features/marketplace/utils/product-sizes";

export function ListProductTab() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const queryClient = useQueryClient();

  const [form, dispatch] = useReducer(formReducer, initialState);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<{ id: string; url: string }[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: dbCategories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("categories").select("name").order("name");
      return (data as any[])?.map((c: any) => c.name) ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any).from("profiles").select("city_id, zone_id").eq("user_id", user.id).maybeSingle();
      if (error) return null;
      return data as any;
    },
    enabled: !!user,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("cities").select("id, name").eq("is_active", true).order("name");
      return (data as any[]) || [];
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", form.city_id],
    queryFn: async () => {
      if (!form.city_id) return [];
      const { data } = await (supabase as any).from("delivery_zones").select("id, name, city_id").eq("city_id", form.city_id).eq("is_active", true).order("name");
      return (data as any[]) || [];
    },
    enabled: !!form.city_id,
  });

  useEffect(() => {
    if (profile?.city_id && !form.city_id) dispatch({ type: "SET_FIELD", field: "city_id", value: profile.city_id });
    if (profile?.zone_id && !form.zone_id) dispatch({ type: "SET_FIELD", field: "zone_id", value: profile.zone_id });
  }, [profile, form.city_id, form.zone_id]);

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      const { error } = await (supabase as any).from("categories").insert({ name, slug });
      if (error) throw error;
      return name;
    },
    onSuccess: (name) => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      dispatch({ type: "SET_FIELD", field: "category", value: name });
      toast.success(`Category "${name}" added!`);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const imageUrls: string[] = [];

      if (imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file) => {
          const ext = file.name.split(".").pop();
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          
          let fileToUpload = file;
          try {
            fileToUpload = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true });
          } catch (e) {
            console.error("Compression error:", e);
          }

          const { error: uploadError } = await supabase.storage.from("product-images").upload(path, fileToUpload);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
          return urlData.publicUrl;
        });
        imageUrls.push(...(await Promise.all(uploadPromises)));
      }

      const { error } = await supabase.from("products").insert({
        seller_id: user.id,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price) * 1.1,
        category: form.category,
        inventory: parseInt(form.inventory),
        images: imageUrls,
        latitude: position?.latitude,
        longitude: position?.longitude,
        city_id: form.city_id,
        zone_id: form.zone_id,
        sizes: form.sizes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product posted successfully!");
      queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      dispatch({ type: "RESET" });
      setImageFiles([]);
      setImagePreviews([]);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newFiles = [...imageFiles, ...files].slice(0, 5);
      setImageFiles(newFiles);
      setImagePreviews(newFiles.map((file) => ({ id: `${file.name}-${Date.now()}-${Math.random()}`, url: URL.createObjectURL(file) })));
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((f) => f.filter((_, i) => i !== index));
    setImagePreviews((p) => p.filter((_, i) => i !== index));
  };

  const toggleSize = (size: string) => {
    const newSizes = form.sizes.includes(size)
      ? form.sizes.filter((s) => s !== size)
      : [...form.sizes, size];
    dispatch({ type: "SET_FIELD", field: "sizes", value: newSizes });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">New Listing</p>
        <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">List a Product</h1>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Images */}
        <div className="space-y-2">
          <Label className="text-xs font-black uppercase tracking-widest">Photos (Up to 5)</Label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {imagePreviews.map((preview, index) => (
              <div key={preview.id} className="relative aspect-square border-2 border-border rounded-xl overflow-hidden group">
                <img loading="lazy" src={preview.url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {imagePreviews.length < 5 && (
              <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload size={20} className="text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground mt-1">Add</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImage} />
              </label>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label className="text-xs font-black uppercase tracking-widest">Title</Label>
          <Input value={form.title} onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })} placeholder="Product title" className="rounded-xl h-12" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-xs font-black uppercase tracking-widest">Description</Label>
          <Textarea value={form.description} onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })} placeholder="Describe your product" className="rounded-xl min-h-[100px]" />
        </div>

        {getAvailableSizes(form.category) && (
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest">Available Sizes</Label>
            <div className="flex flex-wrap gap-2">
              {getAvailableSizes(form.category)?.map((size) => (
                <Badge
                  key={size}
                  variant={form.sizes.includes(size) ? "default" : "outline"}
                  className={`cursor-pointer h-10 px-4 rounded-lg text-xs font-bold transition-all ${
                    form.sizes.includes(size) ? "scale-105 shadow-md" : "hover:bg-muted opacity-60"
                  }`}
                  onClick={() => toggleSize(size)}
                >
                  {size}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Price & Inventory */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest">Your Earnings (₦)</Label>
            <Input type="number" value={form.price} onChange={(e) => dispatch({ type: "SET_FIELD", field: "price", value: e.target.value })} placeholder="0" className="rounded-xl h-12" />
            {form.price && !isNaN(parseFloat(form.price)) && (
              <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-xl">
                <div className="flex justify-between"><span>You receive:</span><span>₦{parseFloat(form.price).toLocaleString()}</span></div>
                <div className="flex justify-between text-muted-foreground/80"><span>Service fee (10%):</span><span>₦{(parseFloat(form.price) * 0.1).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-primary border-t pt-1 mt-1"><span>Total price for buyer:</span><span>₦{(parseFloat(form.price) * 1.1).toLocaleString()}</span></div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest">Quantity available</Label>
            <Input type="number" min="1" value={form.inventory} onChange={(e) => dispatch({ type: "SET_FIELD", field: "inventory", value: Math.max(1, parseInt(e.target.value) || 1).toString() })} className="rounded-xl h-12" />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase tracking-widest">Category</Label>
            <Button variant="link" size="sm" className="h-auto p-0 text-primary text-xs" onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}>
              {showNewCategoryInput ? "Cancel" : "+ Add New"}
            </Button>
          </div>
          {showNewCategoryInput ? (
            <div className="flex gap-2">
              <Input placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newCategoryName.trim() && addCategoryMutation.mutate(newCategoryName.trim())} className="rounded-xl h-12" />
              <Button onClick={() => newCategoryName.trim() && addCategoryMutation.mutate(newCategoryName.trim())} disabled={addCategoryMutation.isPending} className="rounded-xl h-12">Add</Button>
            </div>
          ) : (
            <Select value={form.category} onValueChange={(v) => dispatch({ type: "SET_FIELD", field: "category", value: v })}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {dbCategories.map((c: any) => (
                  <SelectItem key={typeof c === "object" ? c.name : c} value={typeof c === "object" ? c.name : c}>
                    {typeof c === "object" ? c.name : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* City & Zone */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest">City</Label>
            <Select value={form.city_id} onValueChange={(v) => {
              dispatch({ type: "SET_FIELD", field: "city_id", value: v });
              dispatch({ type: "SET_FIELD", field: "zone_id", value: "" });
            }}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>{cities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest">Zone</Label>
            <Select value={form.zone_id} onValueChange={(v) => dispatch({ type: "SET_FIELD", field: "zone_id", value: v })}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>{zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <Button
          className="w-full rounded-xl h-14 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-transform gap-3"
          onClick={() => createProduct.mutate()}
          disabled={!form.title || !form.price || !form.category || createProduct.isPending || imageFiles.length === 0}
        >
          <PackagePlus size={18} strokeWidth={3} />
          {createProduct.isPending ? "Posting..." : "Post Product"}
        </Button>
      </div>
    </div>
  );
}
