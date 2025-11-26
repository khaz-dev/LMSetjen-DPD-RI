import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useImageLazyLoad Hook
 * Lazy loads images as they come into view
 * Uses Intersection Observer for performance
 *
 * Usage:
 * const { ref, src } = useImageLazyLoad('/path/to/image.jpg');
 * <img ref={ref} src={src} alt="..." />
 */
export const useImageLazyLoad = (imageSrc, placeholderSrc = null) => {
  const ref = useRef(null);
  const [src, setSrc] = useState(placeholderSrc || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Image is in viewport, load it
            setSrc(imageSrc);
            setIsLoaded(true);

            // Stop observing this image
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before image comes into view
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [imageSrc]);

  const handleError = useCallback(() => {
    setError(true);
    setSrc(placeholderSrc || '');
  }, [placeholderSrc]);

  return {
    ref,
    src,
    isLoaded,
    error,
    onError: handleError
  };
};

/**
 * LazyImage Component
 * Wrapper component for lazy-loaded images with fallback
 *
 * Usage:
 * <LazyImage
 *   src="/path/to/image.jpg"
 *   alt="Course thumbnail"
 *   placeholder="/placeholder.jpg"
 *   className="course-image"
 * />
 */
const LazyImage = ({
  src,
  alt = '',
  placeholder = null,
  className = '',
  width = null,
  height = null,
  onLoad = null,
  onError = null,
  ...props
}) => {
  const ref = useRef(null);
  const [currentSrc, setCurrentSrc] = useState(placeholder || '');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Load the actual image
            const img = new Image();

            img.onload = () => {
              setCurrentSrc(src);
              setIsLoading(false);
              onLoad?.();
            };

            img.onerror = () => {
              setHasError(true);
              setIsLoading(false);
              onError?.();
            };

            img.src = src;

            // Stop observing
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px'
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [src, onLoad, onError]);

  return (
    <img
      ref={ref}
      src={currentSrc}
      alt={alt}
      className={`lazy-image ${isLoading ? 'loading' : 'loaded'} ${hasError ? 'error' : ''} ${className}`}
      width={width}
      height={height}
      {...props}
    />
  );
};

/**
 * useBatchImageLoad Hook
 * Batch load multiple images with concurrent limit
 *
 * Usage:
 * const { loadedCount, totalCount } = useBatchImageLoad(imageUrls, 4);
 */
export const useBatchImageLoad = (imageUrls = [], concurrency = 4) => {
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(imageUrls.length);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (imageUrls.length === 0) return;

    setTotalCount(imageUrls.length);
    setLoadedCount(0);
    setErrors([]);

    // Load images with concurrency limit
    const loadImages = async () => {
      const queue = [...imageUrls];
      const loading = [];

      const processNext = async () => {
        if (queue.length === 0) return;

        const url = queue.shift();

        try {
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });

          setLoadedCount((prev) => prev + 1);
        } catch (error) {
          setErrors((prev) => [...prev, { url, error }]);
        }
      };

      // Start initial concurrent loads
      for (let i = 0; i < concurrency && i < queue.length; i++) {
        loading.push(processNext());
      }

      // Continue processing as slots become available
      while (queue.length > 0) {
        await Promise.race(loading);
        loading.push(processNext());
        loading.splice(0, 1); // Remove completed promise
      }

      // Wait for all remaining promises
      await Promise.all(loading);
    };

    loadImages();
  }, [imageUrls, concurrency]);

  return {
    loadedCount,
    totalCount,
    progress: totalCount > 0 ? (loadedCount / totalCount) * 100 : 0,
    errors,
    isComplete: loadedCount === totalCount
  };
};

/**
 * usePictureElement Hook
 * Support for responsive images using <picture> element
 *
 * Usage:
 * const sources = [
 *   { media: '(max-width: 768px)', srcSet: 'small.jpg' },
 *   { media: '(max-width: 1024px)', srcSet: 'medium.jpg' },
 *   { srcSet: 'large.jpg' }
 * ];
 * <PictureImage sources={sources} alt="..." />
 */
const PictureImage = ({ sources = [], alt = '', className = '', ...props }) => {
  const ref = useRef(null);
  const [src, setSrc] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && ref.current?.currentSrc) {
            setIsLoading(false);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return (
    <picture>
      {sources.map((source, idx) => (
        <source
          key={idx}
          media={source.media}
          srcSet={source.srcSet}
        />
      ))}
      <img
        ref={ref}
        src={sources[sources.length - 1]?.srcSet || ''}
        alt={alt}
        className={`picture-image ${isLoading ? 'loading' : 'loaded'} ${className}`}
        {...props}
      />
    </picture>
  );
};

/**
 * Styling for lazy images
 */
export const lazyImageStyles = `
.lazy-image {
  transition: opacity 0.3s ease;
}

.lazy-image.loading {
  opacity: 0.7;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

.lazy-image.loaded {
  opacity: 1;
}

.lazy-image.error {
  opacity: 0.5;
  filter: grayscale(100%);
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
`;

export { LazyImage, PictureImage };
export default LazyImage;
