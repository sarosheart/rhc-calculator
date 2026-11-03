// Colours shared by both windows. The two wires keep their colours whichever branch they are in (the steps name them so).
export const COLORS = Object.freeze({
  wireA: '#3fc1c9', wireB: '#e3b341', tipA: '#5fd3da', tipB: '#f0c45a',      // each tip its wire's colour in metal (a pale
                                                                             // tint read as a white catheter)
  strut: '#c9ced6', balloon: '#e4ecf5', balloonFull: '#aebdcf', marker: '#dcd6c8',
  layer1: '#8fb8de', layer2: '#f2a541', layer3: '#e5484d',                  // the layer map: 1, 2, 3+ (legend in the page's CSS)
  gap: '#a46cf0',                                                            // Compare: the bare wall at D1's heel (no layer colour)
  intima: '#d48a80', plaque: '#ead8a6', plaqueCut: '#efe0b4', media: '#a3463e', adventitia: '#c98b72', outer: '#b47360',
});
