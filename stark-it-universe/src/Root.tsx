import { useEffect } from 'react';
import { App } from './App';
import { ContentApp } from './SiteApp';
import { findPage, normalizePath } from './content/pages';
import { metadata } from './lib/seo';

export function Root({ path }: { path: string }) {
  const normalized = normalizePath(path);
  useEffect(() => {
    // Dev uses the shared HTML shell; production already has these tags.
    const m = metadata(normalized);
    document.title = m.title;
    const meta = (selector: string, attributes: Record<string, string>) => {
      let el = document.head.querySelector(selector);
      if (!el) { el = document.createElement(selector.startsWith('link') ? 'link' : 'meta'); document.head.appendChild(el); }
      for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
    };
    meta('meta[name="description"]', { name: 'description', content: m.description });
    meta('meta[name="robots"]', { name: 'robots', content: m.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large' });
    meta('link[rel="canonical"]', { rel: 'canonical', href: m.url });
    let schema = document.getElementById('siu-schema');
    if (!schema) { schema = document.createElement('script'); schema.id = 'siu-schema'; schema.setAttribute('type', 'application/ld+json'); document.head.appendChild(schema); }
    schema.textContent = JSON.stringify(m.graph);
  }, [normalized]);
  return normalized === '/' ? <App /> : <ContentApp page={findPage(normalized)} />;
}
