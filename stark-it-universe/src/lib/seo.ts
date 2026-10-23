import { business, guidePrepared } from '../content/business';
import { findPage, sitePages } from '../content/pages';

export const pagePaths = ['/', ...sitePages.map((p) => p.path)];
const home = {
  title: 'Smart Class Setup & AMC | Ghaziabad, Delhi NCR | Stark IT Universe',
  description: 'Smart classroom installation, digital board repair, projector rental, computer AMC and CAT-6 networking for schools. Contact SIU in Ghaziabad, Delhi NCR.',
};

export function metadata(path: string) {
  const page = findPage(path);
  const known = path === '/' || !!page;
  const title = path === '/' ? home.title : page ? page.title : 'Page not found | Stark IT Universe';
  const description = path === '/' ? home.description : page?.description || 'Find school technology services and contact Stark IT Universe.';
  const url = `${business.origin}${path}`;
  const companyId = `${business.origin}/#business`;
  const websiteId = `${business.origin}/#website`;
  const pageId = `${url}#webpage`;
  const noindex = !business.indexable || !known || !!page?.noindex;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'LocalBusiness', '@id': companyId,
      name: business.name, alternateName: business.shortName,
      description: business.description, url: `${business.origin}/`,
      telephone: business.telephone, email: business.email,
      address: business.address, areaServed: business.areas,
      ...(business.officialProfiles.length ? { sameAs: business.officialProfiles } : {}),
    },
    { '@type': 'WebSite', '@id': websiteId, name: business.name, url: `${business.origin}/`, publisher: { '@id': companyId } },
    { '@type': 'WebPage', '@id': pageId, url, name: title, description, isPartOf: { '@id': websiteId }, about: { '@id': companyId }, inLanguage: 'en-IN' },
  ];
  if (page) {
    const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${business.origin}/` }];
    if (page.path.startsWith('/guides/') && page.path !== '/guides/') crumbs.push({ '@type': 'ListItem', position: 2, name: 'Guides', item: `${business.origin}/guides/` });
    else if (page.path.startsWith('/locations/') && page.path !== '/locations/') crumbs.push({ '@type': 'ListItem', position: 2, name: 'Service areas', item: `${business.origin}/locations/` });
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: page.label, item: url });
    graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumbs`, itemListElement: crumbs });
    if (page.kind === 'service') graph.push({ '@type': 'Service', '@id': `${url}#service`, name: page.title, description, url, provider: { '@id': companyId }, areaServed: business.areas, mainEntityOfPage: { '@id': pageId } });
    if (page.kind === 'guide') graph.push({ '@type': 'Article', '@id': `${url}#article`, headline: page.title, description, author: { '@id': companyId }, publisher: { '@id': companyId }, mainEntityOfPage: { '@id': pageId }, dateCreated: guidePrepared, dateModified: guidePrepared, inLanguage: 'en-IN' });
  }
  return { title, description, url, noindex, graph: { '@context': 'https://schema.org', '@graph': graph } };
}

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function renderHead(path: string) {
  const m = metadata(path);
  return `<title>${escapeHtml(m.title)}</title>
    <meta name="description" content="${escapeHtml(m.description)}" />
    <meta name="robots" content="${m.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}" />
    <link rel="canonical" href="${escapeHtml(m.url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:site_name" content="Stark IT Universe" />
    <meta property="og:title" content="${escapeHtml(m.title)}" />
    <meta property="og:description" content="${escapeHtml(m.description)}" />
    <meta property="og:url" content="${escapeHtml(m.url)}" />
    <meta name="twitter:card" content="summary" />
    <script id="siu-schema" type="application/ld+json">${JSON.stringify(m.graph).replace(/</g, '\\u003c')}</script>`;
}
