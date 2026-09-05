import * as THREE from 'three/webgpu';

let rink: { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } | null = null;

/** Load shared rink PBR textures once. Resolves even if a file is missing (falls back to null set). */
export async function loadRinkTextures(base = '/textures/'): Promise<void> {
  const loader = new THREE.TextureLoader();
  try {
    const [color, normal, rough] = await Promise.all([loader.loadAsync(base + 'paintedmetal_color.jpg'), loader.loadAsync(base + 'paintedmetal_normal.jpg'), loader.loadAsync(base + 'paintedmetal_roughness.jpg')]);
    color.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    rough.colorSpace = THREE.NoColorSpace;
    rink = { color, normal, rough };
  } catch (e) {
    console.warn('rink textures failed to load', e);
    rink = null;
  }
}
export const getRinkTextures = () => rink;
