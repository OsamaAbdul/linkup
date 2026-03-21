import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminUserManagement() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: ["admin-users-list", currentPage, searchQuery],
        queryFn: async () => {
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage - 1;

            const searchLower = searchQuery.toLowerCase();
            const possibleRoles = ['admin', 'seller', 'promoter', 'logistics', 'buyer'];
            const isRoleSearch = searchQuery && possibleRoles.some(r => r.includes(searchLower));

            let query = supabase
                .from("profiles")
                .select(isRoleSearch ? "*, user_roles!inner(role)" : "*, user_roles(role)", { count: 'exact' });

            if (searchQuery) {
                if (isRoleSearch) {
                    query = query.or(`display_name.ilike.%${searchQuery}%,user_roles.role.ilike.%${searchQuery}%`);
                } else {
                    query = query.ilike("display_name", `%${searchQuery}%`);
                }
            }

            const { data, count, error } = await query
                .order("created_at", { ascending: false })
                .range(start, end);

            if (error) throw error;
            return { users: data, totalCount: count || 0 };
        },
        staleTime: 1000 * 60 * 5,
    });

    const users = usersData?.users;
    const totalCount = usersData?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const { data: allOrders } = useQuery({
        queryKey: ["admin-all-orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*");
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 2,
    });

    const getUserStats = (userId: string) => {
        const userOrders = allOrders?.filter(o => o.buyer_id === userId) || [];
        const totalSpent = userOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
        return { count: userOrders.length, totalSpent };
    };

    const deleteUserMutation = useMutation({
        // ... (lines 31-41 remain same - omitted for simplicity but will be included in full replacement block if needed, but I'll use multi-chunk if it's too complex or just replace the whole functional scope)
        mutationFn: async (userId: string) => {
            const { error } = await (supabase as any).rpc("delete_user_admin", { target_user_id: userId });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("User successfully deleted from system registry");
            queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
        },
        onError: (err: any) => {
            toast.error("Deletion protocol failed: " + err.message);
        }
    });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset to first page on search
    };

    if (usersLoading) return <div className="p-12 text-center text-muted-foreground font-bold bg-white rounded-xl">User Management Suite Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black">User Registry</h2>
                    <p className="text-sm text-muted-foreground font-medium">Manage Buyers, Sellers, Promoters, and Logistics Agents.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type="text"
                                placeholder="Universal search..."
                                className="w-full h-11 bg-white border-none rounded-xl pl-12 pr-4 text-sm font-medium shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="h-10 px-4 rounded-xl border-white bg-white/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm">
                            {totalCount} Total Users
                        </Badge>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">User Profile</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Roles</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Activity</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Joined</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Security</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {users?.map((u) => {
                                const stats = getUserStats(u.id);
                                return (
                                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-primary border border-gray-200 overflow-hidden font-black text-xs">
                                                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.display_name?.[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-foreground">{u.display_name || "Unnamed User"}</p>
                                                    <p className="text-[10px] text-muted-foreground font-medium">{u.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-wrap gap-1">
                                                {(u.user_roles as unknown as any[])?.map((r, i) => (
                                                    <Badge key={i} className={cn(
                                                        "rounded-full border-none text-[8px] font-black uppercase tracking-tighter",
                                                        r.role === 'admin' ? 'bg-red-50 text-red-600' :
                                                            r.role === 'seller' ? 'bg-amber-100 text-amber-700' :
                                                                r.role === 'promoter' ? 'bg-purple-100 text-purple-700' :
                                                                    r.role === 'logistics' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                                    )}>
                                                        {r.role}
                                                    </Badge>
                                                ))}
                                                {(u.user_roles as unknown as any[])?.length === 0 && (
                                                    <Badge className="rounded-full bg-indigo-50 text-indigo-600 border-none text-[8px] font-black uppercase">Buyer</Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div>
                                                <p className="font-bold text-sm">{stats.count} Orders</p>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase">‚¦{stats.totalSpent.toLocaleString()} Spent</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-xs font-medium text-muted-foreground">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-xl text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    if (confirm("ARCHIVAL PROTOCOL: Are you sure you want to delete this user? This action is irreversible.")) {
                                                        deleteUserMutation.mutate(u.id);
                                                    }
                                                }}
                                                disabled={deleteUserMutation.isPending}
                                            >
                                                <Trash2 size={18} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 bg-white p-4 rounded-xl border border-gray-50 shadow-sm">
                    <div className="text-xs font-bold text-muted-foreground px-4">
                        Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-bold text-xs border-gray-100 h-10 px-6"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <div className="flex gap-1">
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                    return (
                                        <Button
                                            key={page}
                                            variant={currentPage === page ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "w-10 h-10 rounded-xl font-bold text-xs border-gray-100",
                                                currentPage === page ? "bg-primary text-white" : "text-muted-foreground"
                                            )}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </Button>
                                    );
                                }
                                if (page === currentPage - 2 || page === currentPage + 2) {
                                    return <span key={page} className="w-10 h-10 flex items-center justify-center text-muted-foreground">...</span>;
                                }
                                return null;
                            })}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-bold text-xs border-gray-100 h-10 px-6"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

