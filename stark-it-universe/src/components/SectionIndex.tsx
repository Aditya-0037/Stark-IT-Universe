import { en } from '../content/en';
import { useScrollSpy } from '../hooks/useScrollSpy';

/**
 * Right-edge index (desktop only): Space · Planets · Route · Classroom ·
 * Build · Proof · Contact. Every item is a link; the current one is marked
 * with aria-current and its name shows below the dots.
 */
export function SectionIndex() {
  const { current } = useScrollSpy();
  const items = en.index;
  const now = items.find((i) => i.id === current) ?? items[0];

  return (
    <nav aria-label={en.a11y.sectionIndex} className="section-index">
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={item.id === current ? 'location' : undefined}
              className="section-index__link"
            >
              <span className="section-index__dot" aria-hidden="true" />
              <span className="section-index__label">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
      <p className="section-index__now" aria-hidden="true">
        {now.label}
      </p>
    </nav>
  );
}
