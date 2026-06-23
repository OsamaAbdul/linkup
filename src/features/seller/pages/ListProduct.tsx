import { useState, useReducer, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
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

type FormAction = { type: 'SET_FIELD'; field: keyof FormState; value: string | string[] };

const formReducer = (state: FormState, action: FormAction): FormState => {
  return { ...state, [action.field]: action.value };
};

import { getAvailableSizes } from "@/features/marketplace/utils/product-sizes";

import { useCategories, useCities, useZones } from "@/shared/hooks/use-marketplace-metadata";

export default function Sell() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, dispatch] = useReducer(formReducer, {
    title: "",
    description: "",
    price: "",
    category: "",
    inventory: "1",
    city_id: "",
    zone_id: "",
    sizes: [],
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<{ id: string; url: string }[]>([]);

  const { data: roles, isLoading: isRolesLoading } = useQuery({
    queryKey: ["my-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data?.map((r) => r.role) ?? [];
    },
    enabled: !!user,
  });

  const { data: dbCategoriesResponse = [] } = useCategories();
  const dbCategories = dbCategoriesResponse.map((c: any) => c.name);

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

  const { data: cities = [] } = useCities();

  const { data: zones = [] } = useZones(form.city_id);

  // Default to profile location
  useEffect(() => {
    if (profile?.city_id && !form.city_id) {
      dispatch({ type: 'SET_FIELD', field: 'city_id', value: profile.city_id });
    }
    if (profile?.zone_id && !form.zone_id) {
      dispatch({ type: 'SET_FIELD', field: 'zone_id', value: profile.zone_id });
    }
  }, [profile, form.city_id, form.zone_id]);



  const becomeSellerMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("user_roles").insert({ user_id: user.id, role: "seller" as any });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
      navigate("/seller-verification");
      toast.success("Welcome! Please complete verification to start selling.");
    },
  });

  const isSeller = roles?.includes("seller");

  const { data: verification, isLoading: isVerificationLoading } = useQuery({
    queryKey: ["verification", user?.id],
    queryFn: async () => {
      if (!user) return null;
      // @ts-ignore
      const { data } = await supabase.from("seller_verifications").select("status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!user && !!isSeller,
  });

  if (!user) return <Navigate to="/auth" replace />;

  if (isRolesLoading || (isSeller && isVerificationLoading)) {
    return (
      <AppLayout>
        <div className="p-4 flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  if (isSeller && (verification as any)?.status !== 'verified') {
    return <Navigate to="/seller-verification" replace />;
  }

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

        const uploadedUrls = await Promise.all(uploadPromises);
        imageUrls.push(...uploadedUrls);
      }

      const { data: productData, error } = await supabase.from("products").insert({
        seller_id: user.id,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price) * 1.10,
        category: form.category,
        inventory: parseInt(form.inventory),
        images: imageUrls,
        latitude: position?.latitude,
        longitude: position?.longitude,
        city_id: form.city_id,
        zone_id: form.zone_id,
        sizes: form.sizes
      }).select().single();
      if (error) throw error;

      // --- Notify Buyers ---
      try {
        const { data: zoneProfiles } = await supabase.from("profiles").select("id").eq("zone_id", form.zone_id);
        const { data: buyerRoles } = await supabase.from("user_roles").select("user_id").eq("role", "buyer");
        
        const buyerIds = (zoneProfiles || [])
           .filter(p => p.id !== user.id && (buyerRoles || []).some(r => r.user_id === p.id))
           .map(p => p.id);

        if (buyerIds.length > 0) {
          const notifications = buyerIds.map(bId => ({
             user_id: bId,
             type: "new_product",
             message: `A new product "${form.title}" was just added in your zone! Check it out.`
          }));
          await supabase.from("notifications").insert(notifications);

          Promise.all(buyerIds.map(bId => 
             supabase.functions.invoke("send-push", {
                body: {
                   target_user_id: bId,
                   title: "New Product Alert! 🛍️",
                   message: `A new product "${form.title}" was just added in your zone! Check it out.`,
                   url: `/product/${productData?.id}` // or simply home /
                }
             })
          )).catch(console.error); // Do not block UI
        }
      } catch (notifyErr) {
        console.error("Failed to notify buyers:", notifyErr);
      }
      // ----------------------
    },
    onSuccess: () => {
      toast.success("Product listed!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newFiles = [...imageFiles, ...files].slice(0, 5);
      setImageFiles(newFiles);

      const newPreviews = newFiles.map(file => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        url: URL.createObjectURL(file)
      }));
      setImagePreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  const toggleSize = (size: string) => {
    const newSizes = form.sizes.includes(size)
      ? form.sizes.filter((s) => s !== size)
      : [...form.sizes, size];
    dispatch({ type: 'SET_FIELD', field: 'sizes', value: newSizes });
  };

  if (roles && !isSeller) {
    return (
      <AppLayout>
        <div className="p-4 text-center py-12 space-y-4">
          <h1 className="text-xl font-bold">Start Selling</h1>
          <p className="text-muted-foreground">Become a seller to list your products on Linkup.</p>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => becomeSellerMutation.mutate()}>
            Become a Seller
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4">
        <Card>
          <CardHeader><CardTitle>List a Product</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Photos (Up to 5)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={preview.id} className="relative aspect-square border-2 border-border rounded-lg overflow-hidden group">
                    <img loading="lazy" src={preview.url} alt={`Product preview ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {imagePreviews.length < 5 && (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload size={24} />
                      <span className="text-xs">Add Photo</span>
                    </div>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImage} />
                  </label>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'title', value: e.target.value })} placeholder="Product title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'description', value: e.target.value })} placeholder="Describe your product" />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => dispatch({ type: 'SET_FIELD', field: 'category', value: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {dbCategories.map((c: any) => (
                    <SelectItem key={typeof c === 'object' ? c.name : c} value={typeof c === 'object' ? c.name : c}>
                      {typeof c === 'object' ? c.name : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {getAvailableSizes(form.category) && (
              <div className="space-y-2">
                <Label>Available Sizes</Label>
                <div className="flex flex-wrap gap-2">
                  {getAvailableSizes(form.category)?.map((size) => (
                    <Badge
                      key={size}
                      variant={form.sizes.includes(size) ? "default" : "outline"}
                      className={`cursor-pointer h-9 px-4 rounded-md text-xs font-bold transition-all ${
                        form.sizes.includes(size) ? "scale-105 shadow-sm" : "hover:bg-muted opacity-70"
                      }`}
                      onClick={() => toggleSize(size)}
                    >
                      {size}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Your Earnings (₦)</Label>
                <Input type="number" value={form.price} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'price', value: e.target.value })} placeholder="0" />
                {form.price && !isNaN(parseFloat(form.price)) && (
                  <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded-md">
                    <div className="flex justify-between">
                      <span>Your Earnings:</span>
                      <span>₦{parseFloat(form.price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground/80">
                      <span>System Fee (10%):</span>
                      <span>₦{(parseFloat(form.price) * 0.10).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-primary border-t pt-1 mt-1">
                      <span>Buyer Pays:</span>
                      <span>₦{(parseFloat(form.price) * 1.10).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Inventory (Min. 1)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.inventory}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'inventory', value: Math.max(1, parseInt(e.target.value) || 1).toString() })}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Select value={form.city_id} onValueChange={(v) => dispatch({ type: 'SET_FIELD', field: 'city_id', value: v })}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {cities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <Select value={form.zone_id} onValueChange={(v) => dispatch({ type: 'SET_FIELD', field: 'zone_id', value: v })}>
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => createProduct.mutate()}
              disabled={!form.title || !form.price || !form.category || createProduct.isPending || imageFiles.length === 0}>
              {createProduct.isPending ? "Listing..." : "List Product"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout >
  );
}
