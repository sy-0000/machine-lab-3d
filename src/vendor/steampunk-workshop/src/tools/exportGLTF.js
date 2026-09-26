// Exports any asset group as a binary glTF (invoked from the console: workshop.exportGLTF('SteamBoiler')).
export async function exportObjectAsGLB(object, name = 'asset') {
  if (!object) throw new Error(`No object named "${name}"`);
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(object, { binary: true, onlyVisible: true });
  const blob = new Blob([result], { type: 'model/gltf-binary' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.glb`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return blob.size;
}
