import { createStore } from './createStore';
import { scrollToId } from './scroll';

/**
 * Lets other scenes pre-fill the quote form (a service card's
 * "Get a quote for this", a classroom hotspot, the configurator summary).
 * `stamp` changes on every request so the form re-applies it; the form then
 * moves focus to its first empty required field.
 */
interface QuotePrefill {
  service: string | null;
  message: string | null;
  stamp: number;
}

export const quoteStore = createStore<QuotePrefill>({ service: null, message: null, stamp: 0 });

export function goToQuote(p: { service?: string; message?: string } = {}) {
  quoteStore.set((s) => ({ service: p.service ?? null, message: p.message ?? null, stamp: s.stamp + 1 }));
  scrollToId('quote', false);
}
