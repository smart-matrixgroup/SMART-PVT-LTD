import { useEffect } from 'react';
import { defaultSEO } from '../config/seo';

const SITE_URL = 'https://smartpvtltd.com';

function setMetaByName(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setMetaByProperty(property, content) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(href) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export default function SEO({ title, description, image, noIndex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | SMART Pvt Ltd` : defaultSEO.title;
    const desc = description || defaultSEO.description;
    const canonicalUrl = `${SITE_URL}${window.location.pathname}`;
    const ogImage = image
      ? (image.startsWith('http') ? image : `${SITE_URL}${image}`)
      : `${SITE_URL}${defaultSEO.openGraph.images[0].url}`;

    document.title = fullTitle;

    setMetaByName('description', desc);
    setMetaByName('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    setMetaByProperty('og:title', fullTitle);
    setMetaByProperty('og:description', desc);
    setMetaByProperty('og:url', canonicalUrl);
    setMetaByProperty('og:image', ogImage);
    setMetaByProperty('og:type', 'website');
    setMetaByProperty('og:site_name', defaultSEO.openGraph.siteName);

    setMetaByName('twitter:card', 'summary_large_image');
    setMetaByName('twitter:title', fullTitle);
    setMetaByName('twitter:description', desc);
    setMetaByName('twitter:image', ogImage);

    setCanonical(canonicalUrl);

    window.scrollTo(0, 0);
  }, [title, description, image, noIndex]);

  return null;
}
