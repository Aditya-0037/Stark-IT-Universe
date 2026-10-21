import { contact } from '../content/contact';
import { en } from '../content/en';
import { Ui } from '../lib/i18n';
import { Icon } from './Icons';

/** Phone-only bottom bar: Call | WhatsApp | Get Quote (48 px + safe area). */
export function MobileBar() {
  return (
    <nav aria-label={en.a11y.quickContact} className="mobile-bar">
      <a href={contact.phoneHref} className="mobile-bar__item">
        <Icon name="phone" size={20} />
        <span>{en.mobileBar.call}</span>
      </a>
      <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer" className="mobile-bar__item">
        <Icon name="chat" size={20} />
        <span>{en.mobileBar.whatsapp}</span>
        <span className="sr-only"> {en.a11y.newTab}</span>
      </a>
      <a href="#quote" className="mobile-bar__item mobile-bar__item--primary">
        <span>
          <Ui k="mobileQuote" />
        </span>
      </a>
    </nav>
  );
}
