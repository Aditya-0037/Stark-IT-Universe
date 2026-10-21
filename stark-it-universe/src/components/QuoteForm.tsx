import { m } from 'motion/react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { en } from '../content/en';
import { NOT_SURE, services } from '../content/services';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { quoteStore } from '../lib/quoteStore';
import { Icon } from './Icons';
import { Ph } from './Placeholder';

type Field = 'name' | 'school' | 'mobile' | 'city' | 'service' | 'email' | 'message';
type Values = Record<Field, string> & { whatsapp: boolean };
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: '', school: '', mobile: '', city: '', service: '', email: '', message: '', whatsapp: false };
const REQUIRED: Field[] = ['name', 'school', 'mobile', 'city', 'service'];
const ORDER: Field[] = ['name', 'school', 'mobile', 'city', 'service', 'email', 'message'];

/** Indian mobile: 10 digits starting 6-9, optional +91 / 91 / 0, spaces allowed. */
export function isValidMobile(raw: string) {
  const digits = raw.replace(/[\s\-().]/g, '');
  return /^(?:\+?91|0)?[6-9]\d{9}$/.test(digits);
}

function validate(v: Values): Errors {
  const e = en.quote.errors;
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = e.name;
  if (!v.school.trim()) errors.school = e.school;
  if (!isValidMobile(v.mobile)) errors.mobile = e.mobile;
  if (!v.city.trim()) errors.city = e.city;
  if (!v.service) errors.service = e.service;
  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errors.email = e.email;
  return errors;
}

/**
 * The quote form. Front-end only: on a valid submit it shows "Sending…"
 * inside the button, then a success state. Nothing is sent anywhere.
 * Errors appear as text next to each field (aria-describedby), typed values
 * are never cleared, and focus moves to the first field that needs fixing.
 */
export function QuoteForm() {
  const q = en.quote;
  const reduced = useReducedMotion();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [summary, setSummary] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const lastPrefill = useRef<string | null>(null);
  const prefill = quoteStore.useStore();

  // Apply requests from service cards, hotspots and the configurator.
  useEffect(() => {
    if (!prefill.stamp) return;
    setValues((v) => {
      const next = { ...v };
      if (prefill.service) next.service = prefill.service;
      if (prefill.message) {
        // Replace an earlier pre-fill, but never throw away the visitor's own words.
        const own = v.message.trim() && v.message !== lastPrefill.current;
        next.message = own ? `${v.message.trim()}\n\n${prefill.message}` : prefill.message;
        lastPrefill.current = next.message;
      }
      if (attempted) setErrors(validate(next));
      return next;
    });
    if (status === 'done') setStatus('idle');
    // Focus the first required field still empty, once the form is visible.
    window.setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const firstEmpty = REQUIRED.map((f) => form.elements.namedItem(f) as HTMLInputElement | null).find(
        (el) => el && !el.value.trim(),
      );
      (firstEmpty ?? (form.elements.namedItem('message') as HTMLElement | null))?.focus({ preventScroll: true });
    }, 50);
    // Runs only when a new pre-fill request arrives.
  }, [prefill.stamp]);

  useEffect(() => {
    if (status === 'done') successRef.current?.focus();
  }, [status]);

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setValues((v) => {
      const next = { ...v, [name]: val } as Values;
      if (attempted) setErrors(validate(next));
      return next;
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    const found = validate(values);
    setErrors(found);
    setAttempted(true);
    const bad = ORDER.filter((f) => found[f]);
    if (bad.length) {
      setSummary(q.errors.summary(bad.length));
      (formRef.current?.elements.namedItem(bad[0]) as HTMLElement | null)?.focus();
      return;
    }
    setSummary('');
    setStatus('sending');
    window.setTimeout(() => setStatus('done'), 1400);
  };

  if (status === 'done') {
    return (
      <div className="quote-success" role="status">
        <div className="quote-success__planets" aria-hidden="true">
          {services.map((s, i) => (
            <m.span
              key={s.id}
              className="quote-success__planet"
              style={{ background: s.color }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: (i - 2) * -40, y: [-60, 40, -80, 30, -50][i], scale: 0.4 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              transition={reduced ? { duration: 0.3 } : { type: 'spring', stiffness: 160, damping: 14, delay: i * 0.08 }}
            />
          ))}
        </div>
        <h3 ref={successRef} tabIndex={-1} className="quote-success__title">
          {q.successTitle}
        </h3>
        <p className="quote-success__text">{q.success}</p>
      </div>
    );
  }

  const describedBy = (f: Field, extra?: string) =>
    [extra, errors[f] ? `qf-${f}-error` : null].filter(Boolean).join(' ') || undefined;

  const field = (f: Field, label: string, control: ReactNode, opts: { required?: boolean; hint?: string } = {}) => (
    <div className={`qf-field ${errors[f] ? 'has-error' : ''}`}>
      <label htmlFor={`qf-${f}`} className="field-label">
        {label}
        {opts.required ? (
          <span className="qf-req" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="qf-opt"> {q.fields.optional}</span>
        )}
      </label>
      {opts.hint && (
        <p id={`qf-${f}-hint`} className="field-hint">
          {opts.hint}
        </p>
      )}
      {control}
      {errors[f] && (
        <p id={`qf-${f}-error`} className="qf-error">
          <Icon name="close" size={16} strokeWidth={2.4} />
          {errors[f]}
        </p>
      )}
    </div>
  );

  const input = (f: Field, props: InputHTMLAttributes<HTMLInputElement>, hintId?: string) => (
    <input
      id={`qf-${f}`}
      name={f}
      value={values[f]}
      onChange={onChange}
      aria-invalid={errors[f] ? true : undefined}
      aria-describedby={describedBy(f, hintId)}
      className="qf-input"
      {...props}
    />
  );

  return (
    <form ref={formRef} className="quote-form" noValidate onSubmit={onSubmit} aria-labelledby="quote-title">
      <p className="qf-required-note">{q.required}</p>
      <div className="qf-summary" aria-live="assertive">
        {summary && (
          <p>
            <Icon name="close" size={16} strokeWidth={2.4} />
            {summary}
          </p>
        )}
      </div>

      <div className="qf-grid">
        {field('name', q.fields.name, input('name', { type: 'text', autoComplete: 'name', required: true }), { required: true })}
        {field(
          'school',
          q.fields.school,
          input('school', { type: 'text', autoComplete: 'organization', required: true }),
          { required: true },
        )}
        {field(
          'mobile',
          q.fields.mobile,
          input('mobile', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', required: true }, 'qf-mobile-hint'),
          { required: true, hint: q.fields.mobileHint },
        )}
        {field(
          'city',
          q.fields.city,
          input('city', { type: 'text', autoComplete: 'address-level2', required: true }),
          { required: true },
        )}
        <div className="qf-span">
          {field(
            'service',
            q.fields.service,
            <select
              id="qf-service"
              name="service"
              value={values.service}
              onChange={onChange}
              required
              aria-invalid={errors.service ? true : undefined}
              aria-describedby={describedBy('service')}
              className="qf-input qf-select"
            >
              <option value="">{q.fields.serviceEmpty}</option>
              {services.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
              <option value={NOT_SURE}>{NOT_SURE}</option>
            </select>,
            { required: true },
          )}
        </div>
        <div className="qf-span">
          {field('email', q.fields.email, input('email', { type: 'email', autoComplete: 'email', inputMode: 'email' }))}
        </div>
        <div className="qf-span">
          {field(
            'message',
            q.fields.message,
            <textarea
              id="qf-message"
              name="message"
              rows={5}
              value={values.message}
              onChange={onChange}
              className="qf-input qf-textarea"
            />,
          )}
        </div>
      </div>

      <label className="qf-check">
        <input type="checkbox" name="whatsapp" checked={values.whatsapp} onChange={onChange} />
        <span className="qf-check__box" aria-hidden="true">
          <Icon name="check" size={16} strokeWidth={2.6} />
        </span>
        <span>{q.fields.whatsapp}</span>
      </label>

      <button type="submit" className="btn btn--primary btn--lg qf-submit" aria-disabled={status === 'sending' || undefined}>
        {status === 'sending' ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span className="btn__label">{q.sending}</span>
          </>
        ) : (
          <span className="btn__label">{q.submit}</span>
        )}
      </button>
      <p className="sr-only" aria-live="polite">
        {status === 'sending' ? q.sending : ''}
      </p>

      <p className="qf-privacy">
        {q.privacy} <Ph>{q.privacyLink}</Ph>
      </p>
    </form>
  );
}
