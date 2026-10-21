import { useId } from 'react';
import { en } from '../content/en';
import { setLiteMode, useDeviceTier } from '../hooks/useDeviceTier';

/**
 * The header's Lite mode switch. Overrides the automatic device tier and is
 * remembered in localStorage.
 */
export function LiteToggle({ className = '' }: { className?: string }) {
  const { tier } = useDeviceTier();
  const hintId = useId();
  const on = tier === 'lite';
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={hintId}
        onClick={() => setLiteMode(!on)}
        className={`lite-switch ${className}`}
      >
        <span className="lite-switch__label">{en.header.lite}</span>
        <span className="lite-switch__track" aria-hidden="true">
          <span className="lite-switch__thumb" />
        </span>
      </button>
      <span id={hintId} hidden>
        {en.header.liteHint}
      </span>
    </>
  );
}
