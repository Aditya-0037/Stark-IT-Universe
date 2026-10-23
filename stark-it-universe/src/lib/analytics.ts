/** Hooks into a host-configured GTM/GA data layer; no tracker is loaded here. */
export function track(event: string, details: Record<string, string | number> = {}) {
  if (typeof window === 'undefined') return;
  const payload = { event, ...details };
  const host = window as Window & { dataLayer?: Record<string, unknown>[] };
  host.dataLayer?.push(payload);
  window.dispatchEvent(new CustomEvent('siu:analytics', { detail: payload }));
}

export function watchContactEvents() {
  const onClick = (event: MouseEvent) => {
    const a = (event.target as Element)?.closest?.('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('tel:')) track('contact_call', { page: location.pathname });
    else if (href.startsWith('https://wa.me/')) track('contact_whatsapp', { page: location.pathname });
    else if (a.dataset.event === 'site_visit') track('site_visit_request', { page: location.pathname });
    else if (a.dataset.event === 'amc_download') track('amc_sample_download', { page: location.pathname });
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
