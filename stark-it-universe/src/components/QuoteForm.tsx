import { useEffect, useRef, useState, type FormEvent } from 'react';
import { en } from '../content/en';
import { NOT_SURE, services } from '../content/services';
import { whatsappLink } from '../content/business';
import { contact } from '../content/contact';
import { quoteStore } from '../lib/quoteStore';
import { track } from '../lib/analytics';

type Field = 'name' | 'school' | 'mobile' | 'city' | 'service' | 'email' | 'message' | 'source';
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;
const EMPTY: Values = { name: '', school: '', mobile: '', city: '', service: '', email: '', message: '', source: '' };
const REQUIRED = ['name', 'school', 'mobile', 'city', 'service'] as const;
const OPTIONS = [...services.map((s) => s.name), 'Digital board repair', 'AMC & support', NOT_SURE];

export function isValidMobile(raw: string) {
  return /^(?:\+?91|0)?[6-9]\d{9}$/.test(raw.replace(/[\s\-().]/g, ''));
}
function validate(v: Values): Errors {
  const errors: Errors = {};
  for (const f of REQUIRED) if (!v[f].trim()) errors[f] = en.quote.errors[f];
  if (v.mobile && !isValidMobile(v.mobile)) errors.mobile = en.quote.errors.mobile;
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = en.quote.errors.email;
  return errors;
}

/** Prepares a local draft. Only the visitor can send it from WhatsApp. */
export function QuoteForm() {
  const q = en.quote;
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const lastPrefill = useRef<string | null>(null);
  const prefill = quoteStore.useStore();

  useEffect(() => {
    setReady(true);
    const params = new URLSearchParams(location.search);
    const requested = params.get('service');
    const service = OPTIONS.find((s) => s.toLowerCase() === requested?.toLowerCase()) || '';
    const message = params.get('request') === 'visit' ? 'Please arrange a site visit. Campus address: \nPreferred dates: ' : '';
    setValues((v) => ({ ...v, service: service || v.service, message: message || v.message }));
  }, []);

  useEffect(() => {
    if (!prefill.stamp) return;
    setValues((v) => {
      const own = v.message.trim() && v.message !== lastPrefill.current;
      const message = prefill.message ? own ? `${v.message.trim()}\n\n${prefill.message}` : prefill.message : v.message;
      lastPrefill.current = message;
      return { ...v, service: prefill.service || v.service, message };
    });
    setDraft('');
    const timer = window.setTimeout(() => {
      const first = REQUIRED.map((f) => form.current?.elements.namedItem(f) as HTMLInputElement | null).find((el) => el && !el.value.trim());
      first?.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [prefill.stamp]);

  const change = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    setDraft('');
    if (attempted) setErrors(validate(next));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    setAttempted(true);
    const first = (Object.keys(found) as Field[])[0];
    if (first) { (form.current?.elements.namedItem(first) as HTMLElement)?.focus(); return; }
    const message = ['School enquiry for Stark IT Universe', `Name: ${values.name.trim()}`, `School: ${values.school.trim()}`, `Mobile: ${values.mobile.trim()}`, `City: ${values.city.trim()}`, `Service: ${values.service}`, values.email && `Email: ${values.email.trim()}`, values.source && `Heard about SIU: ${values.source}`, values.message && `Requirement: ${values.message.trim()}`].filter(Boolean).join('\n');
    setDraft(message);
    track('quote_draft_prepared', { service: values.service, source: values.source || 'not specified' });
    window.setTimeout(() => result.current?.focus(), 0);
  };
  const label = (field: Field, text: string, required = false) => <label className="field-label" htmlFor={`qf-${field}`}>{text}{required ? <span className="qf-req" aria-hidden="true">*</span> : <span className="qf-opt"> (optional)</span>}</label>;
  const error = (field: Field) => errors[field] ? <p className="qf-error" id={`qf-${field}-error`}>{errors[field]}</p> : null;
  const fields = [['name', q.fields.name, 'text', 'name'], ['school', q.fields.school, 'text', 'organization'], ['mobile', q.fields.mobile, 'tel', 'tel'], ['city', q.fields.city, 'text', 'address-level2']] as const;
  return <form ref={form} className="quote-form" noValidate onSubmit={submit} aria-labelledby="quote-title">
    <p className="qf-required-note">{q.required} This form prepares a WhatsApp draft; you review and send it.</p>
    <div className="qf-summary" aria-live="assertive">{Object.keys(errors).length > 0 && <p>{q.errors.summary(Object.keys(errors).length)}</p>}</div>
    <div className="qf-grid">
      {fields.map(([key, text, type, autoComplete]) => <div className={`qf-field ${errors[key] ? 'has-error' : ''}`} key={key}>{label(key, text, true)}{key === 'mobile' && <p className="field-hint" id="qf-mobile-hint">{q.fields.mobileHint}</p>}<input id={`qf-${key}`} name={key} type={type} autoComplete={autoComplete} required maxLength={key === 'mobile' ? 25 : 160} value={values[key]} onChange={(e) => change(key, e.target.value)} className="qf-input" aria-invalid={!!errors[key] || undefined} aria-describedby={[key === 'mobile' ? 'qf-mobile-hint' : '', errors[key] ? `qf-${key}-error` : ''].filter(Boolean).join(' ') || undefined} />{error(key)}</div>)}
      <div className="qf-field qf-span">{label('service', q.fields.service, true)}<select className="qf-input qf-select" id="qf-service" name="service" required value={values.service} onChange={(e) => change('service', e.target.value)} aria-invalid={!!errors.service || undefined} aria-describedby={errors.service ? 'qf-service-error' : undefined}><option value="">{q.fields.serviceEmpty}</option>{OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>{error('service')}</div>
      <div className="qf-field qf-span">{label('email', q.fields.email)}<input className="qf-input" id="qf-email" name="email" type="email" autoComplete="email" maxLength={254} value={values.email} onChange={(e) => change('email', e.target.value)} aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'qf-email-error' : undefined} />{error('email')}</div>
      <div className="qf-field qf-span">{label('source', 'How did you hear about us?')}<select id="qf-source" name="source" value={values.source} onChange={(e) => change('source', e.target.value)} className="qf-input qf-select"><option value="">Choose if you would like</option>{['Google Search', 'Google Maps', 'ChatGPT', 'Google AI / Gemini', 'Other AI assistant', 'WhatsApp', 'School referral', 'Other'].map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="qf-field qf-span">{label('message', q.fields.message)}<textarea id="qf-message" name="message" rows={5} maxLength={2500} value={values.message} onChange={(e) => change('message', e.target.value)} className="qf-input qf-textarea" /></div>
    </div>
    <button type="submit" disabled={!ready} className="btn btn--primary btn--lg qf-submit"><span className="btn__label">Prepare WhatsApp enquiry</span></button>
    {draft && <div ref={result} className="qf-handoff" tabIndex={-1} role="status"><strong>Your draft is ready.</strong><p>SIU receives it after you send it in WhatsApp.</p><a className="btn btn--primary btn--md" href={whatsappLink(draft)} target="_blank" rel="noopener noreferrer">Open draft in WhatsApp</a><p>Prefer email? <a href={`${contact.emailHref}?subject=${encodeURIComponent('School enquiry for SIU')}&body=${encodeURIComponent(draft)}`}>Open an email draft</a></p></div>}
    <p className="qf-privacy">Details stay in this browser until you choose to open a draft. <a href="/privacy/">Privacy notice</a></p>
    <noscript><p>To request a quote, <a href={contact.phoneHref}>call {contact.phoneDisplay}</a> or <a href={contact.emailHref}>email SIU</a>.</p></noscript>
  </form>;
}
