import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  canonical?: string;
}

export default function SEOHead({ title, description, image, url, canonical }: SEOHeadProps) {
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://usenera.com');
  const defaultImage = 'https://usenera.com/og-default.png';
  const ogImage = image || defaultImage;

  const canonicalUrl = canonical || url || currentUrl;

  useEffect(() => {
    const cleanup = () => {
      // Find all canonical links
      const canonicals = document.querySelectorAll('link[rel="canonical"]');
      canonicals.forEach((el) => {
        if (!el.hasAttribute('data-rh') && !el.hasAttribute('data-react-helmet')) {
          el.remove();
        }
      });

      // Find all meta descriptions
      const descriptions = document.querySelectorAll('meta[name="description"]');
      descriptions.forEach((el) => {
        if (!el.hasAttribute('data-rh') && !el.hasAttribute('data-react-helmet')) {
          el.remove();
        }
      });
    };

    // Run immediately on mount or dependency changes
    cleanup();

    // Run on a short timeout to ensure robustness against race conditions during React rendering
    const timer = setTimeout(cleanup, 0);
    return () => clearTimeout(timer);
  }, [title, description, canonicalUrl]);

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Nera" />
      <meta property="og:locale" content="pt_BR" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={currentUrl} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />
    </Helmet>
  );
}
