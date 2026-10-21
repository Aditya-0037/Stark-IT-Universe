import { Fragment, type ReactNode } from 'react';

/** A visible placeholder for a fact the team still has to confirm. */
export function Ph({ children }: { children: ReactNode }) {
  return <span className="ph">{children}</span>;
}

const TOKEN = /(\*[^*]+\*|\[[^\]]+\])/g;

/**
 * Renders copy with the two conventions from content/en.ts:
 *   *word*  -> heavy weight
 *   [text]  -> placeholder chip
 */
export function Rich({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>;
        if (part.startsWith('[') && part.endsWith(']')) return <Ph key={i}>{part}</Ph>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
