import { contact } from '../content/contact';
import { en } from '../content/en';
import { services } from '../content/services';
import { servicePaths, whatsappLink } from '../content/business';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  const f = en.footer;
  return (
    <footer className="site-footer" data-theme="dark">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <BrandLogo on="dark" />
          <p>{f.tagline}</p>
        </div>
        <nav aria-labelledby="footer-services">
          <h2 id="footer-services" className="site-footer__title">
            {f.services}
          </h2>
          <ul>
            {services.map((s) => (
              <li key={s.id}>
                <a href={servicePaths[s.id]}>{s.name}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="site-footer__title">{f.contact}</h2>
          <ul>
            <li>
              <a href={contact.phoneHref}>{contact.phoneDisplay}</a>
            </li>
            <li>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
                WhatsApp<span className="sr-only"> {en.a11y.newTab}</span>
              </a>
            </li>
            <li>
              <a href={contact.emailHref}>{contact.email}</a>
            </li>
            <li>
              <a href={contact.mapsHref} target="_blank" rel="noopener noreferrer">
                {contact.addressLines.join(', ')}
                <span className="sr-only"> {en.a11y.newTab}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <nav className="container site-footer__extra" aria-label="More about SIU">
        <a href="/amc/">AMC & support</a><a href="/about-us/">About SIU</a><a href="/guides/">Buying guides</a><a href="/locations/">Service areas</a><a href="/solutions/cbse-schools/">Private schools</a><a href="/solutions/government-school-ict/">Government & ICT</a><a href="/solutions/csr-smart-classrooms/">CSR projects</a><a href="/contact-us/">Contact & site visit</a>
      </nav>
      <div className="container site-footer__base">
        <div className="site-footer__base-row">
          <p>{f.copyright}</p>
          <p className="site-footer__legal">
            <a href="/privacy/">Privacy</a>
            <a href="/terms/">Terms</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
