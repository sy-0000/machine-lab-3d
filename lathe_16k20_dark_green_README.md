# 16K20 lathe — dark green, no rear backboard

This customized GLB preserves the source model's detailed object hierarchy while making two visual changes:

- removes the two large thin rear splash/back panels from the visible hierarchy;
- changes the painted machine-body material to a dark industrial green with moderate metallic response and roughness.

## File

`lathe_16k20_dark_green_no_backboard.glb`

## Structure

The source hierarchy remains intact: 182 nodes, 172 meshes, and the original control assemblies such as the cutting platform, regulators, lever assemblies, lamp, chuck, and machine body. Only rear-panel nodes `134` and `136` are detached from the visible machine hierarchy.

## Three.js

Place the GLB in `public/models/` and load it with `useGLTF`. The model has many already-separated meshes, making it a better basis for later handwheel and lever interaction than the earlier single-mesh lathe.

The source archive did not include a separate license document. Preserve any attribution and license terms from the page where the source model was downloaded.
