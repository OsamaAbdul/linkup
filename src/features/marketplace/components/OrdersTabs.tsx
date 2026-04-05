import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { OrderCard } from "./OrderCard";
import { ReportCard } from "./ReportCard";
import { MessageSquare } from "lucide-react";

interface OrdersTabsProps {
    orders: any[];
    filteredOrders: any[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    counts: {
        toShip: number;
        toReceive: number;
        completed: number;
        cancelled: number;
        reports: number;
    };
    userIssues: any[];
}

export function OrdersTabs({
    orders,
    filteredOrders,
    activeTab,
    setActiveTab,
    counts,
    userIssues
}: OrdersTabsProps) {
    const tabs = [
        { value: "all", label: "All", count: orders.length },
        { value: "to-ship", label: "To Ship", count: counts.toShip },
        { value: "to-receive", label: "To Receive", count: counts.toReceive },
        { value: "completed", label: "Completed", count: counts.completed },
        { value: "cancelled", label: "Cancelled", count: counts.cancelled },
        { value: "my-reports", label: "My Reports", count: counts.reports }
    ];

    return (
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl -mx-4 px-4 py-2 border-b mb-6 border-black/[0.03]">
                <TabsList className="bg-transparent h-auto p-0 gap-8 w-full justify-start rounded-none overflow-x-auto no-scrollbar scroll-smooth">
                    {tabs.map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-4 pt-2 font-bold text-xs uppercase tracking-widest transition-all duration-300 group"
                        >
                            <span className="relative">
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="ml-2 py-0.5 px-1.5 rounded-full bg-muted text-[9px] group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary transition-colors">
                                        {tab.count}
                                    </span>
                                )}
                            </span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>

            <div className="grid gap-4 sm:gap-6">
                {filteredOrders.length === 0 && activeTab !== "my-reports" ? (
                    <div className="text-center py-12 sm:py-20 border border-dashed border-black/[0.05] rounded-xl bg-muted/5 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground/30">
                            <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        <h3 className="font-bold text-base sm:text-lg">No Orders Yet</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mb-6 max-w-[240px] sm:max-w-xs">Your commercial registry is currently empty. Start browsing our global products.</p>
                        <Link to="/">
                            <Button className="rounded-full px-6 sm:px-8 font-bold text-[10px] sm:text-xs shadow-lg sm:shadow-xl shadow-primary/20 transition-transform active:scale-95">Browse Marketplace</Button>
                        </Link>
                    </div>
                ) : activeTab === "my-reports" ? (
                    userIssues.length === 0 ? (
                        <div className="text-center py-12 sm:py-20 border border-dashed border-black/[0.05] rounded-xl bg-muted/5 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground/30">
                                <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <h3 className="font-bold text-base sm:text-lg">Clear Judicial Record</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground max-w-[240px] sm:max-w-xs">You have no active reports or disputes in the official registry.</p>
                        </div>
                    ) : (
                        userIssues.map((issue) => (
                            <ReportCard key={issue.id} issue={issue} />
                        ))
                    )
                ) : (
                    filteredOrders.map((order) => (
                        <OrderCard key={order.id} order={order} />
                    ))
                )}
            </div>
        </Tabs>
    );
}
