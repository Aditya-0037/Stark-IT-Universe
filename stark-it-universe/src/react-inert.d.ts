import 'react';

// React 18 types do not know the `inert` attribute yet. React 18 passes it
// through to the DOM when given as a string ('' = on, undefined = off).
declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: '' | undefined;
  }
}
