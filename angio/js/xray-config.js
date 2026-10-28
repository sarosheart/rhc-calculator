// X-ray constants shared by the WebGL angiogram and the 2D fallback, so the two cannot drift apart.
// μ per mm. Vessel: a 3 mm LAD reads ~0.5 of background. Bone and soft tissue kept faint, as on a real cine run, where
// ribs are edges and the heart and diaphragm are soft shadows (compared by eye with the CARDIAG frames, 2026-10-17).
// Metal (sternal wires, surgical clips after bypass surgery): far denser than contrast, so a 0.9 mm wire reads as dark
// as a mid-size artery.
export const MU = { vessel: 0.22, bone: 0.0045, tissue: 0.0032, metal: 1.1 };
// marker radii (mm): stainless sternal wire ~0.9 mm across; a ligating clip ~1.2 mm
export const MARKER_R = { sternal_wire: 0.45, clip: 0.6 };
// Field of view at the detector: CARDIAG frames span 512 px × ~0.31 mm ≈ 160 mm, so the default framing matches them.
export const I0 = 0.82, SOD = 750, SID = 1000, DET_MM = 165;
