import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, ShoppingBag, Activity, MapPin, BarChart3 } from "lucide-react";
import { AnalyticMetric } from "./MetricCards";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AnalyticsTabProps {
    revenue: number;
    totalOrders: number;
    chartData: any[];
}

export function AnalyticsTab({ revenue, totalOrders, chartData }: AnalyticsTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <p className="text-[9px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Intelligence Analytics</p>
                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Performance Monitor</h1>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <AnalyticMetric label="Gross Payout" value={`‚¦${revenue.toLocaleString()}`} icon={Wallet} color="text-primary" />
                <AnalyticMetric label="Total Orders" value={totalOrders} icon={ShoppingBag} />
                <AnalyticMetric label="Conversion" value="4.2%" icon={Activity} />
                <AnalyticMetric label="Global Reach" value="+15" icon={MapPin} />
            </div>

            {chartData.length > 0 ? (
                <Card className="rounded-xl border-black/[0.03] bg-white p-6 shadow-2xl shadow-black/[0.02]">
                    <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight">Registry Momentum</CardTitle>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Orders Volatility Registry</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="rounded-full text-[9px] font-black uppercase px-4 border-black/5 bg-muted/30">7D</Button>
                            <Button variant="outline" size="sm" className="rounded-full text-[9px] font-black uppercase px-4 bg-primary text-white border-none shadow-lg shadow-primary/20">30D</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 900, fontFamily: 'Public Sans', fill: '#888' }}
                                />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', fontWeight: 900, fontSize: '12px' }}
                                />
                                <Bar
                                    dataKey="orders"
                                    fill="url(#barGradient)"
                                    radius={[12, 12, 12, 12]}
                                    barSize={32}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? 'hsl(var(--primary))' : 'rgba(0,0,0,0.05)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            ) : (
                <div className="h-[300px] rounded-xl border-2 border-dashed border-black/5 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <BarChart3 size={32} strokeWidth={1} />
                    <p className="text-[11px] font-black uppercase tracking-widest">Awaiting system data points...</p>
                </div>
            )}
        </div>
    );
}

