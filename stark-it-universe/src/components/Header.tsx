import { useEffect, useRef, useState } from 'react';
import { en, type UiKey } from '../content/en';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Ui, useUi } from '../lib/i18n';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';
import { Icon } from './Icons';
import { LangToggle } from './LangToggle';
import { LiteToggle } from './LiteToggle';

const LINKS: { href: string; k: UiKey }[] = [
  { href: '/services/', k: 'navServices' },
  { href: '#route', k: 'navHow' },
  { href: '/amc/', k: 'navProjects' },
  { href: '#build', k: 'navBuild' },
  { href: '#faq', k: 'navFaq' },
];

/**
 * Sticky glass pill header. Its colours (and logo version) follow the
 * section behind it. Under Reduce Transparency or More Contrast it becomes
 * solid deep-space.
 */
export function Header() {
  const ui = useUi();
  const quote = ui('quoteCta');
  const { headerTheme } = useScrollSpy();
  const solid = useMediaQuery('(prefers-reduced-transparency: reduce), (prefers-contrast: more)');
  const theme = solid ? 'dark' : headerTheme;

  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !toggleRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const navList = (onNavigate?: () => void) => (
    <ul className="site-nav__list">
      {LINKS.map((l) => (
        <li key={l.href}>
          <a href={l.href} className="site-nav__link" onClick={onNavigate}>
            <Ui k={l.k} />
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <header className="site-header" data-theme={theme} data-solid={solid || undefined}>
      <div className="site-header__pill">
        <a href="#space" className="site-header__logo">
          <BrandLogo on="dark" className="logo-on-dark" />
          <BrandLogo on="light" className="logo-on-light" />
          <span className="sr-only">{en.a11y.home}</span>
        </a>

        <nav aria-label={en.a11y.mainNav} className="site-nav hidden nav:block">
          {navList()}
        </nav>

        <div className="site-header__tools hidden nav:flex">
          <LangToggle />
          <LiteToggle />
        </div>

        <Button href="#quote" className="site-header__cta" lang={quote.lang}>
          {quote.text}
        </Button>

        <button
          ref={toggleRef}
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? 'close' : 'menu'} />
          <span className="menu-toggle__label">{open ? en.header.menuClose : en.header.menuOpen}</span>
        </button>
      </div>

      <div id="site-menu" ref={menuRef} className="site-menu nav:hidden" hidden={!open}>
        <nav aria-label={en.a11y.mainNav}>{navList(() => setOpen(false))}</nav>
        <div className="site-menu__tools">
          <LangToggle />
          <LiteToggle />
        </div>
      </div>
    </header>
  );
}
