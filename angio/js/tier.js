// Performance tiers. High: full meshes, antialiasing, the angiogram at up to 2× pixels. Low: the lite meshes, no
// antialiasing, everything at 1× pixels. The tier is chosen before the models load, from one look at the GPU; the page
// steps down once if frames then come too slowly. The angiogram keeps its full vessel geometry in both.
const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|software/i;

export function chooseTier({ renderer = '', maxTexture = 16384, floatColor = true, memory, cores, saveData = false, override } = {}) {
  if (override === 'low' || override === 'high') return override;
  if (SOFTWARE.test(renderer) || !floatColor || maxTexture < 4096 || saveData) return 'low';
  // WebKit reports a clamped core count and no memory on Apple devices (privacy); every Apple GPU it runs on is high
  if (/\bapple\b/i.test(renderer)) return 'high';
  if ((memory !== undefined && memory <= 2) || (cores !== undefined && cores <= 2)) return 'low';
  return 'high';
}

// What chooseTier needs, from a throwaway WebGL2 context (released at once) and the navigator.
export function probeGPU() {
  const out = { memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency, saveData: !!navigator.connection?.saveData };
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { ...out, floatColor: false };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    out.renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    // the angiogram's path-length target is half float: either extension will do (some iOS builds have only that one)
    out.floatColor = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) { out.floatColor = false; }
  return out;
}

// Frame pacing: each sample is the duration of ONE frame right after a render (main.js times the frame that follows a
// render), so input slower than the frames — a held arrow key, a slow drag — never reads as a slow device. Says 'slow'
// once, when the median of n samples is over budget; a sample over `cap` ms (a hidden tab, a paused page) is not a frame.
export function createPacer({ budget = 25, n = 30, cap = 1000 } = {}) {
  let d = [], said = false;
  return {
    sample(ms) {
      if (said || !(ms > 0) || ms > cap) return null;
      d.push(ms);
      if (d.length < n) return null;
      const m = [...d].sort((a, b) => a - b)[n >> 1]; d = [];
      if (m <= budget) return null;
      said = true; return 'slow';
    },
  };
}
