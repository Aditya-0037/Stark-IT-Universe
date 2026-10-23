import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { sceneById } from '../lib/timeline';
import { Rich } from './Placeholder';

interface SceneProps {
  id: string;
  theme: 'dark' | 'light';
  /** Which section-index item this scene belongs to. */
  index: string;
  className?: string;
  children: ReactNode;
}

/**
 * One scene of the journey: a <section> labelled by its H2. Pinned scenes
 * carry their scroll budget from the scene table (FULL layout height).
 */
export const Scene = forwardRef<HTMLElement, SceneProps>(function Scene(
  { id, theme, index, className = '', children },
  ref,
) {
  const budget = sceneById(id)?.budget;
  return (
    <section
      ref={ref}
      id={id}
      data-theme={theme}
      data-index={index}
      data-budget={budget}
      style={budget ? ({ '--budget': budget } as CSSProperties) : undefined}
      aria-labelledby={`${id}-title`}
      className={`scene scene--${id} ${className}`}
    >
      {children}
    </section>
  );
});

interface TitleProps {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  className?: string;
}

/** Eyebrow + the scene's single H2 (focusable for in-page navigation). */
export function SceneTitle({ id, eyebrow, title, intro, className = '' }: TitleProps) {
  return (
    <div className={`scene-head ${className}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} tabIndex={-1} className="h2">
        <Rich text={title} />
      </h2>
      {intro && (
        <p className="lead">
          <Rich text={intro} />
        </p>
      )}
    </div>
  );
}
