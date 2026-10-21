import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type UiKey } from '../content/en';
import { hi } from '../content/hi';

export type Lang = 'en' | 'hi';

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangValue>({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

export interface UiText {
  text: string;
  /** 'hi' when the Hindi version is shown, so callers can set lang="hi". */
  lang: 'hi' | undefined;
}

/** Returns a lookup for the translatable `ui` strings. */
export function useUi() {
  const { lang } = useLang();
  return (key: UiKey): UiText => {
    const h = lang === 'hi' ? hi[key] : undefined;
    return h ? { text: h, lang: 'hi' } : { text: en.ui[key], lang: undefined };
  };
}

/** Inline translatable text. Wraps Hindi in <span lang="hi">. */
export function Ui({ k }: { k: UiKey }) {
  const t = useUi()(k);
  return t.lang ? <span lang="hi">{t.text}</span> : <>{t.text}</>;
}
