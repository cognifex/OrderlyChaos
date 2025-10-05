import * as THREE from './vendor/three.module.js';

export function hsv2rgb(h, s, v) {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return new THREE.Color(r + m, g + m, b + m);
}

export function clampColor(color) {
  color.r = Math.min(1, Math.max(0, color.r));
  color.g = Math.min(1, Math.max(0, color.g));
  color.b = Math.min(1, Math.max(0, color.b));
  return color;
}

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function normalizeHue(value) {
  if (!Number.isFinite(value)) return 0;
  let hue = value % 360;
  if (hue < 0) hue += 360;
  return hue;
}

export function hsvToHex(h, s, v) {
  const color = hsv2rgb(h, s, v);
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  const toHex = (component) => component.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

export function hexToHsv(hex) {
  if (typeof hex !== 'string') return null;
  const normalized = hex.trim().toLowerCase();
  const match = /^#?([\da-f]{6})$/.exec(normalized);
  if (!match) return null;
  const intVal = parseInt(match[1], 16);
  const r = ((intVal >> 16) & 255) / 255;
  const g = ((intVal >> 8) & 255) / 255;
  const b = (intVal & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h: normalizeHue(h), s: clamp01(s), v: clamp01(v) };
}

export function hueDifference(a, b) {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return Math.abs(diff);
}

export function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringList(strings) {
  if (!Array.isArray(strings) || !strings.length) {
    return 0x9e3779b9;
  }
  let hash = 0x811c9dc5;
  for (const entry of strings) {
    const value = typeof entry === 'string' ? entry : '';
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
      hash >>>= 0;
    }
  }
  if (hash === 0) {
    return 0x6d2b79f5;
  }
  return hash >>> 0;
}

export function randomRange(min, max) {
  const a = Number.isFinite(min) ? min : 0;
  const b = Number.isFinite(max) ? max : 0;
  return a + Math.random() * (b - a);
}

export function randomInRange(range, fallback = 0, { clamp = false } = {}) {
  if (Array.isArray(range) && range.length === 2) {
    const min = Number.isFinite(range[0]) ? range[0] : range[1];
    const max = Number.isFinite(range[1]) ? range[1] : range[0];
    if (Number.isFinite(min) && Number.isFinite(max)) {
      const value = min + Math.random() * (max - min);
      if (!clamp) {
        return value;
      }
      if (min > max) {
        return fallback;
      }
      return Math.min(Math.max(value, min), max);
    }
  }
  if (Number.isFinite(range)) {
    return range;
  }
  if (Array.isArray(fallback) && fallback.length === 2) {
    return randomInRange(fallback, 0, { clamp });
  }
  return Number.isFinite(fallback) ? fallback : 0;
}

export function randomIntInRange(range, fallback = 0) {
  const value = randomInRange(range, fallback, { clamp: true });
  return Math.round(value);
}

export function randomChoice(list, fallback = null) {
  if (Array.isArray(list) && list.length) {
    const index = Math.floor(Math.random() * list.length);
    return list[Math.max(0, Math.min(list.length - 1, index))];
  }
  return fallback;
}

export function damp(current, target, rate, delta) {
  const clampedRate = Math.max(0, rate);
  const frame = Math.max(0, delta);
  if (clampedRate === 0 || frame === 0) return current;
  const factor = 1 - Math.exp(-clampedRate * frame);
  return current + (target - current) * factor;
}
