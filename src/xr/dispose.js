// 釋放一棵物件樹的幾何、材質與貼圖（含 ShaderMaterial uniforms 裡的貼圖）與燈光的陰影貼圖
export function disposeTree(root) {
  const textures = new Set();
  root.traverse(o => {
    o.geometry?.dispose();
    if (o.isLight) o.dispose(); // 陰影貼圖（render target）只有 light.dispose() 會釋放
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) textures.add(u.value);
      m.dispose();
    }
  });
  textures.forEach(t => t.dispose());
}
