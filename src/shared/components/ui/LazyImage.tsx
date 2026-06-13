import React, { useState, useEffect } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface LazyImageProps extends HTMLMotionProps<"img"> {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
}

export const LazyImage = ({ src, alt, className = '', skeletonClassName = '', ...props }: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset state if src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <Skeleton className={`absolute inset-0 w-full h-full ${skeletonClassName}`} />
      )}

      {/* Error State */}
      {hasError && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground ${skeletonClassName}`}>
          <ImageOff className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-xs opacity-50">Failed to load</span>
        </div>
      )}

      {/* Actual Image */}
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full h-full object-cover ${className} ${hasError ? 'hidden' : ''}`}
        {...props}
      />
    </div>
  );
};
