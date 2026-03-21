import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface ProductReportModalProps {
    productId: string;
    sellerId: string;
    productTitle: string;
    trigger?: React.ReactNode;
}

export function ProductReportModal({ productId, sellerId, productTitle, trigger }: ProductReportModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [issueTitle, setIssueTitle] = useState("");
    const [issueDescription, setIssueDescription] = useState("");
    const [issuePriority, setIssuePriority] = useState("low");
    const { user } = useAuth();

    const reportIssueMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Auth required");
            const { error } = await supabase
                .from("issues" as any)
                .insert([{
                    user_id: user.id,
                    product_id: productId,
                    seller_id: sellerId,
                    title: `[Product] ${issueTitle}`,
                    description: `Product: ${productTitle}\n\n${issueDescription}`,
                    priority: issuePriority,
                    status: "open"
                }]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Product report broadcasted to administration");
            setIsOpen(false);
            setIssueTitle("");
            setIssueDescription("");
        },
        onError: (err: any) => {
            toast.error("Transmission failed: " + err.message);
        }
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive flex items-center gap-2">
                        <AlertCircle size={14} />
                        Report Product
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="rounded-xl max-w-md border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Report Product Anomalies</DialogTitle>
                    <DialogDescription className="font-medium">
                        Help us maintain the integrity of the marketplace by reporting suspicious items.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reason for Report</Label>
                        <input
                            id="title"
                            placeholder="e.g. Counterfeit, Incorrect Info, Prohibited Item"
                            className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            value={issueTitle}
                            onChange={(e) => setIssueTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="priority" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Urgency</Label>
                        <Select value={issuePriority} onValueChange={setIssuePriority}>
                            <SelectTrigger className="h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20">
                                <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl">
                                <SelectItem value="low">Standard Report</SelectItem>
                                <SelectItem value="high">High Concern</SelectItem>
                                <SelectItem value="critical">Immediate Hazard</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="desc" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Findings Detail</Label>
                        <Textarea
                            id="desc"
                            placeholder="Describe the issues with this listing..."
                            className="min-h-[120px] bg-gray-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                            value={issueDescription}
                            onChange={(e) => setIssueDescription(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        className="w-full h-12 rounded-xl font-black bg-primary shadow-xl shadow-primary/20 active:scale-95 transition-all"
                        onClick={() => reportIssueMutation.mutate()}
                        disabled={reportIssueMutation.isPending || !issueTitle || !issueDescription}
                    >
                        {reportIssueMutation.isPending ? "Broadcasting..." : "Submit Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

