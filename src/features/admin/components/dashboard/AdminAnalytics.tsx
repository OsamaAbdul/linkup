import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Info, ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export default function AdminAnalytics() {
    const dashboardUrl = import.meta.env.VITE_POSTHOG_SHARED_DASHBOARD_URL;

    if (!dashboardUrl) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
                    <p className="text-muted-foreground mt-2">
                        Real-time user insights, sign-ins, and activity reports.
                    </p>
                </div>

                <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            Dashboard Not Configured
                        </CardTitle>
                        <CardDescription>
                            We need a PostHog Shared Dashboard URL to display live charts here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm">
                            To view your live analytics in this panel, follow these 3 quick steps:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm ml-2">
                            <li>Log in to your PostHog account and go to <strong>Dashboards</strong>.</li>
                            <li>Open a dashboard (e.g., "App Insights") and click the <strong>Share</strong> button in the top right.</li>
                            <li>Toggle "Share dashboard publicly", copy the embed link, and add it to your <code>.env</code> file as:
                                <br />
                                <code className="bg-gray-100 px-2 py-1 rounded text-xs text-primary mt-2 inline-block">
                                    VITE_POSTHOG_SHARED_DASHBOARD_URL=https://us.posthog.com/embedded/your-token
                                </code>
                            </li>
                        </ol>
                        
                        <div className="pt-4">
                            <Button 
                                variant="outline" 
                                className="gap-2"
                                onClick={() => window.open('https://us.posthog.com/project/dashboards', '_blank')}
                            >
                                Open PostHog <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
                <p className="text-muted-foreground mt-2">
                    Real-time user insights and activity.
                </p>
            </div>

            <Card className="flex-1 min-h-[700px] overflow-hidden border-none shadow-lg">
                <iframe 
                    src={dashboardUrl} 
                    frameBorder="0" 
                    width="100%" 
                    height="100%"
                    className="w-full h-full min-h-[700px] rounded-xl"
                    allowFullScreen
                    title="PostHog Shared Dashboard"
                />
            </Card>
        </div>
    );
}
