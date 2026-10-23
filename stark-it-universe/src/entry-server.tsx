import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { Root } from './Root';
export { metadata, pagePaths, renderHead } from './lib/seo';
export { business } from './content/business';

/** Used at build time to pre-render the page into dist/index.html. */
export function render(path = '/'): string {
  return renderToString(
    <StrictMode>
      <Root path={path} />
    </StrictMode>,
  );
}
