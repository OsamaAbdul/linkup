import { Button } from "@/shared/components/ui/button";
import { BellRing, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

export function EnableNotificationsButton({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const { isSupported, isSubscribed, isSubscribing, subscribe } = usePushNotifications();

  // Hide if not supported or already subscribed
  if (!isSupported || isSubscribed) return null;

  return (
    <Button
      variant={variant}
      disabled={isSubscribing}
      className={cn("gap-2", className)}
      onClick={() => subscribe()}
    >
      {isSubscribing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <BellRing className="w-4 h-4" />
      )}
      <span className="font-semibold">{isSubscribing ? "Enabling..." : "Enable Notifications"}</span>
    </Button>
  );
}
