import { m, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  currentImageIndex: number;
  setCurrentImageIndex: (idx: number | ((prev: number) => number)) => void;
  productTitle: string;
  productPrice: number;
}

export function ProductGallery({ 
  images, 
  currentImageIndex, 
  setCurrentImageIndex, 
  productTitle, 
  productPrice 
}: ProductGalleryProps) {
  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold && currentImageIndex < images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    } else if (info.offset.x > swipeThreshold && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  return (
    <m.div
      className="relative lg:h-fit"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="relative aspect-square overflow-hidden bg-muted lg:rounded-xl lg:shadow-xl group">
        <Link to="/" aria-label="Go back" className="absolute top-4 left-4 z-20 bg-foreground/20 backdrop-blur-xl p-2.5 rounded-xl text-card hover:bg-foreground/40 transition-all border border-card/10 shadow-lg focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft size={20} />
        </Link>

        <button aria-label="Share product" className="absolute top-4 right-4 z-20 bg-foreground/20 backdrop-blur-xl p-2.5 rounded-xl text-card hover:bg-foreground/40 transition-all border border-card/10 shadow-lg focus-visible:ring-2 focus-visible:ring-ring">
          <Share2 size={20} />
        </button>

        <div className="w-full h-full flex items-center justify-center">
          <AnimatePresence mode="wait">
            {images.length > 0 ? (
              <m.img
                key={currentImageIndex}
                src={images[currentImageIndex]}
                alt={`${productTitle} - image ${currentImageIndex + 1}`}
                className="w-full h-full object-cover touch-none"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image available</div>
            )}
          </AnimatePresence>
        </div>

        {/* Pagination Indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10 px-3 py-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  idx === currentImageIndex ? "bg-white w-4" : "bg-white/40"
                )}
              />
            ))}
          </div>
        )}

        {/* Desktop Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 backdrop-blur-xl p-3 rounded-xl text-white hover:bg-black/40 transition-all border border-white/10 opacity-0 group-hover:opacity-100 hidden lg:block",
                currentImageIndex === 0 && "pointer-events-none opacity-0"
              )}
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1))}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 backdrop-blur-xl p-2.5 rounded-xl text-white hover:bg-black/40 transition-all border border-white/10 opacity-0 group-hover:opacity-100 hidden lg:block",
                currentImageIndex === images.length - 1 && "pointer-events-none opacity-0"
              )}
            >
              <ArrowLeft size={20} className="rotate-180" />
            </button>
          </>
        )}

        {/* Price Floating Badge for Mobile */}
        <div className="absolute bottom-6 right-6 lg:hidden">
          <div className="bg-primary/90 backdrop-blur-xl px-4 py-1.5 rounded-xl border border-white/20 shadow-2xl">
            <p className="text-white font-black text-lg">₦{productPrice.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </m.div>
  );
}
