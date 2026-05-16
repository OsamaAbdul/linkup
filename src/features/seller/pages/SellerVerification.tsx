import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { toast } from "sonner";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCities, useZones } from "@/shared/hooks/use-marketplace-metadata";

export default function SellerVerification() {
    const { user, roles, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [nationalIdFile, setNationalIdFile] = useState<File | null>(null);
    const [storePhotoFile, setStorePhotoFile] = useState<File | null>(null);

    const isSeller = roles.includes("seller");

    useEffect(() => {
        if (!authLoading && !isSeller) {
            toast.error("Please register as a seller first.");
            navigate("/dashboard", { replace: true });
        }
    }, [isSeller, authLoading, navigate]);

    // Check existing verification status
    const { data: verification, isLoading } = useQuery({
        queryKey: ["seller-verification", user?.id],
        queryFn: async () => {
            if (!user) return null;
            // @ts-ignore
            const { data, error } = await supabase.from("seller_verifications").select("*").eq("user_id", user.id).maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!user && isSeller,
    });

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
        defaultValues: {
            business_name: "",
            phone_number: "",
            business_address: "",
            city_id: "",
            zone_id: "",
            bank_name: "",
            account_number: "",
            account_name: "",
        }
    });

    const selectedCityId = watch("city_id");
    const { data: cities = [] } = useCities();
    const { data: zones = [] } = useZones(selectedCityId);

    const queryClient = useQueryClient();

    const submitMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!nationalIdFile || !storePhotoFile) throw new Error("Please upload all required documents");

            // Upload ID
            const idExt = nationalIdFile.name.split(".").pop();
            const idPath = `${user!.id}/id_${Date.now()}.${idExt}`;
            const { error: idError } = await supabase.storage.from("kyc-documents").upload(idPath, nationalIdFile);
            if (idError) throw idError;

            // Upload Store Photo
            const storeExt = storePhotoFile.name.split(".").pop();
            const storePath = `${user!.id}/store_${Date.now()}.${storeExt}`;
            const { error: storeError } = await supabase.storage.from("kyc-documents").upload(storePath, storePhotoFile);
            if (storeError) throw storeError;

            // Insert Verification Record
            // @ts-ignore
            const { error: insertError } = await supabase.from("seller_verifications").insert({
                user_id: user!.id,
                business_name: data.business_name,
                phone_number: data.phone_number,
                business_address: data.business_address,
                city_id: data.city_id,
                zone_id: data.zone_id,
                national_id_url: idPath,
                store_photo_url: storePath,
                bank_details: {
                    bank_name: data.bank_name,
                    account_number: data.account_number,
                    account_name: data.account_name,
                }
            });

            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Verification submitted successfully!");
            queryClient.invalidateQueries({ queryKey: ["seller-verification", user?.id] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    if (isLoading || authLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    if (!isSeller) return null; // Component will redirect via useEffect

    // @ts-ignore
    if (verification?.status === 'verified') {
        return (
            <AppLayout>
                <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
                    <CheckCircle className="w-16 h-16 text-primary mx-auto" />
                    <h2 className="text-2xl font-bold">You are Verified!</h2>
                    <p className="text-muted-foreground">Your seller account is active and verified. You can now list products.</p>
                    <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
                </div>
            </AppLayout>
        );
    }

    // @ts-ignore
    if (verification?.status === 'pending') {
        return (
            <AppLayout>
                <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
                    <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
                    <h2 className="text-2xl font-bold">Verification Pending</h2>
                    <p className="text-muted-foreground">We are reviewing your details. This usually takes 24-48 hours.</p>
                    <Button variant="outline" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
                </div>
            </AppLayout>
        );
    }

    // @ts-ignore
    if (verification?.status === 'rejected') {
        return (
            <AppLayout>
                <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
                    <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
                    <h2 className="text-2xl font-bold">Verification Rejected</h2>
                    <p className="text-muted-foreground">Your verification was not approved. Please contact support for more information.</p>
                    <Button variant="outline" onClick={() => navigate("/support")}>Contact Support</Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="p-4 md:p-8 max-w-3xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Seller Verification (KYC)</CardTitle>
                        <CardDescription>To ensure safety, we verify all our sellers. Please provide the details below.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit((data) => submitMutation.mutate(data))} className="space-y-6">

                            {/* Business Details */}
                            <div className="space-y-4">
                                <h3 className="font-semibold border-b pb-2">Business Details</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Business Name</Label>
                                        <Input {...register("business_name", { required: true })} placeholder="My Awesome Store" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone Number</Label>
                                        <Input {...register("phone_number", { required: true })} placeholder="+234..." />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Business Address</Label>
                                        <Input {...register("business_address", { required: true })} placeholder="Shop 5, Area 1..." />
                                    </div>
                                    <div className="space-y-2 md:col-span-1">
                                        <Label>City</Label>
                                        <Select onValueChange={(val) => { setValue("city_id", val); setValue("zone_id", ""); }}>
                                            <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                                            <SelectContent>
                                                {cities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2 md:col-span-1">
                                        <Label>Zone</Label>
                                        <Select onValueChange={(val) => setValue("zone_id", val)} disabled={!selectedCityId}>
                                            <SelectTrigger><SelectValue placeholder="Select Zone" /></SelectTrigger>
                                            <SelectContent>
                                                {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="space-y-4">
                                <h3 className="font-semibold border-b pb-2">Bank Details</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bank Name</Label>
                                        <Input {...register("bank_name", { required: true })} placeholder="GTBank" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Account Number</Label>
                                        <Input {...register("account_number", { required: true })} placeholder="0123456789" />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Account Name</Label>
                                        <Input {...register("account_name", { required: true })} placeholder="John Doe" />
                                    </div>
                                </div>
                            </div>

                            {/* Documents */}
                            <div className="space-y-4">
                                <h3 className="font-semibold border-b pb-2">Documents</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>National ID Card</Label>
                                        <Input type="file" onChange={(e) => setNationalIdFile(e.target.files?.[0] || null)} />
                                        <p className="text-xs text-muted-foreground">Clear photo of NIN, Driver's License or Voter's Card</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Store Photo</Label>
                                        <Input type="file" onChange={(e) => setStorePhotoFile(e.target.files?.[0] || null)} />
                                        <p className="text-xs text-muted-foreground">Photo of your physical store or workspace</p>
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={submitMutation.isPending}>
                                {submitMutation.isPending ? "Submitting..." : "Submit for Verification"}
                            </Button>

                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
