import React, { useState, useEffect, useRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface LazyImageProps extends HTMLMotionProps<"img"> {
  src?: string | null;
  alt: string;
  className?: string;
  skeletonClassName?: string;
}

export const LazyImage = ({
  src,
  alt,
  className = '',
  skeletonClassName = '',
  ...props
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const effectiveSrc = src?.trim() || "";

  // Reset state if src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  return (
    <div className={`relative overflow-hidden w-full h-full bg-muted/30 ${className}`}>
      {/* Subtle pulse shimmer while loading a real image */}
      {!isLoaded && !hasError && effectiveSrc && (
        <Skeleton className={`absolute inset-0 w-full h-full opacity-20 pointer-events-none ${skeletonClassName}`} />
      )}

      {/* Actual Product Image - Smoothly fades in on top when loaded */}
      {effectiveSrc && !hasError && (
        <motion.img
          ref={imgRef}
          src={effectiveSrc}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(false);
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.35 }}
          className={`relative z-10 w-full h-full object-cover ${className}`}
          {...props}
        />
      )}

      {/* No Image State */}
      {(!effectiveSrc || hasError) && (
        <div className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest">No Image</span>
        </div>
      )}
    </div>
  );
};
