import { contact } from '../content/contact';
import { en } from '../content/en';
import { Icon, type IconName } from '../components/Icons';
import { QuoteForm } from '../components/QuoteForm';
import { Scene, SceneTitle } from '../components/Scene';

/**
 * Scene 9: the quote form and direct contact details (real links).
 */
export function Quote() {
  const q = en.quote;
  const links: { icon: IconName; label: string; value: string; href: string; external?: boolean }[] = [
    { icon: 'phone', label: q.call, value: contact.phoneDisplay, href: contact.phoneHref },
    { icon: 'chat', label: q.whatsapp, value: contact.phoneDisplay, href: contact.whatsappHref, external: true },
    { icon: 'mail', label: q.emailLabel, value: contact.email, href: contact.emailHref },
    { icon: 'pin', label: q.visit, value: contact.addressLines.join(', '), href: contact.mapsHref, external: true },
  ];

  return (
    <Scene id="quote" theme="light" index="quote">
      <div className="container quote">
        <div className="quote__main">
          <SceneTitle id="quote" eyebrow={q.eyebrow} title={q.title} intro={q.intro} />
          <div className="quote__card card-light">
            <QuoteForm />
          </div>
        </div>

        <aside className="quote__contact on-dark" aria-labelledby="quote-direct">
          <h3 id="quote-direct" className="quote__contact-title">
            {q.direct}
          </h3>
          <ul className="contact-list">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="contact-link"
                  {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <span className="contact-link__icon">
                    <Icon name={l.icon} size={22} />
                  </span>
                  <span className="contact-link__text">
                    <span className="contact-link__label">{l.label}</span>
                    <span className="contact-link__value">{l.value}</span>
                  </span>
                  {l.external && <span className="sr-only"> {en.a11y.newTab}</span>}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Scene>
  );
}
