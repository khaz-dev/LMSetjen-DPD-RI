import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = 'LMSetjen DPD RI - Learning Management System',
  description = 'Sistem Learning Management Setjen DPD RI - Platform pembelajaran online untuk pegawai DPD RI. Akses kursus, materi pembelajaran, dan sertifikasi profesional.',
  keywords = 'learning management, LMS, DPD RI, Setjen, e-learning, pelatihan online, sertifikasi',
  author = 'Setjen DPD RI',
  image = '/logo/logo-512.png',
  url = window.location.href,
  type = 'website'
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="Indonesian" />
      <meta name="revisit-after" content="7 days" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="LMSetjen DPD RI" />
      <meta property="og:locale" content="id_ID" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />

      {/* Canonical URL */}
      <link rel="canonical" href={url} />
    </Helmet>
  );
};

export default SEO;
