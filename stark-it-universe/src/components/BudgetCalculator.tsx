import { useState } from 'react';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

/** Uses buyer-supplied quotes; never presents invented SIU prices. */
export function BudgetCalculator() {
  const [values, setValues] = useState({ rooms: '1', equipment: '', installation: '', amc: '', tax: '' });
  const number = (key: keyof typeof values) => Math.max(0, Number(values[key]) || 0);
  const valid = Object.values(values).every((v) => v === '' || Number.isFinite(Number(v)) && Number(v) >= 0) && number('rooms') >= 1 && Number.isInteger(number('rooms')) && number('tax') <= 100;
  const subtotal = number('rooms') * (number('equipment') + number('installation') + number('amc'));
  const ready = values.equipment !== '' && valid;
  const rows = [
    ['rooms', 'Classrooms', '1'], ['equipment', 'Equipment per classroom (INR, before tax)', '0'],
    ['installation', 'Installation per classroom (INR, before tax)', '0'], ['amc', 'Annual AMC per classroom (INR, before tax)', '0'], ['tax', 'Tax rate from your quote (%)', '0'],
  ] as const;
  return <div className="budget-tool">
    <div className="budget-tool__fields">
      {rows.map(([key, label, min]) => <label key={key} htmlFor={`budget-${key}`}>{label}<input id={`budget-${key}`} name={key} type="number" min={min} max={key === 'tax' ? 100 : undefined} step={key === 'rooms' ? 1 : '0.01'} inputMode="decimal" value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} placeholder={key === 'rooms' ? undefined : 'Enter quoted rate'} /></label>)}
    </div>
    <div className="budget-tool__result" role="status" aria-live="polite">
      <h3>First-year planning total</h3>
      {!valid ? <p>Use positive, finite rates, a whole number of classrooms, and a tax rate from 0 to 100%.</p> : ready ? <><p>Before tax: <strong>{money(subtotal)}</strong></p><p>{values.tax ? `With ${number('tax')}% tax` : 'Total (tax not entered)'}: <strong>{money(subtotal * (1 + number('tax') / 100))}</strong></p></> : <p>Enter an equipment rate to calculate your total.</p>}
      <p className="field-hint">Planning only. Uses your rates; excludes unentered site costs and software. This is not an SIU quotation.</p>
    </div>
  </div>;
}
