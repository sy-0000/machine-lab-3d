Milling machine split package

milling_machine_split.glb: machine geometry split by connected components. Fan and stool parts removed.
milling_machine_split_manifest.json: component list, bounding boxes, pivots and axis guidance.
textures/: original texture assets retained for Unity material relinking.

Pivot/axis convention:
- each Part node is independently addressable
- pivot is placed at local bounding-box center
- suggested world axes: head vertical Y, table left/right X, table front/back Z, spindle Y
- separate handles are not grouped; only truly connected geometry is kept together
