import { en } from '../content/en';
import { useLang } from '../lib/i18n';

/** EN / हिंदी switch. Hindi covers the header links, hero and quote buttons. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label={en.header.language} className={`seg-toggle ${className}`}>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">
        EN
      </button>
      <button type="button" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')} lang="hi">
        हिंदी
      </button>
    </div>
  );
}
