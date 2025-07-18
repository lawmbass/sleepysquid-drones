import { useState } from 'react';
import Image from 'next/image';

export default function OptimizedImage({ 
  src, 
  alt, 
  width, 
  height, 
  className, 
  fallback = null,
  ...props 
}) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // If there's an error or no src, show fallback
  if (imageError || !src) {
    return fallback;
  }

  return (
    <div className="relative">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={() => {
          console.warn(`Failed to load image: ${src}`);
          setImageError(true);
        }}
        onLoad={() => {
          setIsLoading(false);
        }}
        {...props}
      />
      {isLoading && (
        <div 
          className={`absolute inset-0 bg-gray-200 animate-pulse rounded-full ${className}`}
          style={{ width, height }}
        />
      )}
    </div>
  );
}