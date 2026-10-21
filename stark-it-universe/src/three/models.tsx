import type { GroupProps } from '@react-three/fiber';
import { lazy, Suspense, type ReactNode } from 'react';
import { modelFiles } from 'virtual:siu-assets';

/**
 * Optional glTF models. Every 3D object is built from primitives first; if
 * a matching file exists in public/models it replaces the primitive:
 *
 *   public/models/<name>.glb   (Draco or Meshopt geometry, KTX2 textures)
 *
 * The glTF loader code is its own chunk and only downloads when at least
 * one model file exists. Decoders are served locally from /draco/ and
 * /basis/ (copied from three/examples into public/). Model files are
 * listed at dev-server start / build time.
 */
export const hasModel = (name: string) => modelFiles.includes(`${name}.glb`);
export const modelUrl = (name: string) => `/models/${name}.glb`;

const GltfModel = lazy(() => import('./GltfModel'));

/**
 * Renders public/models/<name>.glb when it exists, otherwise `children`
 * (the primitive version). Transform props apply to the model only; size
 * models to 1 unit and use `scale` to fit them.
 */
export function ModelOr({ name, children, ...props }: { name: string; children: ReactNode } & GroupProps) {
  if (!hasModel(name)) return <>{children}</>;
  return (
    <Suspense fallback={children}>
      <GltfModel url={modelUrl(name)} {...props} />
    </Suspense>
  );
}
