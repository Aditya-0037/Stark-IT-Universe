import { useGLTF } from '@react-three/drei';
import { useThree, type GroupProps } from '@react-three/fiber';
import { useMemo } from 'react';
import { KTX2Loader } from 'three-stdlib';

let ktx2: KTX2Loader | null = null;

/** Loads a compressed glTF (Draco or Meshopt geometry, KTX2 textures). */
export default function GltfModel({ url, ...props }: { url: string } & GroupProps) {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(url, '/draco/', true, (loader) => {
    if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl);
    loader.setKTX2Loader(ktx2);
  });
  const clone = useMemo(() => scene.clone(true), [scene]);
  return (
    <group {...props}>
      <primitive object={clone} />
    </group>
  );
}
