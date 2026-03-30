import { Button } from "@/shared/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-6">
      <h1 className="text-9xl font-black text-primary/20">404</h1>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Page Not Found</h2>
        <p className="text-muted-foreground">The page you are looking for doesn't exist or has been moved.</p>
      </div>
      <Button onClick={() => navigate("/")} size="lg">
        Go Back Home
      </Button>
    </div>
  );
}
