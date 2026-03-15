import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search, AlertCircle } from "lucide-react";
import { m } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse-subtle" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl -z-10 animate-pulse-subtle delay-1000" />
      </div>

      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-6 max-w-md w-full relative z-10"
      >
        <div className="flex justify-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-background p-1.5 rounded-full shadow-lg">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">404</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Page not found</h1>
          <p className="text-lg text-muted-foreground">
            Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Link to="/" className="flex-1">
            <Button size="lg" className="w-full shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </Link>
          <Link to="/search" className="flex-1">
            <Button variant="outline" size="lg" className="w-full">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </Link>
        </div>

        <div className="text-xs text-muted-foreground pt-8">
          <p>If you believe this is an error, please contact support.</p>
        </div>
      </m.div>
    </div>
  );
};

export default NotFound;
