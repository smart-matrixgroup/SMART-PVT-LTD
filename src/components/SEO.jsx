import { useEffect } from 'react';

export default function SEO({ title, description }) {
  useEffect(() => {
    document.title = title ? `${title} | SMART Pvt Ltd` : "SMART Pvt Ltd | Intelligent Solutions. Smarter Future.";
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', description);
      }
    }
    window.scrollTo(0, 0);
  }, [title, description]);

  return null;
}

