import { useEffect, useRef } from 'react';
import { en } from '../content/en';
import { Scene, SceneTitle } from '../components/Scene';
import { useFullLayout } from '../hooks/useFullLayout';
import { stickyScrollY } from '../hooks/useStickyProgress';
import { registerAnchorResolver } from '../lib/scroll';

/**
 * Scene 4: the descent from orbit to the campus.
 * FULL: pinned for about two screens of scrolling. The 3D camera falls
 *       through the clouds, over the campus and into the glowing classroom
 *       window. The heading sits on a solid panel, bottom-left, only while
 *       the campus is in view (scrollDriver fades it).
 * LITE: one still of the same campus (rendered from the 3D scene) with the
 *       heading on its panel.
 */
export function Descent() {
  const d = en.descent;
  const full = useFullLayout();
  const sectionRef = useRef<HTMLElement>(null);

  // FULL: #descent scrolls to where the campus and the heading show.
  useEffect(() => {
    if (!full) return;
    return registerAnchorResolver((id) => {
      const section = sectionRef.current;
      if (id !== 'descent' || !section) return null;
      return { y: stickyScrollY(section, 0.68), focus: section.querySelector<HTMLElement>('h2') };
    });
  }, [full]);

  return (
    <Scene id="descent" theme="dark" index="classroom" ref={sectionRef}>
      <div className="scene__pin descent__pin">
        <div className="container descent__layout">
          <figure className="descent__still lite-visual--descent">
            <img
              src="/images/campus-1600.webp"
              srcSet="/images/campus-800.webp 800w, /images/campus-1600.webp 1600w"
              sizes="(min-width: 1320px) 1240px, calc(100vw - 32px)"
              width={1600}
              height={1000}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </figure>
          <SceneTitle id="descent" eyebrow={d.eyebrow} title={d.title} intro={d.text} className="descent__panel" />
        </div>
      </div>
    </Scene>
  );
}
