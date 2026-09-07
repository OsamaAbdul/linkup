import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Search, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
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

            let matchingUserIds: string[] = [];
            if (isRoleSearch) {
                const { data: roleData } = await supabase.from("user_roles").select("user_id").ilike("role", `%${searchQuery}%`);
                if (roleData) {
                    matchingUserIds = roleData.map(r => r.user_id);
                }
            }

            let query = supabase
                .from("profiles")
                .select("*", { count: 'exact' });

            if (searchQuery) {
                if (isRoleSearch && matchingUserIds.length > 0) {
                    query = query.or(`display_name.ilike.%${searchQuery}%,id.in.(${matchingUserIds.join(",")})`);
                } else if (isRoleSearch && matchingUserIds.length === 0) {
                     query = query.ilike("display_name", `%${searchQuery}%`);
                } else {
                    query = query.ilike("display_name", `%${searchQuery}%`);
                }
            }

            const { data, count, error } = await query
                .order("created_at", { ascending: false })
                .range(start, end);

            if (error) throw error;
            
            if (data && data.length > 0) {
                const userIds = data.map(u => u.id);
                const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
                
                const rolesMap = new Map<string, any[]>();
                rolesData?.forEach(r => {
                    if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
                    rolesMap.get(r.user_id)!.push(r);
                });
                
                data.forEach((u: any) => {
                    u.user_roles = rolesMap.get(u.id) || [];
                });
            }

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
        const totalSpent = userOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        return { count: userOrders.length, totalSpent };
    };

    const deleteUserMutation = useMutation({
        // ... (lines 31-41 remain same - omitted for simplicity but will be included in full replacement block if needed, but I'll use multi-chunk if it's too complex or just replace the whole functional scope)
        mutationFn: async (userId: string) => {
            const { error } = await (supabase as any).rpc("delete_user_admin", { target_user_id: userId });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Member successfully removed from the store.");
            queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
        },
        onError: (err: any) => {
            toast.error("Could not delete member: " + err.message);
        }
    });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset to first page on search
    };

    if (usersLoading) return <div className="p-12 text-center text-muted-foreground font-bold bg-white rounded-xl">Checking members list...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-black">Member List</h2>
                    <p className="text-sm text-muted-foreground font-medium">Manage everyone who uses the platform.</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="Search by name or role..."
                            className="w-full h-10 sm:h-11 bg-white border border-black/5 rounded-xl pl-10 pr-4 text-xs sm:text-sm font-medium shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <Badge variant="outline" className="h-10 px-3.5 rounded-xl border-black/5 bg-white text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm shrink-0">
                        {totalCount} Members
                    </Badge>
                </div>
            </div>

            <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-3 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Member Info</th>
                                <th className="hidden sm:table-cell px-4 py-4 md:px-8 md:py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Roles</th>
                                <th className="px-3 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Activity</th>
                                <th className="hidden md:table-cell px-4 py-4 md:px-8 md:py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Joined</th>
                                <th className="px-3 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Options</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {users?.map((u: any) => {
                                const stats = getUserStats(u.id);
                                return (
                                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-3 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-5">
                                            <div className="flex items-center gap-2.5 sm:gap-3">
                                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center text-primary border border-gray-200 overflow-hidden font-black text-xs shrink-0">
                                                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt={u.display_name || "User"} /> : u.display_name?.[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-xs sm:text-sm text-foreground truncate">{u.display_name || "Unnamed User"}</p>
                                                    <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px] sm:max-w-[180px]">{u.id}</p>
                                                    {/* Mobile roles and joined date */}
                                                    <div className="flex flex-wrap items-center gap-1 mt-1 sm:hidden">
                                                        {(u.user_roles as unknown as any[])?.map((r, i) => (
                                                            <Badge key={i} className={cn(
                                                                "rounded-full border-none text-[8px] font-black uppercase px-2 py-0",
                                                                r.role === 'admin' ? 'bg-red-50 text-red-600' :
                                                                r.role === 'seller' ? 'bg-amber-100 text-amber-700' :
                                                                r.role === 'promoter' ? 'bg-purple-100 text-purple-700' :
                                                                r.role === 'logistics' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                                            )}>
                                                                {r.role}
                                                            </Badge>
                                                        ))}
                                                        {(!u.user_roles || u.user_roles.length === 0) && (
                                                            <Badge className="rounded-full bg-indigo-50 text-indigo-600 border-none text-[8px] font-black uppercase px-2 py-0">Buyer</Badge>
                                                        )}
                                                        <span className="text-[9px] text-muted-foreground ml-1">
                                                            · {new Date(u.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hidden sm:table-cell px-4 py-4 md:px-8 md:py-5">
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
                                        <td className="px-3 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-5 whitespace-nowrap">
                                            <div>
                                                <p className="font-bold text-xs sm:text-sm">{stats.count} Orders</p>
                                                <p className="text-[9px] sm:text-[10px] text-muted-foreground font-black uppercase">₦{stats.totalSpent.toLocaleString()} Spent</p>
                                            </div>
                                        </td>
                                        <td className="hidden md:table-cell px-4 py-4 md:px-8 md:py-5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-5 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-xl text-destructive hover:bg-destructive/10 h-8 w-8"
                                                onClick={() => {
                                                    if (confirm("Are you sure? This will permanently delete this member and cannot be undone.")) {
                                                        deleteUserMutation.mutate(u.id);
                                                    }
                                                }}
                                                disabled={deleteUserMutation.isPending}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {totalPages > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-bold text-muted-foreground">
                        Page {currentPage} of {totalPages} ({totalCount} total members)
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-bold text-xs border-gray-200 h-9 px-4"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <div className="hidden sm:flex gap-1">
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                    return (
                                        <Button
                                            key={page}
                                            variant={currentPage === page ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "w-9 h-9 rounded-xl font-bold text-xs border-gray-200",
                                                currentPage === page ? "bg-primary text-white" : "text-muted-foreground"
                                            )}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </Button>
                                    );
                                }
                                if (page === currentPage - 2 || page === currentPage + 2) {
                                    return <span key={page} className="w-9 h-9 flex items-center justify-center text-muted-foreground">...</span>;
                                }
                                return null;
                            })}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-bold text-xs border-gray-200 h-9 px-4"
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

