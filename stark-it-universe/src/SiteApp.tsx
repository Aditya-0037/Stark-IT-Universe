import { useEffect } from 'react';
import { BrandLogo } from './components/BrandLogo';
import { Footer } from './components/Footer';
import { QuoteForm } from './components/QuoteForm';
import { BudgetCalculator } from './components/BudgetCalculator';
import { business, guidePrepared, whatsappLink } from './content/business';
import { contact } from './content/contact';
import { findPage, type SitePage } from './content/pages';
import { watchContactEvents } from './lib/analytics';

function PageLinks({ paths }: { paths: string[] }) {
  return <div className="content-links">{paths.map((path) => {
    const page = findPage(path);
    return page ? <a key={path} href={path}><span>{page.label}</span><span aria-hidden="true">↗</span></a> : null;
  })}</div>;
}

export function ContentApp({ page }: { page?: SitePage }) {
  useEffect(() => watchContactEvents(), []);
  const isContact = page?.path === '/contact-us/';
  const quoteHref = `/contact-us/?service=${encodeURIComponent(page?.kind === 'service' ? page.label : '')}#quote-form`;
  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <header className="content-header" data-theme="dark">
      <div className="container content-header__inner">
        <a href="/" aria-label="Stark IT Universe home"><BrandLogo on="dark" /></a>
        <nav aria-label="Main"><a href="/services/">Services</a><a href="/amc/">AMC</a><a href="/guides/">Guides</a><a href="/locations/">Areas</a><a href="/contact-us/">Contact</a></nav>
        <a className="btn btn--primary btn--md" href={contact.phoneHref}>Call SIU</a>
      </div>
    </header>
    <main id="main" className="content-main" tabIndex={-1}>
      <div className="content-hero" data-theme="dark">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li>{page?.kind === 'guide' && <li><a href="/guides/">Guides</a></li>}{page?.path === '/locations/ghaziabad/' && <li><a href="/locations/">Service areas</a></li>}<li aria-current="page">{page?.label || 'Page not found'}</li></ol></nav>
          <p className="eyebrow">Stark IT Universe · Ghaziabad</p>
          <h1>{page?.title || 'This page could not be found'}</h1>
          <p className="content-hero__intro">{page?.intro || 'Explore our school technology services or contact the team to discuss your requirements.'}</p>
          {page?.kind === 'guide' && <p className="content-byline">By {business.name} · Prepared <time dateTime={guidePrepared}>23 October 2026</time></p>}
          <div className="content-actions"><a className="btn btn--primary btn--lg" href={isContact ? '#quote-form' : quoteHref}>{isContact ? 'Prepare an enquiry' : 'Request an itemised quote'}</a><a className="btn btn--secondary btn--lg" href={whatsappLink(`Hello SIU, I would like to discuss ${page?.label || 'school technology'}.`)} target="_blank" rel="noopener noreferrer">WhatsApp SIU</a></div>
        </div>
      </div>
      <div className="content-body" data-theme="light">
        <div className="container content-layout">
          <article className="content-article">
            {page?.sections.map((s) => <section key={s.id} id={s.id} className="content-section">
              <h2>{s.title}</h2><p>{s.text}</p>
              {s.bullets && <ul>{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
              {s.table && <div className="content-table" role="region" aria-label={s.table.caption} tabIndex={0}><table><caption>{s.table.caption}</caption><thead><tr>{s.table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{s.table.rows.map((r) => <tr key={r[0]}>{r.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>}
              {page.path === '/guides/smart-class-cost/' && s.id === 'calculator' && <BudgetCalculator />}
              {page.path === '/amc/' && s.id === 'download' && <div className="content-actions"><a href="/downloads/siu-amc-scope-sample.pdf" className="btn btn--primary btn--md" data-event="amc_download" download>Download sample AMC scope (PDF)</a><a href="/downloads/siu-amc-scope-sample.txt" download>Editable text version</a></div>}
            </section>)}
            {page?.faq && <section className="content-section" id="faq"><h2>Questions schools ask</h2>{page.faq.map((f) => <details className="content-faq" key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>}
            {isContact && <section className="content-section" id="quote-form"><h2 id="quote-title">Prepare your school enquiry</h2><p>Review the draft in WhatsApp, then send it to SIU. To request a site visit, include the campus address and two preferred dates.</p><QuoteForm /></section>}
            {page && <section className="content-section" id="related"><h2>{page.kind === 'hub' ? 'Explore the pages' : 'Related services and guides'}</h2><PageLinks paths={page.related} /></section>}
            {!page && <PageLinks paths={['/services/', '/contact-us/']} />}
          </article>
          <aside className="content-aside" aria-label="Page navigation and contact">
            <div className="content-aside__card"><p className="eyebrow">On this page</p><ul>{page?.sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}{isContact && <li><a href="#quote-form">Enquiry form</a></li>}</ul></div>
            <div className="content-aside__card"><h2>Talk to the Ghaziabad team</h2><p>{contact.addressLines.join(', ')}</p><a href={contact.phoneHref}>{contact.phoneDisplay}</a><a href={contact.emailHref}>{contact.email}</a><a href={contact.mapsHref} target="_blank" rel="noopener noreferrer">View address on Google Maps</a><a href="/contact-us/?request=visit#quote-form" data-event="site_visit">Request a site visit</a></div>
          </aside>
        </div>
      </div>
    </main>
    <Footer />
  </>;
}
