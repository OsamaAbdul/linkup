import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  Mail,
  Send,
  Users,
  ShoppingBag,
  Store,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  Monitor,
  Eye,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Tag,
  Flame,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AudienceType = "all" | "buyers" | "sellers" | "logistics";

interface CampaignForm {
  title: string;
  subject: string;
  preheader: string;
  content: string;
  target_audience: AudienceType;
  cta_text: string;
  cta_url: string;
  banner_image_url: string;
}

const TEMPLATE_PRESETS = [
  {
    name: "Special Promotion / Sale",
    icon: Flame,
    subject: "🔥 Exclusive Flash Deals Just Dropped on Linkup!",
    preheader: "Shop verified local stores with instant same-day delivery.",
    title: "Special Weekend Marketplace Offers",
    content:
      "We've just launched our exclusive weekend deals across top categories on Linkup Marketplace!\n\nWhether you're shopping for fresh groceries, fashion, electronics, or everyday essentials, our verified local sellers are offering up to 25% off selected items.\n\nPlace your order today and enjoy swift doorstep delivery with our verified logistics riders.",
    cta_text: "Shop Weekend Deals",
    cta_url: "https://www.linkupng.com",
    banner_image_url: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&auto=format&fit=crop&q=80",
  },
  {
    name: "Seller Growth Announcement",
    icon: Store,
    subject: "📦 Boost Your Store Sales This Week on Linkup",
    preheader: "Tips and new marketplace tools to get your products discovered.",
    title: "New Tools to Grow Your Store",
    content:
      "Hello Linkup Merchant,\n\nWe're continuously updating the Linkup platform to help you reach more customers in your neighborhood and beyond.\n\nMake sure your product catalogs are up-to-date with clear photos, accurate stock counts, and competitive prices to appear at the top of buyer searches.\n\nLog in to your Seller Dashboard to check pending orders and manage your inventory.",
    cta_text: "Open Seller Dashboard",
    cta_url: "https://www.linkupng.com/dashboard",
    banner_image_url: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80",
  },
  {
    name: "Logistics Partner Update",
    icon: Truck,
    subject: "🛵 High Delivery Demand in Your Zone - Active Missions",
    preheader: "New delivery opportunities available right now on Linkup.",
    title: "New Delivery Missions Available",
    content:
      "Attention Logistics Partners,\n\nOrder volume is currently high across key delivery zones. Ensure your rider profile is marked 'Online' to receive instant delivery missions and earn competitive drop-off payouts.\n\nRemember to verify recipient OTPs at delivery points for instant payout reconciliation.",
    cta_text: "Go To Logistics Center",
    cta_url: "https://www.linkupng.com/logistics",
    banner_image_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&auto=format&fit=crop&q=80",
  },
];

export default function AdminNewsletterManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<any>(null);

  const [form, setForm] = useState<CampaignForm>({
    title: "Exciting Updates on Linkup Marketplace",
    subject: "✨ Discover What's New on Linkup Today!",
    preheader: "Check out the latest offers and features available for you.",
    content:
      "Hello,\n\nWe're thrilled to share our latest platform highlights with you! From top trending products to faster doorstep delivery, Linkup makes connecting with local buyers, sellers, and riders seamless.\n\nExplore our latest arrivals or manage your orders directly from your account.",
    target_audience: "all",
    cta_text: "Explore Linkup Now",
    cta_url: "https://www.linkupng.com",
    banner_image_url: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&auto=format&fit=crop&q=80",
  });

  // 1. Fetch Audience Metrics
  const { data: audienceMetrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ["admin-newsletter-audience-metrics"],
    queryFn: async () => {
      const { count: totalProfiles } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { data: roles } = await supabase.from("user_roles").select("role");

      let buyers = 0;
      let sellers = 0;
      let logistics = 0;

      roles?.forEach((r) => {
        if (r.role === "buyer") buyers++;
        if (r.role === "seller") sellers++;
        if (r.role === "logistics") logistics++;
      });

      // Default users without specific role are buyers
      const totalUsers = totalProfiles || 0;
      const explicitRolesSum = buyers + sellers + logistics;
      if (totalUsers > explicitRolesSum) {
        buyers += totalUsers - explicitRolesSum;
      }

      return {
        all: totalUsers,
        buyers: Math.max(buyers, 1),
        sellers: Math.max(sellers, 0),
        logistics: Math.max(logistics, 0),
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Campaign History
  const { data: campaigns, isLoading: isCampaignsLoading } = useQuery({
    queryKey: ["admin-newsletter-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // Calculate high-level KPIs
  const totalCampaignsSent = campaigns?.filter((c) => c.status === "sent").length || 0;
  const totalEmailsDelivered = campaigns?.reduce((acc, curr) => acc + (curr.success_count || 0), 0) || 0;

  // 3. Send Test Email Mutation
  const sendTestMutation = useMutation({
    mutationFn: async (targetEmail: string) => {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: {
          ...form,
          target_audience: "test",
          test_email: targetEmail,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(`Test email successfully sent to ${testEmail || "your email"}!`);
      setIsTestModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(`Failed to send test email: ${err.message}`);
    },
  });

  // 4. Send Live Broadcast Mutation
  const sendBroadcastMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: {
          ...form,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Campaign successfully dispatched to ${data.success_count} recipients!`);
      setIsConfirmSendOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-newsletter-campaigns"] });
      setActiveTab("history");
    },
    onError: (err: any) => {
      toast.error(`Failed to dispatch newsletter: ${err.message}`);
    },
  });

  const handleApplyPreset = (preset: (typeof TEMPLATE_PRESETS)[0]) => {
    setForm((prev) => ({
      ...prev,
      title: preset.title,
      subject: preset.subject,
      preheader: preset.preheader,
      content: preset.content,
      cta_text: preset.cta_text,
      cta_url: preset.cta_url,
      banner_image_url: preset.banner_image_url,
    }));
    toast.info(`Applied "${preset.name}" template`);
  };

  const currentAudienceCount =
    form.target_audience === "all"
      ? audienceMetrics?.all || 0
      : form.target_audience === "buyers"
      ? audienceMetrics?.buyers || 0
      : form.target_audience === "sellers"
      ? audienceMetrics?.sellers || 0
      : audienceMetrics?.logistics || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E96E28]/10 flex items-center justify-center text-[#E96E28]">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                Newsletter & Email Broadcast
              </h2>
              <p className="text-sm text-muted-foreground font-medium">
                Reach buyers, sellers, and logistics partners using your verified Resend email setup.
              </p>
            </div>
          </div>
        </div>

        {/* Action button in header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-newsletter-campaigns"] });
              queryClient.invalidateQueries({ queryKey: ["admin-newsletter-audience-metrics"] });
              toast.success("Newsletter stats updated");
            }}
            className="h-11 rounded-xl gap-2 font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setIsTestModalOpen(true)}
            variant="outline"
            className="h-11 rounded-xl gap-2 font-bold border-[#E96E28]/30 text-[#E96E28] hover:bg-[#E96E28]/10"
          >
            <Send className="w-4 h-4" />
            Send Test Email
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="rounded-2xl border-none shadow-sm bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Total Campaigns
            </span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#E96E28] flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-foreground">
            {isCampaignsLoading ? "..." : totalCampaignsSent}
          </div>
          <p className="text-xs text-muted-foreground font-medium">Marketing broadcasts sent</p>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Emails Delivered
            </span>
            <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-foreground">
            {isCampaignsLoading ? "..." : totalEmailsDelivered.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground font-medium">Direct inbox deliveries via Resend</p>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Registered Buyers
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-foreground">
            {isMetricsLoading ? "..." : (audienceMetrics?.buyers || 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground font-medium">Auto-notified on new product listings</p>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Sellers & Logistics
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-foreground">
            {isMetricsLoading
              ? "..."
              : `${audienceMetrics?.sellers || 0} / ${audienceMetrics?.logistics || 0}`}
          </div>
          <p className="text-xs text-muted-foreground font-medium">Sellers / Logistics partners</p>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "compose" | "history")}
        className="space-y-6"
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <TabsList className="bg-gray-100/80 p-1 rounded-xl">
            <TabsTrigger
              value="compose"
              className="rounded-lg font-bold text-xs uppercase tracking-wider px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Compose Newsletter
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg font-bold text-xs uppercase tracking-wider px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Campaign History ({campaigns?.length || 0})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: COMPOSE */}
        <TabsContent value="compose" className="space-y-6">
          {/* Quick Presets */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E96E28]" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">
                Load Quick Template:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_PRESETS.map((preset, idx) => {
                const Icon = preset.icon;
                return (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPreset(preset)}
                    className="rounded-xl h-9 text-xs font-bold gap-1.5 hover:border-[#E96E28] hover:text-[#E96E28] transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#E96E28]" />
                    {preset.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Audience Selector Card */}
              <Card className="rounded-2xl border-none shadow-sm bg-white p-6 space-y-4">
                <div>
                  <h3 className="text-base font-black text-foreground">1. Target Audience</h3>
                  <p className="text-xs text-muted-foreground">
                    Select which platform community members will receive this broadcast.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      id: "all" as AudienceType,
                      label: "All Users",
                      icon: Users,
                      count: audienceMetrics?.all || 0,
                      color: "text-gray-900 border-gray-900 bg-gray-50",
                    },
                    {
                      id: "buyers" as AudienceType,
                      label: "Buyers",
                      icon: ShoppingBag,
                      count: audienceMetrics?.buyers || 0,
                      color: "text-blue-600 border-blue-600 bg-blue-50/50",
                    },
                    {
                      id: "sellers" as AudienceType,
                      label: "Sellers",
                      icon: Store,
                      count: audienceMetrics?.sellers || 0,
                      color: "text-amber-600 border-amber-600 bg-amber-50/50",
                    },
                    {
                      id: "logistics" as AudienceType,
                      label: "Logistics",
                      icon: Truck,
                      count: audienceMetrics?.logistics || 0,
                      color: "text-purple-600 border-purple-600 bg-purple-50/50",
                    },
                  ].map((aud) => {
                    const Icon = aud.icon;
                    const isSelected = form.target_audience === aud.id;
                    return (
                      <button
                        key={aud.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, target_audience: aud.id }))}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all text-center gap-1.5",
                          isSelected
                            ? "border-[#E96E28] bg-orange-50/50 shadow-sm"
                            : "border-gray-100 hover:border-gray-300 bg-white"
                        )}
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center",
                            isSelected ? "bg-[#E96E28] text-white" : "bg-gray-100 text-gray-600"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-foreground mt-1">{aud.label}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] font-black rounded-full px-2 py-0.5",
                            isSelected ? "bg-[#E96E28]/10 text-[#E96E28]" : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {aud.count} recipients
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Email Content Card */}
              <Card className="rounded-2xl border-none shadow-sm bg-white p-6 space-y-5">
                <div>
                  <h3 className="text-base font-black text-foreground">2. Email Content & Subject</h3>
                  <p className="text-xs text-muted-foreground">
                    Craft your messaging. A compelling subject increases open rates.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Subject Line *
                    </label>
                    <Input
                      placeholder="e.g. 🔥 Weekend Flash Sale on Linkup!"
                      value={form.subject}
                      onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50/60 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Preheader (Preview Text)
                    </label>
                    <Input
                      placeholder="Snippet shown next to subject line in inbox..."
                      value={form.preheader}
                      onChange={(e) => setForm((prev) => ({ ...prev, preheader: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50/60 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Headline Title
                    </label>
                    <Input
                      placeholder="Big bold headline inside email..."
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50/60 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Banner Image URL (Optional)
                    </label>
                    <Input
                      placeholder="https://... (Direct image link for top banner)"
                      value={form.banner_image_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, banner_image_url: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50/60 font-medium text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Message Body *
                    </label>
                    <Textarea
                      rows={7}
                      placeholder="Write your email body here. Double enter creates a new paragraph..."
                      value={form.content}
                      onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                      className="rounded-xl bg-gray-50/60 font-medium text-sm leading-relaxed p-4"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Tip: Separate paragraphs with an empty line. Line breaks will be formatted cleanly in the email.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Call To Action Card */}
              <Card className="rounded-2xl border-none shadow-sm bg-white p-6 space-y-4">
                <div>
                  <h3 className="text-base font-black text-foreground">3. Call to Action Button</h3>
                  <p className="text-xs text-muted-foreground">
                    Direct recipients to shop, explore deals, or view their dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Button Label
                    </label>
                    <Input
                      placeholder="e.g. Shop Marketplace Now"
                      value={form.cta_text}
                      onChange={(e) => setForm((prev) => ({ ...prev, cta_text: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50/60 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Target Destination URL
                    </label>
                    <Input
                      placeholder="https://www.linkupng.com..."
                      value={form.cta_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, cta_url: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50/60 font-medium"
                    />
                  </div>
                </div>
              </Card>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-bold px-3 py-1 rounded-lg">
                    Audience: {currentAudienceCount} recipients
                  </Badge>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTestModalOpen(true)}
                    className="h-11 rounded-xl font-bold gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Send Test
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsConfirmSendOpen(true)}
                    disabled={!form.subject || !form.content || sendBroadcastMutation.isPending}
                    className="h-11 rounded-xl bg-[#E96E28] hover:bg-[#E96E28]/90 text-white font-bold gap-2 px-6 shadow-sm shadow-[#E96E28]/25"
                  >
                    <Send className="w-4 h-4" />
                    {sendBroadcastMutation.isPending ? "Sending..." : "Dispatch Broadcast"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Live Email Preview (5 cols) */}
            <div className="lg:col-span-5 sticky top-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#E96E28]" />
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">
                    Live Email Preview
                  </span>
                </div>

                <div className="flex items-center bg-gray-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1",
                      previewDevice === "desktop" ? "bg-white text-foreground shadow-sm" : "text-gray-500"
                    )}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1",
                      previewDevice === "mobile" ? "bg-white text-foreground shadow-sm" : "text-gray-500"
                    )}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Mobile
                  </button>
                </div>
              </div>

              {/* Preview Container Mockup */}
              <div
                className={cn(
                  "mx-auto transition-all duration-300 bg-[#F4F6F8] p-4 rounded-3xl border border-gray-200 shadow-inner overflow-hidden",
                  previewDevice === "mobile" ? "max-w-[340px]" : "w-full"
                )}
              >
                {/* Inbox metadata header */}
                <div className="bg-white p-3 rounded-t-2xl border-b border-gray-100 text-xs space-y-1 mb-2">
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>
                      From: <strong className="text-gray-900">Linkup Marketplace</strong> &lt;support@linkupng.com&gt;
                    </span>
                    <span>Just now</span>
                  </div>
                  <p className="font-bold text-gray-900 text-xs truncate">
                    {form.subject || "Subject line goes here..."}
                  </p>
                  {form.preheader && (
                    <p className="text-[10px] text-gray-400 truncate">{form.preheader}</p>
                  )}
                </div>

                {/* Email Canvas */}
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200/60">
                  {/* Brand Header */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 text-center">
                    <img
                      src="https://www.linkupng.com/assets/logo-jbH7uo1t.png"
                      alt="Linkup"
                      className="h-7 mx-auto object-contain"
                    />
                  </div>

                  {/* Banner Image if any */}
                  {form.banner_image_url && (
                    <div className="w-full h-36 max-h-40 overflow-hidden bg-gray-100">
                      <img
                        src={form.banner_image_url}
                        alt="Campaign Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-5 space-y-4">
                    {form.title && (
                      <h2 className="text-lg font-black text-gray-900 leading-snug tracking-tight">
                        {form.title}
                      </h2>
                    )}

                    <p className="text-xs font-semibold text-gray-500">
                      Hello Valued Member,
                    </p>

                    <div className="text-xs text-gray-700 leading-relaxed space-y-3 whitespace-pre-line">
                      {form.content || "Your message body content will appear here..."}
                    </div>

                    {form.cta_text && (
                      <div className="pt-2 pb-1 text-center">
                        <span className="inline-block bg-[#E96E28] text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-md shadow-[#E96E28]/25 cursor-pointer">
                          {form.cta_text} &rarr;
                        </span>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-100 text-[11px] text-gray-400">
                      Best regards,<br />
                      <strong className="text-gray-700">The Linkup Team</strong>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-gray-50 p-4 border-t border-gray-100 text-center space-y-1">
                    <p className="text-[10px] text-gray-500">
                      You are receiving this communication as a member of Linkup Marketplace.
                    </p>
                    <p className="text-[9px] text-gray-400">
                      &copy; {new Date().getFullYear()} Linkup Marketplace. Nigeria.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: CAMPAIGN HISTORY */}
        <TabsContent value="history" className="space-y-6">
          <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-100">
              <CardTitle className="text-lg font-black">Broadcast Logs & History</CardTitle>
              <CardDescription className="text-xs">
                Review all past marketing newsletters, target audiences, and delivery statuses.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              {isCampaignsLoading ? (
                <div className="p-12 text-center text-muted-foreground font-bold text-sm">
                  Loading campaign history...
                </div>
              ) : !campaigns || campaigns.length === 0 ? (
                <div className="p-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-foreground">No campaigns sent yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Compose and send your first marketing broadcast using the &quot;Compose Newsletter&quot; tab.
                  </p>
                  <Button
                    onClick={() => setActiveTab("compose")}
                    className="rounded-xl font-bold bg-[#E96E28] hover:bg-[#E96E28]/90 text-white"
                  >
                    Compose First Campaign
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        <th className="px-6 py-4">Campaign & Subject</th>
                        <th className="px-6 py-4">Audience</th>
                        <th className="px-6 py-4">Delivered</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Sent At</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {campaigns.map((camp: any) => (
                        <tr key={camp.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-foreground">{camp.title || camp.subject}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-xs">{camp.subject}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full uppercase text-[9px] font-black tracking-wider px-2.5 py-0.5",
                                camp.target_audience === "buyers"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : camp.target_audience === "sellers"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : camp.target_audience === "logistics"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-gray-100 text-gray-700 border-gray-200"
                              )}
                            >
                              {camp.target_audience}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-foreground">
                              {camp.success_count || 0}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {" "}/ {camp.recipients_count || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              className={cn(
                                "rounded-full border-none text-[9px] font-black uppercase tracking-wider",
                                camp.status === "sent"
                                  ? "bg-green-100 text-green-700"
                                  : camp.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              )}
                            >
                              {camp.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {camp.sent_at
                              ? new Date(camp.sent_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Draft"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCampaignForModal(camp)}
                              className="h-8 rounded-lg font-bold text-xs"
                            >
                              View Content
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: SEND TEST EMAIL */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#E96E28]" />
              Send Test Email
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Send a real copy of this email to your personal address before broadcasting to the whole list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Recipient Email Address
            </label>
            <Input
              type="email"
              placeholder="e.g. yourname@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="h-11 rounded-xl bg-gray-50/60 font-medium"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank to send to your currently signed-in admin account.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsTestModalOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendTestMutation.mutate(testEmail)}
              disabled={sendTestMutation.isPending}
              className="rounded-xl bg-[#E96E28] hover:bg-[#E96E28]/90 text-white font-bold"
            >
              {sendTestMutation.isPending ? "Sending Test..." : "Send Test Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CONFIRM BROADCAST DISPATCH */}
      <Dialog open={isConfirmSendOpen} onOpenChange={setIsConfirmSendOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-foreground">
              <AlertCircle className="w-5 h-5 text-[#E96E28]" />
              Confirm Broadcast Dispatch
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to send this newsletter to the target audience?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-orange-50/60 border border-orange-100 p-4 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between font-bold">
              <span className="text-gray-600">Target Audience:</span>
              <span className="uppercase text-[#E96E28] font-black">{form.target_audience}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-gray-600">Estimated Recipients:</span>
              <span className="text-gray-900 font-black">{currentAudienceCount} users</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-gray-600">Subject:</span>
              <span className="text-gray-900 truncate max-w-[200px]">{form.subject}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsConfirmSendOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendBroadcastMutation.mutate()}
              disabled={sendBroadcastMutation.isPending}
              className="rounded-xl bg-[#E96E28] hover:bg-[#E96E28]/90 text-white font-bold"
            >
              {sendBroadcastMutation.isPending ? "Dispatching..." : "Yes, Send Broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: VIEW PAST CAMPAIGN CONTENT */}
      <Dialog
        open={!!selectedCampaignForModal}
        onOpenChange={(open) => !open && setSelectedCampaignForModal(null)}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              {selectedCampaignForModal?.title || selectedCampaignForModal?.subject}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Subject: {selectedCampaignForModal?.subject}
            </DialogDescription>
          </DialogHeader>

          {selectedCampaignForModal && (
            <div className="space-y-4 text-xs py-2">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Target Audience
                  </span>
                  <span className="font-bold uppercase text-foreground">
                    {selectedCampaignForModal.target_audience}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Delivered
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedCampaignForModal.success_count} / {selectedCampaignForModal.recipients_count}
                  </span>
                </div>
              </div>

              {selectedCampaignForModal.banner_image_url && (
                <img
                  src={selectedCampaignForModal.banner_image_url}
                  alt="Banner"
                  className="w-full h-36 object-cover rounded-xl"
                />
              )}

              <div className="bg-white p-4 rounded-xl border border-gray-100 whitespace-pre-line text-gray-700 leading-relaxed">
                {selectedCampaignForModal.content}
              </div>

              {selectedCampaignForModal.cta_text && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-muted-foreground">CTA:</span>
                  <span className="font-bold text-[#E96E28]">{selectedCampaignForModal.cta_text}</span>
                  <span className="text-gray-400">({selectedCampaignForModal.cta_url})</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedCampaignForModal(null)}
              className="rounded-xl font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
