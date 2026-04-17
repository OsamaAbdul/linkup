import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { 
    Truck, 
    MapPin, 
    Globe, 
    Plus, 
    Trash2, 
    Search, 
    Settings2,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

export default function AdminLogisticsManager() {
    const queryClient = useQueryClient();
    const [newVehicle, setNewVehicle] = useState("");
    const [newCity, setNewCity] = useState("");
    const [newZone, setNewZone] = useState({ name: "", city_id: "" });

    // Fetch Data
    const { data: vehicleTypes = [], isLoading: loadingVehicles } = useQuery({
        queryKey: ["admin-vehicle-types"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).from("vehicle_types").select("*").order("name");
            if (error) throw error;
            return data || [];
        }
    });

    const { data: cities = [], isLoading: loadingCities } = useQuery({
        queryKey: ["admin-cities"],
        queryFn: async () => {
            const { data, error } = await supabase.from("cities").select("*").order("name");
            if (error) throw error;
            return data || [];
        }
    });

    const { data: zones = [], isLoading: loadingZones } = useQuery({
        queryKey: ["admin-delivery-zones"],
        queryFn: async () => {
            const { data, error } = await supabase.from("delivery_zones").select("*, cities(name)").order("name");
            if (error) throw error;
            return data || [];
        }
    });

    // Mutations
    const addVehicleMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await (supabase as any).from("vehicle_types").insert([{ name }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-vehicle-types"] });
            setNewVehicle("");
            toast.success("Vehicle type added successfully");
        },
        onError: (error: any) => toast.error(`Error: ${error.message}`)
    });

    const deleteVehicleMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any).from("vehicle_types").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-vehicle-types"] });
            toast.success("Vehicle type removed");
        }
    });

    const addCityMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase.from("cities").insert([{ name }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
            setNewCity("");
            toast.success("City added successfully");
        }
    });

    const addZoneMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from("delivery_zones").insert([{ 
                name: newZone.name, 
                city_id: newZone.city_id,
                is_active: true 
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
            setNewZone({ name: "", city_id: "" });
            toast.success("Delivery zone added successfully");
        }
    });

    const deleteZoneMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
            toast.success("Zone removed");
        }
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Settings2 size={20} strokeWidth={3} />
                        </div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Setup</p>
                    </div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight">Delivery & Shipping</h1>
                    <p className="text-muted-foreground font-medium mt-1">Manage delivery regions and transport types.</p>
                </div>
            </div>

            <Tabs defaultValue="vehicles" className="w-full">
                <TabsList className="bg-white border p-1 rounded-2xl mb-8 flex-wrap h-auto gap-1">
                    <TabsTrigger value="vehicles" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                        <Truck className="mr-2 h-4 w-4" /> Vehicles
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                        <MapPin className="mr-2 h-4 w-4" /> Zones
                    </TabsTrigger>
                    <TabsTrigger value="cities" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                        <Globe className="mr-2 h-4 w-4" /> Cities
                    </TabsTrigger>
                </TabsList>

                {/* Vehicles Tab */}
                <TabsContent value="vehicles">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-1 rounded-2xl border-none shadow-xl shadow-black/[0.02] bg-white h-fit">
                            <CardHeader>
                                <CardTitle className="text-xl font-black uppercase tracking-tight italic">Add Transport</CardTitle>
                                <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Vehicle Information</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Vehicle Name</label>
                                    <Input 
                                        placeholder="e.g. Electric Scooter" 
                                        value={newVehicle}
                                        onChange={(e) => setNewVehicle(e.target.value)}
                                        className="h-12 rounded-xl bg-muted/30 border-none font-bold"
                                    />
                                </div>
                                <Button 
                                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs"
                                    onClick={() => addVehicleMutation.mutate(newVehicle)}
                                    disabled={!newVehicle || addVehicleMutation.isPending}
                                >
                                    {addVehicleMutation.isPending ? <Loader2 className="animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Register Vehicle</>}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 rounded-2xl border-none shadow-xl shadow-black/[0.02] bg-white overflow-hidden">
                            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                                <CardTitle className="text-xl font-black uppercase tracking-tight italic">Registered Vehicles</CardTitle>
                                <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-none px-4 py-1 font-black text-[10px] uppercase">{vehicleTypes.length} Units</Badge>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {loadingVehicles ? (
                                    <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                                ) : vehicleTypes.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground font-bold italic">No transport types added yet.</div>
                                ) : (
                                    vehicleTypes.map((v: any) => (
                                        <div key={v.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                    <Truck size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-foreground">{v.name}</p>
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Type #ID_{v.id.slice(0, 4)}</p>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => deleteVehicleMutation.mutate(v.id)}
                                            >
                                                <Trash2 size={18} />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                {/* Zones Tab */}
                <TabsContent value="zones">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-1 rounded-2xl border-none shadow-xl shadow-black/[0.02] bg-white h-fit">
                            <CardHeader>
                                <CardTitle className="text-xl font-black uppercase tracking-tight italic">New Zone</CardTitle>
                                <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Delivery Area</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Zone Name</label>
                                    <Input 
                                        placeholder="e.g. Asokoro Central" 
                                        value={newZone.name}
                                        onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                                        className="h-12 rounded-xl bg-muted/30 border-none font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Parent City</label>
                                    <select 
                                        className="w-full h-12 rounded-xl bg-muted/30 border-none px-4 font-bold text-sm outline-none"
                                        value={newZone.city_id}
                                        onChange={(e) => setNewZone({ ...newZone, city_id: e.target.value })}
                                    >
                                        <option value="">Select City</option>
                                        {cities.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button 
                                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs"
                                    onClick={() => addZoneMutation.mutate()}
                                    disabled={!newZone.name || !newZone.city_id || addZoneMutation.isPending}
                                >
                                    {addZoneMutation.isPending ? <Loader2 className="animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Create Zone</>}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 rounded-2xl border-none shadow-xl shadow-black/[0.02] bg-white overflow-hidden">
                            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                                <CardTitle className="text-xl font-black uppercase tracking-tight italic">Delivery Zones</CardTitle>
                                <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-none px-4 py-1 font-black text-[10px] uppercase">{zones.length} Total</Badge>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {loadingZones ? (
                                    <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                                ) : (
                                    zones.map((z: any) => (
                                        <div key={z.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                    <MapPin size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-foreground">{z.name}</p>
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{z.cities?.name || 'Local'} Group</p>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => deleteZoneMutation.mutate(z.id)}
                                            >
                                                <Trash2 size={18} />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                {/* Cities Tab */}
                 <TabsContent value="cities">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-1 rounded-2xl border-none shadow-xl shadow-black/[0.02] bg-white h-fit">
                            <CardHeader>
                                <CardTitle className="text-xl font-black uppercase tracking-tight italic">New Region</CardTitle>
                                <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Active Areas</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">City Name</label>
                                    <Input 
                                        placeholder="e.g. Lagos" 
                                        value={newCity}
                                        onChange={(e) => setNewCity(e.target.value)}
                                        className="h-12 rounded-xl bg-muted/30 border-none font-bold"
                                    />
                                </div>
                                <Button 
                                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs"
                                    onClick={() => addCityMutation.mutate(newCity)}
                                    disabled={!newCity || addCityMutation.isPending}
                                >
                                    {addCityMutation.isPending ? <Loader2 className="animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Add Region</>}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 rounded-2xl border-none shadow-xl shadow-black/[0.02] bg-white overflow-hidden">
                            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                                <CardTitle className="text-xl font-black uppercase tracking-tight italic">Active Cities</CardTitle>
                                <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-none px-4 py-1 font-black text-[10px] uppercase">{cities.length} Units</Badge>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {loadingCities ? (
                                    <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                                ) : (
                                    cities.map((c: any) => (
                                        <div key={c.id} className="p-4 rounded-xl border border-black/[0.03] bg-muted/10 flex items-center justify-between group hover:border-primary/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <Globe size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                                <span className="font-bold text-foreground">{c.name}</span>
                                            </div>
                                            <Badge variant="outline" className="border-none bg-green-500/10 text-green-600 font-black text-[8px] uppercase">Active</Badge>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
