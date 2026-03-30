import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Wallet, ShoppingBag, TrendingUp, BarChart3, ArrowUpRight, Clock } from "lucide-react";
import { MetricCard } from "./MetricCards";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";

interface AnalyticsTabProps {
    revenue: number;
    netRevenue: number;
    escrowBalance: number;
    totalOrders: number;
    chartData: any[];
}

export function AnalyticsTab({ revenue, netRevenue, escrowBalance, totalOrders, chartData }: AnalyticsTabProps) {
    const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.3em]">
                        Simple Insights
                    </p>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                    Data Overview
                </h1>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Gross Revenue"
                    value={`₦${revenue.toLocaleString()}`}
                    icon={Wallet}
                    color="text-primary"

                />
                <MetricCard
                    title="Net Earnings"
                    value={`₦${netRevenue.toLocaleString()}`}
                    icon={BarChart3}
                    color="text-green-600"

                />
                <MetricCard
                    title="Total Orders"
                    value={totalOrders}
                    icon={ShoppingBag}

                />
                <MetricCard
                    title="Avg Order Value"
                    value={`₦${Math.round(avgOrderValue).toLocaleString()}`}
                    icon={TrendingUp}
                    status="Steady"
                />
                <MetricCard
                    title="On Hold (Escrow)"
                    value={`₦${escrowBalance.toLocaleString()}`}
                    icon={Clock}
                    color="text-amber-500"
                />
            </div>

            {chartData.length > 0 ? (
                <Card className="rounded-2xl border-none bg-white p-6 md:p-8 shadow-2xl shadow-black/[0.03] overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all duration-700 group-hover:bg-primary/10" />

                    <CardHeader className="p-0 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                        <div>
                            <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                                <BarChart3 className="text-primary" size={24} />
                                Activity Dynamics
                            </CardTitle>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                                Order velocity and conversion momentum
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-full border border-black/5">
                            <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-black uppercase px-4 hover:bg-white hover:shadow-sm">7D</Button>
                            <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-black uppercase px-4 bg-white shadow-sm">30D</Button>
                            <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-black uppercase px-4 hover:bg-white hover:shadow-sm">90D</Button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 h-[350px] relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="rgba(0,0,0,0.03)"
                                />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 900, fill: '#A1A1AA' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 900, fill: '#A1A1AA' }}
                                    domain={[0, 'dataMax + 2']}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                                        background: 'rgba(255,255,255,0.95)',
                                        backdropFilter: 'blur(10px)',
                                        fontSize: '12px',
                                        fontWeight: 900
                                    }}
                                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '4 4' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="orders"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorOrders)"
                                    animationDuration={2000}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            ) : (
                <div className="h-[400px] rounded-2xl border-2 border-dashed border-black/5 bg-white/50 flex flex-col items-center justify-center gap-4 text-muted-foreground group">
                    <div className="p-6 rounded-3xl bg-white shadow-xl shadow-black/[0.02] transition-transform group-hover:scale-110 duration-500">
                        <BarChart3 size={48} strokeWidth={1} className="text-primary/40" />
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Awaiting System Data</p>
                        <p className="text-[10px] font-bold mt-1 text-muted-foreground/60">Getting your insights ready. Grab a coffee! ☕</p>
                    </div>
                </div>
            )}
        </div>
    );
}

