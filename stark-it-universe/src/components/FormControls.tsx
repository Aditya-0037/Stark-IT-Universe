import { useEffect, useId, useState } from 'react';
import { Icon } from './Icons';

interface StepperProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

/** Number stepper: − / + buttons (44 px) around a typed number field. */
export function Stepper({ label, hint, value, min, max, onChange, decreaseLabel, increaseLabel }: StepperProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    const next = Number.isFinite(n) ? clamp(n) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="stepper">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      <div className="stepper__row">
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label={decreaseLabel}
        >
          <Icon name="minus" size={20} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={(e) => commit(e.target.value)}
          className="stepper__input"
        />
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label={increaseLabel}
        >
          <Icon name="plus" size={20} />
        </button>
        <span className="stepper__range" aria-hidden="true">
          {min}–{max}
        </span>
      </div>
    </div>
  );
}

interface YesNoProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  yes: string;
  no: string;
}

/** A yes/no switch built on a real checkbox (role="switch"). */
export function YesNoSwitch({ label, checked, onChange, yes, no }: YesNoProps) {
  return (
    <label className="yesno">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="yesno__label">{label}</span>
      <span className="yesno__ui" aria-hidden="true">
        <span className="yesno__state">{checked ? yes : no}</span>
        <span className="yesno__track">
          <span className="yesno__thumb" />
        </span>
      </span>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string; long?: string }[];
  onChange: (v: T) => void;
}

/** Radio group styled as a segmented control. */
export function Segmented<T extends string>({ legend, name, value, options, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className="segmented">
      <legend className="field-label">{legend}</legend>
      <div className="segmented__row">
        {options.map((o) => (
          <label key={o.value} className="segmented__opt">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span title={o.long}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
