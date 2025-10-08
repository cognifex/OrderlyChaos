import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { STLLoader } from '../vendor/STLLoader.js';

import {
  hsv2rgb,
  clampColor,
  clamp01,
  normalizeHue,
  hsvToHex,
  hexToHsv,
  hueDifference,
  mulberry32,
  hashStringList,
  randomRange,
  randomInRange,
  randomIntInRange,
  randomChoice,
  damp
} from '../utilities.js';

export function bootstrapApp() {
  /* Renderer/Scene/Camera */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  document.body.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('tabindex', '-1');
  renderer.domElement.setAttribute('aria-label', 'Chaos-Kugel Visualisierung');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 480);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.6;

  const clusterGroup = new THREE.Group();
  scene.add(clusterGroup);

  const FELDAPPEN_CENTER = new THREE.Vector3(0, 0, 0);

  const stlGroup = new THREE.Group();
  stlGroup.name = 'feldappenVolume';
  stlGroup.visible = false;
  clusterGroup.add(stlGroup);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(220, 340, 260);
  directionalLight.target.position.copy(FELDAPPEN_CENTER);
  scene.add(directionalLight);
  scene.add(directionalLight.target);

  clusterGroup.position.copy(FELDAPPEN_CENTER);
  controls.target.copy(FELDAPPEN_CENTER);
  controls.update();
  const stlLoader = new STLLoader();
  const MAX_STL_POINTS = 18000;
  let stlMaterial = null;
  const stlState = {
    files: [],
    points: null,
    boundingRadius: 0,
    samples: null,
    sampleCount: 0,
    displayMode: 'overlay',
    previousDistribution: null
  };
  const stlUI = {
    input: null,
    meta: null,
    clearBtn: null
  };
  let stlDistributionOption = null;

  /* Parameters */
  const params = {
    count: 2500,
    radius: 140,
    distribution: 'random',
    sizeVar: 4.0,
    cluster: 0.65,
    pointAlpha: 0.95,
    pointHue: 210,
    pointSaturation: 0.75,
    pointValue: 1.0,
    colorMode: 'uniform',
    colorIntensity: 0.8,
    colorSpeed: 1.0,
    hueSpread: 45,
    colorPropagationDistance: 140,
    colorPropagationDuration: 6,
    colorToneCount: 3,
    seedStars: 1,
    catSmallCount: 1125,
    catMediumCount: 875,
    catLargeCount: 500,
    // Size factors
    sizeFactorTiny: 0.15,
    sizeFactorSmall: 1.0,
    sizeFactorMedium: 1.5,
    sizeFactorLarge: 2.0,
    // Tiny points / connections
    tinyCount: 2000,
    connPercent: 0.5,
    tinyAlpha: 0.5,
    seedTiny: 1,
    // Edge & blending
    edgeSoftness: 0.6,
    blending: 'Normal',
    filled: false,
    // Motion
    motionMode: 'static',
    motionSpeed: 1.0,
    motionAmplitude: 8.0,
    motionNoiseStrength: 1.0,
    motionNoiseScale: 1.0
  };
  const INITIAL_SCENE_PRESET = Object.freeze(JSON.parse(JSON.stringify(params)));
  const PRESET_STUDIO_DEFAULT_MESSAGE = 'Tipp: Kopiere dein aktuelles Preset, um es zu teilen oder später erneut zu laden.';

  function clampTotalCount(value) {
    const numeric = Math.floor(Number(value) || 0);
    return Math.max(0, numeric);
  }

  const colorState = {
    point: new THREE.Color(),
    accent: new THREE.Color(),
    dim: new THREE.Color(),
    radius: params.radius
  };
  const COLOR_MODES = ['uniform', 'radialPulse', 'axisWave', 'phaseFlicker', 'randomHue'];
  const MOTION_MODES = ['static', 'sine', 'noise', 'orbit'];
  const EXPERIENCE_BIOMES = Object.freeze([
    {
      name: 'Aurora Drift',
      distribution: ['fibonacci', 'spiral'],
      count: [2200, 4200],
      radius: [120, 200],
      sizeVar: [3.2, 6.2],
      cluster: [0.25, 0.55],
      pointAlpha: [0.55, 0.78],
      pointHueRanges: [[160, 220]],
      pointSaturation: [0.55, 0.85],
      pointValue: [0.68, 0.95],
      colorMode: ['radialPulse', 'axisWave'],
      colorIntensity: [0.55, 0.9],
      colorSpeed: [0.18, 0.55],
      hueSpread: [60, 140],
      colorPropagationDistance: [120, 220],
      colorPropagationDuration: [3.2, 7.5],
      colorToneCount: [2, 4],
      motionMode: ['sine', 'noise'],
      motionSpeed: [0.28, 0.75],
      motionAmplitude: [6, 18],
      motionNoiseStrength: [0.35, 0.9],
      motionNoiseScale: [0.6, 1.6],
      catDistribution: [0.44, 0.36, 0.2],
      sizeFactorTiny: [0.08, 0.24],
      sizeFactorSmall: [0.6, 1.2],
      sizeFactorMedium: [0.8, 1.6],
      sizeFactorLarge: [1.1, 2.4],
      tinyCount: [600, 1800],
      tinyAlpha: [0.18, 0.36],
      connPercent: [0.18, 0.38],
      edgeSoftness: [0.45, 0.78],
      blending: ['Additive'],
      filledChance: 0.15,
    },
    {
      name: 'Celestial Bloom',
      distribution: ['fibonacci', 'cylinder', 'spiral'],
      count: [2800, 5200],
      radius: [140, 210],
      sizeVar: [2.4, 5.2],
      cluster: [0.3, 0.6],
      pointAlpha: [0.45, 0.7],
      pointHueRanges: [[330, 360], [0, 32], [28, 56]],
      pointSaturation: [0.4, 0.7],
      pointValue: [0.72, 1.0],
      colorMode: ['phaseFlicker', 'radialPulse'],
      colorIntensity: [0.45, 0.85],
      colorSpeed: [0.24, 0.8],
      hueSpread: [40, 110],
      colorPropagationDistance: [100, 180],
      colorPropagationDuration: [4.5, 8.5],
      colorToneCount: [2, 5],
      motionMode: ['sine', 'noise'],
      motionSpeed: [0.24, 0.68],
      motionAmplitude: [5, 14],
      motionNoiseStrength: [0.25, 0.8],
      motionNoiseScale: [0.5, 1.4],
      catDistribution: [0.36, 0.38, 0.26],
      sizeFactorTiny: [0.09, 0.28],
      sizeFactorSmall: [0.7, 1.6],
      sizeFactorMedium: [1.1, 2.4],
      sizeFactorLarge: [1.5, 2.9],
      tinyCount: [900, 2200],
      tinyAlpha: [0.2, 0.42],
      connPercent: [0.22, 0.48],
      edgeSoftness: [0.35, 0.72],
      blending: ['Normal', 'Additive'],
      filledChance: 0.35,
    },
    {
      name: 'Obsidian Pulse',
      distribution: ['random', 'octahedron', 'spiral'],
      count: [2600, 4800],
      radius: [110, 180],
      sizeVar: [4.2, 7.0],
      cluster: [0.4, 0.75],
      pointAlpha: [0.55, 0.85],
      pointHueRanges: [[200, 240], [240, 290], [300, 330]],
      pointSaturation: [0.6, 0.9],
      pointValue: [0.45, 0.85],
      colorMode: ['axisWave', 'randomHue'],
      colorIntensity: [0.65, 0.95],
      colorSpeed: [0.45, 1.4],
      hueSpread: [80, 160],
      colorPropagationDistance: [150, 260],
      colorPropagationDuration: [2.8, 5.8],
      colorToneCount: [3, 6],
      motionMode: ['noise', 'sine'],
      motionSpeed: [0.36, 0.9],
      motionAmplitude: [8, 22],
      motionNoiseStrength: [0.45, 1.2],
      motionNoiseScale: [0.8, 2.4],
      catDistribution: [0.4, 0.32, 0.28],
      sizeFactorTiny: [0.1, 0.32],
      sizeFactorSmall: [0.5, 1.1],
      sizeFactorMedium: [1.0, 2.0],
      sizeFactorLarge: [1.8, 3.3],
      tinyCount: [400, 1200],
      tinyAlpha: [0.26, 0.5],
      connPercent: [0.28, 0.6],
      edgeSoftness: [0.28, 0.6],
      blending: ['Additive'],
      filledChance: 0.1,
    },
    {
      name: 'Deep Sea Shimmer',
      distribution: ['fibonacci', 'cylinder', 'random'],
      count: [2300, 4300],
      radius: [130, 210],
      sizeVar: [3.4, 5.8],
      cluster: [0.2, 0.5],
      pointAlpha: [0.5, 0.78],
      pointHueRanges: [[170, 210], [190, 230]],
      pointSaturation: [0.55, 0.85],
      pointValue: [0.6, 0.92],
      colorMode: ['radialPulse', 'axisWave'],
      colorIntensity: [0.5, 0.85],
      colorSpeed: [0.2, 0.7],
      hueSpread: [50, 120],
      colorPropagationDistance: [130, 240],
      colorPropagationDuration: [3.2, 6.5],
      colorToneCount: [2, 4],
      motionMode: ['noise', 'sine'],
      motionSpeed: [0.3, 0.78],
      motionAmplitude: [7, 16],
      motionNoiseStrength: [0.35, 0.95],
      motionNoiseScale: [0.7, 1.9],
      catDistribution: [0.38, 0.36, 0.26],
      sizeFactorTiny: [0.08, 0.26],
      sizeFactorSmall: [0.7, 1.4],
      sizeFactorMedium: [1.1, 2.1],
      sizeFactorLarge: [1.6, 2.8],
      tinyCount: [700, 2000],
      tinyAlpha: [0.22, 0.4],
      connPercent: [0.2, 0.42],
      edgeSoftness: [0.38, 0.75],
      blending: ['Normal'],
      filledChance: 0.25,
    },
  ]);

  const PRESET_STORAGE_KEY = 'orderlyChaos.userPresets.v1';
  const userPresetState = {
    items: [],
    selected: new Set(),
    galleryMode: 'grid',
  };

  const PATTERN_DESCRIPTIONS = new Map([
    ['Aurora Drift', 'Schillernde Polarlichter mit sanften Bewegungen.'],
    ['Celestial Bloom', 'Warme Blütenfarben mit organischen Spiralen.'],
    ['Obsidian Pulse', 'Dunkle Energie mit leuchtenden Impulsen.'],
    ['Deep Sea Shimmer', 'Tiefblaue Strömungen mit ruhigen Wellen.']
  ]);

  const DEFAULT_PATTERN_DESCRIPTION = 'Nutze Presets oder die Regler, um dein persönliches Sternenfeld zu gestalten.';

  let currentPatternName = 'Freestyle';

  function randomHueFromRanges(ranges, fallbackRange = [0, 360]) {
    if (Array.isArray(ranges) && ranges.length) {
      const choice = randomChoice(ranges);
      if (Array.isArray(choice) && choice.length === 2) {
        return normalizeHue(randomInRange(choice, normalizeHue(randomInRange(fallbackRange))));
      }
      if (Number.isFinite(choice)) {
        return normalizeHue(choice);
      }
    }
    if (Array.isArray(fallbackRange) && fallbackRange.length === 2) {
      return normalizeHue(randomInRange(fallbackRange, 0));
    }
    if (Number.isFinite(fallbackRange)) {
      return normalizeHue(fallbackRange);
    }
    return normalizeHue(Math.random() * 360);
  }

  function distributeCategoryCounts(total, weights = []) {
    const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
    if (!Array.isArray(weights) || weights.length !== 3) {
      const base = Math.floor(safeTotal / 3);
      const remainder = safeTotal - base * 3;
      return [base + (remainder > 0 ? 1 : 0), base + (remainder > 1 ? 1 : 0), safeTotal - base * 2 - (remainder > 0 ? 1 : 0) - (remainder > 1 ? 1 : 0)];
    }
    const normalized = weights.map(value => Math.max(0, Number(value) || 0));
    const sum = normalized.reduce((acc, value) => acc + value, 0) || 1;
    const provisional = normalized.map(value => Math.floor((value / sum) * safeTotal));
    let assigned = provisional.reduce((acc, value) => acc + value, 0);
    let index = 0;
    while (assigned < safeTotal && index < 300) {
      provisional[index % provisional.length] += 1;
      assigned += 1;
      index += 1;
    }
    const [small, medium] = provisional;
    return [small, medium, Math.max(0, safeTotal - small - medium)];
  }

  function applyBiomePreset(preset, { syncUI = true, repositionCamera = false } = {}) {
    if (!preset) {
      return null;
    }
    const totalCount = clampTotalCount(randomIntInRange(preset.count, params.count));
    params.count = totalCount;
    params.radius = Math.max(0, randomInRange(preset.radius, params.radius));
    params.sizeVar = Math.max(0, randomInRange(preset.sizeVar, params.sizeVar));
    params.cluster = clamp01(randomInRange(preset.cluster, params.cluster));
    params.pointAlpha = clamp01(randomInRange(preset.pointAlpha, params.pointAlpha));
    params.pointHue = randomHueFromRanges(preset.pointHueRanges, preset.pointHue || [0, 360]);
    params.pointSaturation = clamp01(randomInRange(preset.pointSaturation, params.pointSaturation));
    params.pointValue = clamp01(randomInRange(preset.pointValue, params.pointValue));
    params.colorMode = randomChoice(preset.colorMode, params.colorMode);
    params.colorIntensity = clamp01(randomInRange(preset.colorIntensity, params.colorIntensity));
    params.colorSpeed = Math.max(0, randomInRange(preset.colorSpeed, params.colorSpeed));
    params.hueSpread = Math.max(0, randomInRange(preset.hueSpread, params.hueSpread));
    params.colorPropagationDistance = Math.max(0, randomInRange(preset.colorPropagationDistance, params.colorPropagationDistance));
    params.colorPropagationDuration = Math.max(0.25, randomInRange(preset.colorPropagationDuration, params.colorPropagationDuration));
    params.colorToneCount = Math.max(1, randomIntInRange(preset.colorToneCount, params.colorToneCount));
    const availableDistributions = getAvailableDistributions();
    let presetDistribution = preset.distribution;
    if (Array.isArray(presetDistribution)) {
      presetDistribution = presetDistribution.filter(option => availableDistributions.includes(option));
    } else if (typeof presetDistribution === 'string' && !availableDistributions.includes(presetDistribution)) {
      presetDistribution = null;
    }
    const fallbackDistribution = availableDistributions.includes(params.distribution)
      ? params.distribution
      : 'random';
    const chosenDistribution = Array.isArray(presetDistribution) && presetDistribution.length
      ? randomChoice(presetDistribution, fallbackDistribution)
      : (typeof presetDistribution === 'string' ? presetDistribution : fallbackDistribution);
    params.distribution = availableDistributions.includes(chosenDistribution)
      ? chosenDistribution
      : fallbackDistribution;
    params.motionMode = randomChoice(preset.motionMode, params.motionMode);
    params.motionSpeed = Math.max(0, randomInRange(preset.motionSpeed, params.motionSpeed));
    params.motionAmplitude = Math.max(0, randomInRange(preset.motionAmplitude, params.motionAmplitude));
    params.motionNoiseStrength = Math.max(0, randomInRange(preset.motionNoiseStrength, params.motionNoiseStrength));
    params.motionNoiseScale = Math.max(0.1, randomInRange(preset.motionNoiseScale, params.motionNoiseScale));
    const [catSmall, catMedium] = distributeCategoryCounts(totalCount, preset.catDistribution);
    params.catSmallCount = catSmall;
    params.catMediumCount = catMedium;
    params.catLargeCount = Math.max(0, totalCount - catSmall - catMedium);
    params.sizeFactorTiny = Math.max(0, randomInRange(preset.sizeFactorTiny, params.sizeFactorTiny));
    params.sizeFactorSmall = Math.max(0.05, randomInRange(preset.sizeFactorSmall, params.sizeFactorSmall));
    params.sizeFactorMedium = Math.max(0.05, randomInRange(preset.sizeFactorMedium, params.sizeFactorMedium));
    params.sizeFactorLarge = Math.max(0.05, randomInRange(preset.sizeFactorLarge, params.sizeFactorLarge));
    params.tinyCount = Math.max(0, randomIntInRange(preset.tinyCount, params.tinyCount));
    params.connPercent = clamp01(randomInRange(preset.connPercent, params.connPercent));
    params.tinyAlpha = clamp01(randomInRange(preset.tinyAlpha, params.tinyAlpha));
    params.edgeSoftness = clamp01(randomInRange(preset.edgeSoftness, params.edgeSoftness));
    params.blending = randomChoice(preset.blending, params.blending);
    const filledChance = Number.isFinite(preset.filledChance) ? preset.filledChance : 0;
    params.filled = Math.random() < Math.max(0, Math.min(1, filledChance));
    params.seedStars = 1 + Math.floor(Math.random() * 9999);
    params.seedTiny = 1 + Math.floor(Math.random() * 9999);
    enforceBounds();
    updatePointColor();
    rebuildStars();
    updateStarUniforms();
    updateTinyMaterial();
    if (repositionCamera) {
      focusOnFeldappenCenter({ repositionCamera: true });
    }
    if (syncUI) {
      setSliders();
    }
    return preset.name || null;
  }

  function generateRandomBiome(options = {}) {
    const preset = randomChoice(EXPERIENCE_BIOMES);
    if (!preset) {
      return null;
    }
    return applyBiomePreset(preset, options);
  }
  const motionState = { time: 0 };

  function getFeldappenFocusRadius() {
    const values = [
      Number.isFinite(colorState.radius) ? colorState.radius : 0,
      Number.isFinite(stlState.boundingRadius) ? stlState.boundingRadius : 0,
      Number.isFinite(params.radius) ? params.radius : 0,
      80
    ];
    return Math.max(...values);
  }

  function focusOnFeldappenCenter({ repositionCamera = true } = {}) {
    const target = FELDAPPEN_CENTER;
    controls.target.copy(target);
    clusterGroup.position.copy(target);
    if (repositionCamera) {
      const distance = Math.max(getFeldappenFocusRadius() * 3.2, 320);
      camera.position.set(target.x, target.y, target.z + distance);
    }
    controls.update();
  }

  function updateStlMeta(files = stlState.files || [], { loading = false, error = '' } = {}) {
    const names = Array.isArray(files)
      ? files.map(item => (typeof item === 'string' ? item : (item && item.name) || '')).filter(Boolean)
      : [];
    if (stlUI.meta) {
      let text = 'Keine Auswahl';
      let state = 'idle';
      if (error) {
        text = error;
        state = 'error';
      } else if (loading) {
        text = 'Lade STL-Dateien …';
        state = 'loading';
      } else if (names.length) {
        text = names.length === 1
          ? `Geladen: ${names[0]}`
          : `Geladen: ${names.length} STL-Dateien`;
        state = 'ready';
        if (stlState.displayMode === 'distribution') {
          text += ' – als Verteilungsalgorithmus aktiv';
        } else {
          text += ' – zusätzlich eingeblendet';
        }
      }
      stlUI.meta.textContent = text;
      stlUI.meta.dataset.state = state;
      if (!loading && !error && names.length) {
        stlUI.meta.dataset.mode = stlState.displayMode || 'overlay';
      } else if (stlUI.meta.dataset.mode) {
        delete stlUI.meta.dataset.mode;
      }
    }
    if (stlUI.clearBtn) {
      stlUI.clearBtn.disabled = loading || !stlState.points;
    }
    if (stlUI.input) {
      stlUI.input.disabled = loading;
    }
  }

  function clearStlModels({ keepCamera = false, skipInputReset = false, preserveMeta = false, preserveUsage = false } = {}) {
    const hadPoints = Boolean(stlState.points);
    if (stlState.points) {
      if (stlState.points.geometry) {
        stlState.points.geometry.dispose();
      }
      stlGroup.remove(stlState.points);
      stlState.points = null;
    }
    stlGroup.visible = false;
    stlState.files = [];
    stlState.boundingRadius = 0;
    stlState.samples = null;
    stlState.sampleCount = 0;
    if (!preserveUsage) {
      stlState.displayMode = 'overlay';
      stlState.previousDistribution = null;
    }
    if (!skipInputReset && stlUI.input) {
      stlUI.input.value = '';
    }
    if (!preserveMeta) {
      updateStlMeta([]);
    } else if (stlUI.clearBtn) {
      stlUI.clearBtn.disabled = true;
    }
    if (!preserveUsage) {
      const reverted = revertFromStlDistribution();
      if (reverted) {
        rebuildStars();
        setSliders();
      }
    }
    updateStlOptionAvailability();
    renderDistributionChips();
    updateStarUniforms();
    if (hadPoints && !keepCamera) {
      focusOnFeldappenCenter({ repositionCamera: true });
    }
  }

  function hasStlSamples() {
    return stlState.samples instanceof Float32Array && stlState.sampleCount > 0;
  }

  function getAvailableDistributions() {
    const base = ['random', 'fibonacci', 'spiral', 'cube', 'cylinder', 'octahedron'];
    if (hasStlSamples()) {
      base.push('stl');
    }
    return base;
  }

  function getDistributionLabel(value) {
    switch (value) {
      case 'random':
        return 'Freestyle';
      case 'fibonacci':
        return 'Fibonacci-Sphäre';
      case 'spiral':
        return 'Spirale';
      case 'cube':
        return 'Würfelwolke';
      case 'cylinder':
        return 'Zylindersäule';
      case 'octahedron':
        return 'Oktaeder';
      case 'stl':
        return 'STL-Form';
      default:
        return value || 'Muster';
    }
  }

  function updatePresetButtonStates(activeName = '') {
    if (!patternUI.presetList) return;
    const normalized = (activeName || '').toLowerCase();
    patternUI.presetList.querySelectorAll('button[data-preset]').forEach(button => {
      const pressed = button.dataset.preset && button.dataset.preset.toLowerCase() === normalized;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      button.dataset.active = pressed ? 'true' : 'false';
    });
  }

  function setCurrentPattern(name = 'Freestyle', description = '') {
    currentPatternName = name || 'Freestyle';
    if (patternUI.activeName) {
      patternUI.activeName.textContent = `Aktives Muster: ${currentPatternName}`;
    }
    const detail = description
      || PATTERN_DESCRIPTIONS.get(currentPatternName)
      || DEFAULT_PATTERN_DESCRIPTION;
    if (patternUI.activeDescription) {
      patternUI.activeDescription.textContent = detail;
    }
    updatePresetButtonStates(currentPatternName);
  }

  function renderPatternPresets() {
    if (!patternUI.presetList) return;
    patternUI.presetList.innerHTML = '';
    EXPERIENCE_BIOMES.forEach(preset => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pattern-quick__button';
      button.dataset.preset = preset.name;
      button.setAttribute('aria-pressed', 'false');
      const description = PATTERN_DESCRIPTIONS.get(preset.name) || 'Atmosphärisches Chaos-Muster.';
      button.innerHTML = `<strong>${preset.name}</strong><span>${description}</span>`;
      button.addEventListener('click', () => {
        const appliedName = applyBiomePreset(preset, { syncUI: true, repositionCamera: true });
        if (appliedName) {
          setCurrentPattern(appliedName);
        }
      });
      patternUI.presetList.appendChild(button);
    });
    updatePresetButtonStates(currentPatternName);
  }

  function cloneParamsForPreset() {
    return JSON.parse(JSON.stringify(params));
  }

  function sanitizePresetRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : null;
    const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : null;
    const cfg = record.params && typeof record.params === 'object' ? record.params : null;
    if (!id || !name || !cfg) return null;
    const notes = typeof record.notes === 'string' ? record.notes : '';
    const createdAt = Number.isFinite(record.createdAt) ? Number(record.createdAt) : Date.now();
    return {
      id,
      name,
      notes,
      createdAt,
      params: { ...cfg },
    };
  }

  function loadUserPresetsFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const items = parsed.map(sanitizePresetRecord).filter(Boolean);
      items.sort((a, b) => b.createdAt - a.createdAt);
      userPresetState.items = items;
    } catch (error) {
      console.warn('Konnte gespeicherte Presets nicht laden:', error);
    }
  }

  function persistUserPresets() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const payload = userPresetState.items.map(preset => ({
        id: preset.id,
        name: preset.name,
        notes: preset.notes,
        createdAt: preset.createdAt,
        params: preset.params,
      }));
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Konnte Presets nicht speichern:', error);
    }
  }

  function createPresetId(name) {
    const base = `${name}-${Date.now()}-${Math.random()}`;
    return `preset:${hashStringList([base])}`;
  }

  function computePresetPreview(config) {
    const hue = ((Number(config.pointHue) || 0) % 360 + 360) % 360;
    const spread = Math.max(0, Number(config.hueSpread) || 0);
    const saturation = clamp01(Number(config.pointSaturation) || 0);
    const value = clamp01(Number(config.pointValue) || 0);
    const accentHue = (hue + spread * 0.5) % 360;
    const dimHue = (hue - spread * 0.5 + 360) % 360;
    const base = hsvToHex(hue, saturation, value);
    const accent = hsvToHex(accentHue, clamp01(Math.min(1, saturation + 0.2)), clamp01(Math.min(1, value + 0.15)));
    const dim = hsvToHex(dimHue, clamp01(Math.max(0, saturation - 0.15)), clamp01(Math.max(0, value - 0.2)));
    const gradient = `linear-gradient(135deg, ${base} 0%, ${accent} 50%, ${dim} 100%)`;
    return { base, accent, dim, gradient };
  }

  function formatPresetTimestamp(timestamp) {
    try {
      return new Date(timestamp).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (error) {
      return 'Unbekanntes Datum';
    }
  }

  function createPresetChip(label, options = {}) {
    const chip = document.createElement('span');
    chip.className = 'preset-card__chip';
    if (options.color) {
      chip.style.setProperty('--chip-color', options.color);
    }
    chip.textContent = label;
    return chip;
  }

  function updatePresetEmptyState() {
    if (!customPresetUI.emptyState) return;
    const hasItems = userPresetState.items.length > 0;
    customPresetUI.emptyState.hidden = hasItems;
  }

  function updatePresetSelectionUI() {
    if (!customPresetUI.gallery) return;
    const cards = customPresetUI.gallery.querySelectorAll('.preset-card');
    cards.forEach(card => {
      const id = card.dataset.presetId;
      const pressed = id && userPresetState.selected.has(id);
      card.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      card.classList.toggle('is-selected', pressed);
    });
  }

  function updatePresetRandomButton(forceDisabled = false) {
    if (!customPresetUI.randomBtn) return;
    const hasSelection = userPresetState.selected.size > 0;
    const disabled = Boolean(forceDisabled || experienceState.editingMode || !hasSelection);
    if (disabled) {
      customPresetUI.randomBtn.disabled = true;
      customPresetUI.randomBtn.setAttribute('aria-disabled', 'true');
    } else {
      customPresetUI.randomBtn.disabled = false;
      customPresetUI.randomBtn.removeAttribute('aria-disabled');
    }
    const isActive = autoRandomState.enabled && autoRandomState.mode === 'presets';
    customPresetUI.randomBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    const countText = hasSelection ? ` (${userPresetState.selected.size})` : '';
    customPresetUI.randomBtn.textContent = isActive ? `🎲 Shuffle an${countText}` : `🎲 Shuffle aus${countText}`;
  }

  function renderUserPresets() {
    if (!customPresetUI.gallery) return;
    customPresetUI.gallery.innerHTML = '';
    userPresetState.items.forEach(preset => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset-card gallery-card';
      button.dataset.presetId = preset.id;
      button.setAttribute('aria-pressed', userPresetState.selected.has(preset.id) ? 'true' : 'false');
      const preview = computePresetPreview(preset.params);
      const thumb = document.createElement('div');
      thumb.className = 'preset-card__thumb gallery-card__media';
      thumb.style.background = preview.gradient;
      button.appendChild(thumb);

      const nameEl = document.createElement('h4');
      nameEl.className = 'preset-card__name';
      nameEl.textContent = preset.name;
      const metaEl = document.createElement('p');
      metaEl.className = 'preset-card__meta';
      if (preset.notes && preset.notes.trim()) {
        metaEl.textContent = preset.notes.trim();
      } else {
        metaEl.textContent = `Erstellt am ${formatPresetTimestamp(preset.createdAt)}`;
      }

      const content = document.createElement('div');
      content.className = 'preset-card__content';
      content.appendChild(nameEl);
      content.appendChild(metaEl);

      const actions = document.createElement('div');
      actions.className = 'preset-card__actions';

      const chips = document.createElement('div');
      chips.className = 'preset-card__chips';
      const colorChip = createPresetChip(`${Math.round(Number(preset.params.hueSpread) || 0)}°`, { color: preview.base });
      chips.appendChild(colorChip);
      const distributionChip = createPresetChip(getDistributionLabel(preset.params.distribution));
      chips.appendChild(distributionChip);
      actions.appendChild(chips);

      const buttonsWrap = document.createElement('div');
      buttonsWrap.className = 'preset-card__buttons';

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.textContent = 'Start';
      applyBtn.addEventListener('click', event => {
        event.stopPropagation();
        applyUserPresetById(preset.id, { userInitiated: true });
      });
      buttonsWrap.appendChild(applyBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'preset-card__delete';
      deleteBtn.setAttribute('aria-label', `Preset „${preset.name}“ löschen`);
      deleteBtn.textContent = '🗑️';
      deleteBtn.addEventListener('click', event => {
        event.stopPropagation();
        deleteUserPreset(preset.id);
      });
      buttonsWrap.appendChild(deleteBtn);

      actions.appendChild(buttonsWrap);
      content.appendChild(actions);

      button.appendChild(content);
      button.addEventListener('click', () => {
        togglePresetSelection(preset.id);
      });

      customPresetUI.gallery.appendChild(button);
    });
    updatePresetEmptyState();
    updatePresetSelectionUI();
    updatePresetRandomButton();
  }

  function togglePresetSelection(id) {
    if (!id) return;
    if (userPresetState.selected.has(id)) {
      userPresetState.selected.delete(id);
    } else {
      userPresetState.selected.add(id);
    }
    updatePresetSelectionUI();
    if (autoRandomState.mode === 'presets' && autoRandomState.enabled && userPresetState.selected.size === 0) {
      setAutoRandomEnabled(false, { mode: 'parameters' });
    } else {
      updatePresetRandomButton();
    }
  }

  function setSlidersAndRebuild({ syncUI = true } = {}) {
    enforceBounds();
    updatePointColor();
    rebuildStars();
    if (syncUI) {
      setSliders();
    }
  }

  function applyScenePreset(preset, { syncUI = true, patternName = null, patternDescription = '' } = {}) {
    if (!preset) return false;
    let normalized;
    try {
      normalized = JSON.parse(JSON.stringify(preset));
    } catch (error) {
      console.warn('Konnte Preset nicht übernehmen:', error);
      return false;
    }
    if (!normalized || typeof normalized !== 'object') {
      return false;
    }
    Object.assign(params, normalized);
    setSlidersAndRebuild({ syncUI });
    if (patternName) {
      setCurrentPattern(patternName, patternDescription || '');
    }
    return true;
  }

  function setPresetStudioStatus(message, state = 'info') {
    if (!presetStudioUI.status) return;
    presetStudioUI.status.textContent = message;
    presetStudioUI.status.dataset.state = state;
  }

  async function copyCurrentPresetToClipboard() {
    let serialized;
    try {
      serialized = JSON.stringify(params, null, 2);
    } catch (error) {
      console.warn('Konnte Preset nicht serialisieren:', error);
      return false;
    }
    if (!serialized) {
      return false;
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(serialized);
        return true;
      }
    } catch (error) {
      console.warn('Zwischenablage nicht verfügbar:', error);
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = serialized;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const result = document.execCommand ? document.execCommand('copy') : false;
      document.body.removeChild(textarea);
      return Boolean(result);
    } catch (error) {
      console.warn('Fallback-Kopie fehlgeschlagen:', error);
      return false;
    }
  }

  function applyUserPreset(preset, { syncUI = true, setPatternName = true } = {}) {
    if (!preset) return false;
    Object.assign(params, preset.params || {});
    setSlidersAndRebuild({ syncUI });
    if (setPatternName) {
      setCurrentPattern(preset.name || 'Benutzer-Preset', preset.notes || '');
    }
    return true;
  }

  function applyUserPresetById(id) {
    const preset = userPresetState.items.find(item => item.id === id);
    if (!preset) return false;
    const applied = applyUserPreset(preset, { syncUI: true, setPatternName: true });
    if (applied) {
      autoRandomState.lastPresetId = preset.id;
    }
    return applied;
  }

  function playRandomPresetFromSelection() {
    if (!userPresetState.selected.size) {
      return false;
    }
    const ids = Array.from(userPresetState.selected);
    let pool = ids;
    if (ids.length > 1 && autoRandomState.lastPresetId) {
      const filtered = ids.filter(id => id !== autoRandomState.lastPresetId);
      if (filtered.length) {
        pool = filtered;
      }
    }
    const choice = randomChoice(pool);
    if (!choice) return false;
    const applied = applyUserPresetById(choice, { userInitiated: false });
    if (applied) {
      autoRandomState.lastPresetId = choice;
    }
    return applied;
  }

  function deleteUserPreset(id) {
    const nextItems = userPresetState.items.filter(item => item.id !== id);
    if (nextItems.length === userPresetState.items.length) return;
    userPresetState.items = nextItems;
    userPresetState.selected.delete(id);
    if (autoRandomState.mode === 'presets' && autoRandomState.enabled && userPresetState.selected.size === 0) {
      setAutoRandomEnabled(false, { mode: 'parameters' });
    }
    persistUserPresets();
    renderUserPresets();
  }

  function handlePresetFormSubmit(event) {
    event.preventDefault();
    if (!customPresetUI.nameInput) return;
    const name = customPresetUI.nameInput.value.trim();
    if (!name) {
      if (customPresetUI.hint) {
        customPresetUI.hint.textContent = 'Bitte gib dem Preset einen Namen.';
      }
      return;
    }
    const notes = customPresetUI.notesInput && customPresetUI.notesInput.value ? customPresetUI.notesInput.value.trim() : '';
    const record = {
      id: createPresetId(name),
      name,
      notes,
      createdAt: Date.now(),
      params: cloneParamsForPreset(),
    };
    userPresetState.items.unshift(record);
    persistUserPresets();
    if (customPresetUI.form) {
      customPresetUI.form.reset();
    }
    if (customPresetUI.hint) {
      customPresetUI.hint.textContent = `Preset „${name}“ gespeichert.`;
    }
    renderUserPresets();
  }

  function setPresetGalleryMode(mode) {
    if (!customPresetUI.gallery) return;
    const next = mode === 'list' ? 'list' : 'grid';
    userPresetState.galleryMode = next;
    customPresetUI.gallery.dataset.mode = next;
    if (customPresetUI.galleryModeButtons.length) {
      customPresetUI.galleryModeButtons.forEach(button => {
        const active = button.dataset.galleryMode === next;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  function updateDistributionChips() {
    if (!patternUI.distributionChips) return;
    const available = new Set(getAvailableDistributions());
    patternUI.distributionChips.querySelectorAll('button[data-distribution]').forEach(button => {
      const type = button.dataset.distribution;
      const supported = available.has(type);
      button.toggleAttribute('hidden', !supported);
      button.disabled = !supported;
      const isActive = supported && type === params.distribution;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) {
        button.dataset.active = 'true';
      } else if (button.dataset.active) {
        delete button.dataset.active;
      }
    });
  }

  function setDistributionFromChip(type) {
    if (!type) return;
    if (type === 'stl') {
      const applied = useStlAsDistribution({ rememberPrevious: true });
      if (!applied) {
        updateDistributionChips();
        return;
      }
      setCurrentPattern('STL-Form', 'Nutze deine importierte STL-Geometrie als Verteilung.');
    } else {
      if (params.distribution === 'stl') {
        revertFromStlDistribution({ fallback: type });
      }
      params.distribution = type;
    }
    rebuildStars();
    updateStarUniforms();
    updateTinyMaterial();
    setSliders();
    if (type !== 'stl') {
      setCurrentPattern('Freestyle');
    }
  }

  function renderDistributionChips() {
    if (!patternUI.distributionChips) return;
    const container = patternUI.distributionChips;
    const existingButtons = new Map();
    container.querySelectorAll('button[data-distribution]').forEach(button => {
      existingButtons.set(button.dataset.distribution, button);
    });
    const available = getAvailableDistributions();
    existingButtons.forEach((button, key) => {
      if (!available.includes(key)) {
        button.remove();
        existingButtons.delete(key);
      }
    });
    available.forEach(type => {
      if (existingButtons.has(type)) {
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.distribution = type;
      button.textContent = getDistributionLabel(type);
      button.addEventListener('click', () => setDistributionFromChip(type));
      container.appendChild(button);
      existingButtons.set(type, button);
    });
    updateDistributionChips();
  }

  function updateStlVisibility() {
    stlGroup.visible = Boolean(stlState.points && stlState.displayMode === 'overlay');
  }

  function updateStlOptionAvailability() {
    if (!stlDistributionOption) return;
    const available = hasStlSamples();
    stlDistributionOption.hidden = available ? false : true;
    stlDistributionOption.disabled = available ? false : true;
  }

  function useStlAsDistribution({ rememberPrevious = true } = {}) {
    if (!hasStlSamples()) {
      return false;
    }
    if (rememberPrevious && params.distribution !== 'stl') {
      stlState.previousDistribution = params.distribution;
    }
    params.distribution = 'stl';
    stlState.displayMode = 'distribution';
    return true;
  }

  function revertFromStlDistribution({ fallback = 'random' } = {}) {
    if (params.distribution !== 'stl') {
      return false;
    }
    const fallbackValue = stlState.previousDistribution && stlState.previousDistribution !== 'stl'
      ? stlState.previousDistribution
      : fallback;
    stlState.previousDistribution = null;
    params.distribution = fallbackValue;
    if (stlState.displayMode === 'distribution') {
      stlState.displayMode = 'overlay';
    }
    return true;
  }

  function mergeStlGeometries(geometries) {
    if (!Array.isArray(geometries) || !geometries.length) {
      return null;
    }
    let totalVertices = 0;
    let hasNormals = true;
    let hasColors = false;
    let alpha = 1;
    geometries.forEach(geometry => {
      if (!geometry || !geometry.getAttribute) {
        return;
      }
      const position = geometry.getAttribute('position');
      if (!position) {
        return;
      }
      totalVertices += position.count;
      if (!geometry.getAttribute('normal')) {
        hasNormals = false;
      }
      if (geometry.hasColors && geometry.getAttribute('color')) {
        hasColors = true;
        if (typeof geometry.alpha === 'number') {
          alpha = Math.min(alpha, geometry.alpha);
        }
      }
    });
    if (!Number.isFinite(totalVertices) || totalVertices <= 0) {
      return null;
    }
    const merged = new THREE.BufferGeometry();
    const positions = new Float32Array(totalVertices * 3);
    const normals = hasNormals ? new Float32Array(totalVertices * 3) : null;
    const colors = hasColors ? new Float32Array(totalVertices * 3) : null;
    let vertexOffset = 0;
    geometries.forEach(geometry => {
      if (!geometry || !geometry.getAttribute) {
        return;
      }
      const position = geometry.getAttribute('position');
      if (!position) {
        return;
      }
      positions.set(position.array, vertexOffset * 3);
      if (hasNormals) {
        const normal = geometry.getAttribute('normal');
        if (normal && normal.count === position.count) {
          normals.set(normal.array, vertexOffset * 3);
        }
      }
      if (hasColors) {
        const colorAttr = geometry.getAttribute('color');
        if (colorAttr && colorAttr.count === position.count) {
          colors.set(colorAttr.array, vertexOffset * 3);
        }
      }
      vertexOffset += position.count;
    });
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (hasNormals && normals) {
      merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      merged.computeVertexNormals();
    }
    if (hasColors && colors) {
      merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      merged.hasColors = true;
      merged.alpha = alpha;
    }
    return merged;
  }

  function ensureStlMaterial() {
    if (stlMaterial) {
      return stlMaterial;
    }
    if (!starMaterial) {
      return null;
    }
    const uniforms = THREE.UniformsUtils.clone(starMaterial.uniforms);
    stlMaterial = new THREE.ShaderMaterial({
      vertexShader: starMaterial.vertexShader,
      fragmentShader: starMaterial.fragmentShader,
      transparent: starMaterial.transparent,
      depthTest: starMaterial.depthTest,
      depthWrite: starMaterial.depthWrite,
      blending: starMaterial.blending,
      uniforms
    });
    return stlMaterial;
  }

  function applyStlGeometry(geometry, fileNames = []) {
    if (!(geometry instanceof THREE.BufferGeometry)) {
      return;
    }
    if (stlState.points) {
      clearStlModels({ keepCamera: true, skipInputReset: true, preserveMeta: true, preserveUsage: true });
    }
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
    }
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere ? geometry.boundingSphere.radius : 0;
    stlState.boundingRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
    const names = Array.isArray(fileNames) ? fileNames : [];
    const positionAttr = geometry.getAttribute ? geometry.getAttribute('position') : null;
    if (!positionAttr || !positionAttr.array || positionAttr.count <= 0) {
      geometry.dispose();
      return;
    }
    const sourceArray = positionAttr.array;
    const sourceCount = positionAttr.count;
    const targetCount = Math.min(sourceCount, MAX_STL_POINTS);
    const seed = hashStringList(names);
    const sampleRand = mulberry32((seed ^ 0x27d4eb2f) >>> 0);
    const indices = new Uint32Array(targetCount);
    if (sourceCount <= targetCount) {
      for (let i = 0; i < targetCount; i++) {
        indices[i] = i;
      }
    } else {
      const step = sourceCount / targetCount;
      for (let i = 0; i < targetCount; i++) {
        const base = i * step;
        let idx = Math.floor(base + sampleRand() * step);
        if (idx >= sourceCount) {
          idx = sourceCount - 1;
        }
        indices[i] = idx;
      }
    }
    const positions = new Float32Array(targetCount * 3);
    const basePositions = new Float32Array(targetCount * 3);
    for (let i = 0; i < targetCount; i++) {
      const srcIndex = indices[i] * 3;
      positions[i * 3] = sourceArray[srcIndex];
      positions[i * 3 + 1] = sourceArray[srcIndex + 1];
      positions[i * 3 + 2] = sourceArray[srcIndex + 2];
      basePositions[i * 3] = sourceArray[srcIndex];
      basePositions[i * 3 + 1] = sourceArray[srcIndex + 1];
      basePositions[i * 3 + 2] = sourceArray[srcIndex + 2];
    }
    const phases = new Float32Array(targetCount);
    const sizes = new Float32Array(targetCount);
    const categories = new Float32Array(targetCount);
    const categoryRand = mulberry32(seed);
    const sizeRand = mulberry32((seed ^ 0x85ebca6b) >>> 0);
    const phaseRand = mulberry32((seed ^ 0x51f32a95) >>> 0);
    for (let i = 0; i < targetCount; i++) {
      phases[i] = phaseRand();
      const catRoll = categoryRand();
      categories[i] = catRoll < 0.25 ? 0 : (catRoll < 0.7 ? 1 : 2);
      sizes[i] = 0.85 + sizeRand() * 0.4;
    }
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeometry.setAttribute('aBase', new THREE.BufferAttribute(basePositions, 3));
    pointGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    pointGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    pointGeometry.setAttribute('aCat', new THREE.BufferAttribute(categories, 1));
    pointGeometry.setDrawRange(0, targetCount);
    pointGeometry.computeBoundingSphere();
    if (pointGeometry.boundingSphere) {
      pointGeometry.boundingSphere.center.set(0, 0, 0);
    }
    const material = ensureStlMaterial();
    if (!material) {
      pointGeometry.dispose();
      return;
    }
    const points = new THREE.Points(pointGeometry, material);
    points.name = 'feldappenVolumePoints';
    stlGroup.add(points);
    stlGroup.position.copy(FELDAPPEN_CENTER);
    stlState.points = points;
    stlState.files = names;
    stlState.samples = basePositions.slice(0);
    stlState.sampleCount = targetCount;
    updateStlOptionAvailability();
    renderDistributionChips();
    updateStlVisibility();
    if (stlState.displayMode === 'distribution') {
      const applied = useStlAsDistribution({ rememberPrevious: true });
      if (applied) {
        rebuildStars();
        setSliders();
      } else {
        stlState.displayMode = 'overlay';
      }
    } else if (params.distribution === 'stl') {
      const reverted = revertFromStlDistribution();
      if (reverted) {
        rebuildStars();
        setSliders();
      }
    }
    updateStlMeta(names);
    updateStlVisibility();
    updateStarUniforms();
    focusOnFeldappenCenter({ repositionCamera: true });
    geometry.dispose();
  }

  function askStlUsageMode(files) {
    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const backdrop = document.createElement('div');
      backdrop.className = 'stl-mode-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      const dialog = document.createElement('div');
      dialog.className = 'stl-mode-dialog';
      const headingId = `stl-mode-heading-${Date.now()}`;
      const title = document.createElement('h2');
      title.id = headingId;
      title.textContent = 'STL-Nutzung wählen';
      dialog.setAttribute('aria-labelledby', headingId);
      const description = document.createElement('p');
      const fileHint = Array.isArray(files) && files.length === 1
        ? `(${files[0].name || 'STL-Datei'})`
        : '';
      description.textContent = fileHint
        ? `Wie sollen die importierten STL-Punkte ${fileHint} verwendet werden?`
        : 'Wie sollen die importierten STL-Punkte verwendet werden?';
      const actions = document.createElement('div');
      actions.className = 'stl-mode-actions';

      const overlayBtn = document.createElement('button');
      overlayBtn.type = 'button';
      overlayBtn.dataset.choice = 'overlay';
      overlayBtn.textContent = 'Zusätzlich anzeigen';

      const distributionBtn = document.createElement('button');
      distributionBtn.type = 'button';
      distributionBtn.dataset.choice = 'distribution';
      distributionBtn.textContent = 'Als Verteilungsalgorithmus nutzen';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.dataset.choice = 'cancel';
      cancelBtn.textContent = 'Abbrechen';

      actions.append(overlayBtn, distributionBtn, cancelBtn);
      dialog.append(title, description, actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      let settled = false;
      const cleanup = choice => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeyDown);
        backdrop.removeEventListener('click', onBackdropClick);
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus();
        }
        resolve(choice);
      };

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cleanup('cancel');
        }
      };

      const onBackdropClick = event => {
        if (event.target === backdrop) {
          cleanup('cancel');
        }
      };

      overlayBtn.addEventListener('click', () => cleanup('overlay'));
      distributionBtn.addEventListener('click', () => cleanup('distribution'));
      cancelBtn.addEventListener('click', () => cleanup('cancel'));
      document.addEventListener('keydown', onKeyDown);
      backdrop.addEventListener('click', onBackdropClick);

      window.requestAnimationFrame(() => {
        overlayBtn.focus();
      });
    });
  }

  async function loadStlFilesFromInput(files) {
    const selection = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!selection.length) {
      clearStlModels();
      return;
    }
    const mode = await askStlUsageMode(selection);
    if (mode === 'cancel') {
      updateStlMeta(stlState.files);
      if (stlUI.input) {
        stlUI.input.value = '';
      }
      return;
    }
    stlState.displayMode = mode === 'distribution' ? 'distribution' : 'overlay';
    updateStlMeta(selection, { loading: true });
    try {
      const geometries = [];
      for (const file of selection) {
        const buffer = await file.arrayBuffer();
        let geometry = stlLoader.parse(buffer);
        if (!geometry) {
          continue;
        }
        if (geometry.index) {
          const nonIndexed = geometry.toNonIndexed();
          geometry.dispose();
          geometry = nonIndexed;
        }
        geometry.computeVertexNormals();
        geometries.push(geometry);
      }
      if (!geometries.length) {
        throw new Error('Keine gültigen STL-Geometrien gefunden.');
      }
      const merged = mergeStlGeometries(geometries);
      geometries.forEach(geometry => geometry.dispose());
      if (!merged) {
        throw new Error('Geometrien konnten nicht kombiniert werden.');
      }
      merged.computeVertexNormals();
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const names = selection.map(file => (file && file.name) ? file.name : 'STL-Datei');
      applyStlGeometry(merged, names);
    } catch (error) {
      console.error('STL-Dateien konnten nicht geladen werden:', error);
      updateStlMeta([], { error: 'Fehler beim Laden der STL-Dateien.' });
      clearStlModels({ keepCamera: true, skipInputReset: true, preserveMeta: true });
    } finally {
      if (stlUI.input) {
        stlUI.input.disabled = false;
        stlUI.input.value = '';
      }
    }
  }

  function getMotionModeIndex() {
    const idx = MOTION_MODES.indexOf(params.motionMode);
    return idx >= 0 ? idx : 0;
  }

  function getColorModeIndex() {
    const idx = COLOR_MODES.indexOf(params.colorMode);
    return idx >= 0 ? idx : 0;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext || null;

  const AUDIO_INTENSITY_DEFAULTS = Object.freeze({
    motion: 1,
    scale: 1,
    size: 1,
    hue: 1,
    saturation: 1,
    brightness: 1,
    alpha: 1
  });

  const AUDIO_INTENSITY_BASE_DEFAULTS = Object.freeze({
    motion: 0.1,
    scale: 1,
    size: 1,
    hue: 1,
    saturation: 1,
    brightness: 1,
    alpha: 1
  });

  const AUDIO_INTENSITY_LIMIT_DEFAULTS = Object.freeze({
    motion: 0.2,
    scale: 1,
    size: 1,
    hue: 1,
    saturation: 1,
    brightness: 1,
    alpha: 1
  });

  const AUDIO_DYNAMIC_INTENSITY_CONFIG = Object.freeze({
    motion: {
      min: 0.45,
      max: 1.55,
      hold: { min: 0.38, max: 1.1 },
      driver: metrics => Math.min(1.2, metrics.energy * 0.6 + metrics.bass * 0.85),
      pulse: 'bass',
      pulseThreshold: 0.08,
      pulseWeight: 0.65,
      randomWeight: 0.4,
      jitter: 0.18,
      damping: 3.8,
      relaxRate: 2.6
    },
    size: {
      min: 0.5,
      max: 1.8,
      hold: { min: 0.42, max: 1.35 },
      driver: metrics => Math.min(1.2, metrics.mid * 0.85 + metrics.wave * 0.65),
      pulse: 'mid',
      pulseThreshold: 0.07,
      pulseWeight: 0.6,
      randomWeight: 0.35,
      jitter: 0.22,
      damping: 3.4,
      relaxRate: 2.4
    },
    hue: {
      min: 0.35,
      max: 1.45,
      hold: { min: 0.52, max: 1.4 },
      driver: metrics => Math.min(1.2, metrics.treble * 0.95 + metrics.energy * 0.45),
      pulse: 'treble',
      pulseThreshold: 0.07,
      pulseWeight: 0.65,
      randomWeight: 0.45,
      jitter: 0.25,
      damping: 2.8,
      relaxRate: 2.2
    },
    saturation: {
      min: 0.45,
      max: 1.6,
      hold: { min: 0.55, max: 1.55 },
      driver: metrics => Math.min(1.2, metrics.treble * 0.9 + metrics.wave * 0.6),
      pulse: 'treble',
      pulseThreshold: 0.06,
      pulseWeight: 0.7,
      randomWeight: 0.4,
      jitter: 0.23,
      damping: 2.9,
      relaxRate: 2.3
    },
    brightness: {
      min: 0.45,
      max: 1.65,
      hold: { min: 0.5, max: 1.45 },
      driver: metrics => Math.min(1.2, metrics.energy * 0.95 + metrics.mid * 0.45),
      pulse: 'energy',
      pulseThreshold: 0.07,
      pulseWeight: 0.7,
      randomWeight: 0.35,
      jitter: 0.19,
      damping: 3.1,
      relaxRate: 2.5
    },
    alpha: {
      min: 0.4,
      max: 1.25,
      hold: { min: 0.55, max: 1.6 },
      driver: metrics => Math.min(1.2, metrics.wave * 0.85 + metrics.energy * 0.55),
      pulse: 'wave',
      pulseThreshold: 0.05,
      pulseWeight: 0.6,
      randomWeight: 0.32,
      jitter: 0.2,
      damping: 3.0,
      relaxRate: 2.4
    }
  });

  const PRESET_AUDIO_DIRECTORY = 'Musik/';
  const PRESET_PLAYLIST_MANIFEST = `${PRESET_AUDIO_DIRECTORY}playlist.json`;

  let presetPlaylistPromise = null;

  const audioState = {
    context: null,
    analyser: null,
    freqData: null,
    timeData: null,
    source: null,
    micStream: null,
    playing: false,
    usingMic: false,
    playlist: [],
    currentIndex: -1,
    selectedFile: null,
    fileName: '',
    repeatMode: 'off',
    status: 'idle',
    metrics: { energy: 0, bass: 0, mid: 0, treble: 0, wave: 0 },
    visual: { motion: 0, size: 1, hue: 0, alpha: 0, scale: 1, saturation: 0, brightness: 0 },
    modifiers: {
      motion: true,
      scale: true,
      size: true,
      hue: true,
      saturation: true,
      brightness: true,
      alpha: true
    },
    intensity: { ...AUDIO_INTENSITY_BASE_DEFAULTS },
    intensityLimits: { ...AUDIO_INTENSITY_LIMIT_DEFAULTS },
    dynamicIntensity: { ...AUDIO_INTENSITY_DEFAULTS },
    dynamicTargets: { ...AUDIO_INTENSITY_DEFAULTS },
    dynamicTimers: {},
    color: new THREE.Color(),
    silenceLevel: 1,
    brightnessAdaptationEnabled: true,
    needsResume: false,
    motionDirection: 1,
    pitchDirection: 1,
    motionFlipCooldown: 0,
    pitchFlipCooldown: 0,
    previousBass: 0,
    previousTreble: 0,
    previousEnergy: 0,
    previousWave: 0,
    previousMid: 0
  };

  const AUDIO_VISUAL_BASE = Object.freeze({
    motion: 0,
    size: 1,
    hue: 0,
    alpha: 0,
    scale: 1,
    saturation: 0,
    brightness: 0
  });

  const audioUI = {
    panel: null,
    body: null,
    toggle: null,
    fileInput: null,
    fileMeta: null,
    playlistMeta: null,
    playlistList: null,
    playlistEmpty: null,
    currentTitle: null,
    currentDetails: null,
    playBtn: null,
    stopBtn: null,
    prevBtn: null,
    nextBtn: null,
    repeatBtn: null,
    micStartBtn: null,
    micStopBtn: null,
    statusText: null,
    statusDot: null,
    modifierButtons: null,
    intensityControls: null,
    supportNotice: null,
    autoRandomBtn: null,
    overlay: null,
    overlayButton: null,
    brightnessAdaptationBtn: null
  };

  const patternUI = {
    presetList: null,
    activeName: null,
    activeDescription: null,
    distributionChips: null,
    randomPresetBtn: null,
    focusBtn: null
  };

  const presetStudioUI = {
    status: null,
    shuffleBtn: null,
    restoreBtn: null,
    copyBtn: null,
  };

  const customPresetUI = {
    form: null,
    nameInput: null,
    notesInput: null,
    hint: null,
    gallery: null,
    emptyState: null,
    galleryModeButtons: [],
    randomBtn: null,
  };

  const autoRandomState = {
    enabled: false,
    elapsed: 0,
    nextTrigger: Infinity,
    nudgeAccumulator: 0,
    minInterval: 12,
    maxInterval: 26,
    nudgeInterval: 0.45,
    mode: 'parameters',
    lastPresetId: null,
  };

  const experienceState = {
    started: false,
    panelsHiddenForPlayback: false,
    previousPanelVisible: null,
    pendingOverlayStart: false,
    editingMode: false,
    editingPreviousPanel: null,
  };

  function clampIntensityPercent(value, fallback = 100, max = 200) {
    const numeric = Number(value);
    const limit = Number.isFinite(max) ? Math.max(0, max) : 200;
    const fallbackValue = Math.max(0, Math.min(limit, Math.round(Number(fallback))));
    if (!Number.isFinite(numeric)) {
      return fallbackValue;
    }
    const rounded = Math.round(numeric / 5) * 5;
    return Math.max(0, Math.min(limit, rounded));
  }

  function getAudioIntensity(key) {
    if (!key || !audioState || !audioState.intensity) {
      return 1;
    }
    if (!(key in audioState.intensity)) {
      const fallback = (key in AUDIO_INTENSITY_BASE_DEFAULTS)
        ? AUDIO_INTENSITY_BASE_DEFAULTS[key]
        : ((key in AUDIO_INTENSITY_DEFAULTS) ? AUDIO_INTENSITY_DEFAULTS[key] : 1);
      audioState.intensity[key] = Number.isFinite(fallback) ? fallback : 1;
    }
    const base = audioState.intensity[key];
    const baseValue = Number.isFinite(base) ? Math.max(0, base) : 1;
    const dynamicSource = audioState.dynamicIntensity && key in audioState.dynamicIntensity
      ? audioState.dynamicIntensity[key]
      : 1;
    const dynamicValue = Number.isFinite(dynamicSource) ? Math.max(0, dynamicSource) : 1;
    return baseValue * (dynamicValue || 1);
  }

  function getAudioIntensityLimit(key) {
    if (!key || !audioState) {
      return 1;
    }
    if (!audioState.intensityLimits) {
      audioState.intensityLimits = { ...AUDIO_INTENSITY_LIMIT_DEFAULTS };
    }
    if (!(key in audioState.intensityLimits)) {
      const fallback = (key in AUDIO_INTENSITY_LIMIT_DEFAULTS) ? AUDIO_INTENSITY_LIMIT_DEFAULTS[key] : 1;
      audioState.intensityLimits[key] = Number.isFinite(fallback) ? fallback : 1;
    }
    const limit = audioState.intensityLimits[key];
    return Number.isFinite(limit) && limit >= 0 ? limit : 1;
  }

  function syncAudioIntensityControls() {
    if (!audioUI.intensityControls || typeof audioUI.intensityControls.forEach !== 'function') {
      return;
    }
    const modifiers = audioState.modifiers || {};
    audioUI.intensityControls.forEach(({ input, valueEl, container, limitInput }, key) => {
      const limit = getAudioIntensityLimit(key);
      const base = audioState.intensity && key in audioState.intensity
        ? audioState.intensity[key]
        : (AUDIO_INTENSITY_BASE_DEFAULTS[key] || 1);
      const limitPercent = clampIntensityPercent(limit * 100, (AUDIO_INTENSITY_LIMIT_DEFAULTS[key] || 1) * 100, 200);
      const percent = limit > 0
        ? clampIntensityPercent((Number.isFinite(base) ? base : limit) / limit * 100, 0, 100)
        : 0;
      const enabled = modifiers[key] !== false;
      if (input) {
        if (document.activeElement !== input) {
          input.value = String(percent);
        }
        input.setAttribute('aria-valuenow', String(percent));
        input.toggleAttribute('disabled', !enabled);
        input.setAttribute('aria-disabled', String(!enabled));
        input.setAttribute('aria-valuemax', '100');
        input.setAttribute('aria-valuemin', '0');
      }
      if (limitInput && document.activeElement !== limitInput) {
        limitInput.value = String(limitPercent);
      }
      if (valueEl) {
        valueEl.textContent = `${percent}% (Max ${limitPercent}%)`;
        valueEl.setAttribute('title', `Aktuell ${percent}% von ${limitPercent}%`);
      }
      if (container) {
        container.classList.toggle('is-disabled', !enabled);
      }
    });
  }

  function setAudioIntensity(key, percentValue) {
    if (!key || !(key in AUDIO_INTENSITY_DEFAULTS)) {
      return;
    }
    const limit = getAudioIntensityLimit(key);
    const clampedPercent = clampIntensityPercent(percentValue, 100, 100);
    if (!audioState.intensity) {
      audioState.intensity = { ...AUDIO_INTENSITY_BASE_DEFAULTS };
    }
    const nextValue = limit > 0 ? (clampedPercent / 100) * limit : 0;
    audioState.intensity[key] = clampValue(nextValue, 0, Math.max(limit, 0));
    syncAudioIntensityControls();
    applyAudioVisualState();
  }

  function setAudioIntensityLimit(key, percentValue, { preserveRatio = true } = {}) {
    if (!key || !(key in AUDIO_INTENSITY_DEFAULTS)) {
      return;
    }
    const defaultPercent = (AUDIO_INTENSITY_LIMIT_DEFAULTS[key] || 1) * 100;
    const clampedPercent = clampIntensityPercent(percentValue, defaultPercent, 200);
    if (!audioState.intensityLimits) {
      audioState.intensityLimits = { ...AUDIO_INTENSITY_LIMIT_DEFAULTS };
    }
    const previousLimit = getAudioIntensityLimit(key);
    const nextLimit = clampedPercent / 100;
    audioState.intensityLimits[key] = nextLimit;
    if (!audioState.intensity) {
      audioState.intensity = { ...AUDIO_INTENSITY_BASE_DEFAULTS };
    }
    const currentBase = audioState.intensity[key] ?? (AUDIO_INTENSITY_BASE_DEFAULTS[key] || nextLimit || 1);
    let nextBase = currentBase;
    if (preserveRatio && previousLimit > 0) {
      const ratio = Number.isFinite(currentBase) ? currentBase / previousLimit : 0;
      nextBase = nextLimit > 0 ? ratio * nextLimit : 0;
    }
    nextBase = clampValue(Number.isFinite(nextBase) ? nextBase : 0, 0, Math.max(nextLimit, 0));
    audioState.intensity[key] = nextBase;
    syncAudioIntensityControls();
    applyAudioVisualState();
  }

  function isBrightnessAdaptationEnabled() {
    return audioState && audioState.brightnessAdaptationEnabled !== false;
  }

  function updateBrightnessAdaptationButton() {
    if (!audioUI.brightnessAdaptationBtn) {
      return;
    }
    const enabled = isBrightnessAdaptationEnabled();
    audioUI.brightnessAdaptationBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    audioUI.brightnessAdaptationBtn.textContent = enabled ? '🌗 Adaption an' : '🌗 Adaption aus';
  }

  function setBrightnessAdaptationEnabled(enabled) {
    if (!audioState) {
      return;
    }
    audioState.brightnessAdaptationEnabled = Boolean(enabled);
    updateBrightnessAdaptationButton();
    applyAudioVisualState();
  }

  function applyIntensityToTarget(rawValue, key, base = 0, { min, max } = {}) {
    const intensity = Math.max(0, getAudioIntensity(key));
    let result = Number(rawValue);
    if (!Number.isFinite(result)) {
      result = base;
    }
    if (Number.isFinite(base)) {
      result = base + (result - base) * intensity;
    } else {
      result *= intensity;
    }
    if (Number.isFinite(min)) {
      result = Math.max(min, result);
    }
    if (Number.isFinite(max)) {
      result = Math.min(max, result);
    }
    return result;
  }

  function updateAudioIntensityDynamics(delta, metrics, pulses, playing) {
    if (!audioState.dynamicIntensity) {
      audioState.dynamicIntensity = { ...AUDIO_INTENSITY_DEFAULTS };
    }
    if (!audioState.dynamicTargets) {
      audioState.dynamicTargets = { ...AUDIO_INTENSITY_DEFAULTS };
    }
    if (!audioState.dynamicTimers) {
      audioState.dynamicTimers = {};
    }
    const configEntries = Object.entries(AUDIO_DYNAMIC_INTENSITY_CONFIG);
    const modifiers = audioState.modifiers || {};
    if (!playing) {
      configEntries.forEach(([key, cfg]) => {
        const relax = Number.isFinite(cfg?.relaxRate) ? cfg.relaxRate : 2.4;
        const current = Number.isFinite(audioState.dynamicIntensity[key]) ? audioState.dynamicIntensity[key] : 1;
        audioState.dynamicIntensity[key] = damp(current, 1, relax, delta);
        audioState.dynamicTargets[key] = 1;
        audioState.dynamicTimers[key] = 0;
      });
      return;
    }
    configEntries.forEach(([key, cfg]) => {
      const modifierActive = modifiers[key] !== false;
      const current = Number.isFinite(audioState.dynamicIntensity[key]) ? audioState.dynamicIntensity[key] : 1;
      if (!modifierActive) {
        const relax = Number.isFinite(cfg?.relaxRate) ? cfg.relaxRate : 2.5;
        audioState.dynamicIntensity[key] = damp(current, 1, relax, delta);
        audioState.dynamicTargets[key] = 1;
        audioState.dynamicTimers[key] = 0;
        return;
      }
      const hold = cfg && cfg.hold ? cfg.hold : { min: 0.45, max: 1.2 };
      const holdMin = Number.isFinite(hold.min) ? Math.max(0.1, hold.min) : 0.45;
      const holdMaxRaw = Number.isFinite(hold.max) ? hold.max : holdMin + 0.8;
      const holdMax = Math.max(holdMin + 0.05, holdMaxRaw);
      const timerBaseline = Number.isFinite(audioState.dynamicTimers[key])
        ? audioState.dynamicTimers[key]
        : randomRange(holdMin, holdMax);
      let timer = timerBaseline - delta;
      audioState.dynamicTimers[key] = timer;
      const driverFn = typeof cfg.driver === 'function' ? cfg.driver : () => 0;
      const drive = clampValue(driverFn(metrics || {}, pulses || {}, playing) || 0, 0, 1.2);
      const jitter = cfg && Number.isFinite(cfg.jitter) ? cfg.jitter : 0;
      const jitterValue = jitter > 0 ? clampValue(randomRange(-jitter, jitter), -jitter, jitter) : 0;
      const pulseKey = cfg && cfg.pulse ? cfg.pulse : 'energy';
      const pulseValue = pulses && Number.isFinite(pulses[pulseKey]) ? Math.max(0, pulses[pulseKey]) : 0;
      const threshold = cfg && Number.isFinite(cfg.pulseThreshold) ? cfg.pulseThreshold : 0.08;
      if (timer <= 0 || pulseValue > threshold) {
        const randomWeight = cfg && Number.isFinite(cfg.randomWeight) ? cfg.randomWeight : 0.3;
        const pulseWeight = cfg && Number.isFinite(cfg.pulseWeight) ? cfg.pulseWeight : 0.5;
        const combined = clampValue(
          drive + jitterValue + pulseValue * pulseWeight + randomRange(0, randomWeight),
          0,
          1.2
        );
        const minVal = cfg && Number.isFinite(cfg.min) ? Math.max(0, cfg.min) : 0.35;
        const maxVal = cfg && Number.isFinite(cfg.max) ? Math.max(minVal + 0.05, cfg.max) : Math.max(minVal + 0.05, 1.5);
        const target = clampValue(minVal + (maxVal - minVal) * Math.min(1, combined), minVal, maxVal);
        audioState.dynamicTargets[key] = target;
        timer = randomRange(holdMin, holdMax);
        audioState.dynamicTimers[key] = timer;
      }
      const targetValue = Number.isFinite(audioState.dynamicTargets[key])
        ? clampValue(audioState.dynamicTargets[key], cfg?.min ?? 0.35, cfg?.max ?? 1.5)
        : 1;
      const damping = cfg && Number.isFinite(cfg.damping) ? cfg.damping : 3;
      const eased = damp(current, targetValue, damping, delta);
      const minClamp = cfg && Number.isFinite(cfg.min) ? cfg.min : 0.3;
      const maxClamp = cfg && Number.isFinite(cfg.max) ? cfg.max : 1.6;
      audioState.dynamicIntensity[key] = clampValue(eased, minClamp, maxClamp);
    });
  }

  const audioBandVector = new THREE.Vector3();

  function applyAudioVisualState(modifiers = audioState.modifiers || {}) {
    const sizeIntensity = modifiers.size ? Math.max(0, getAudioIntensity('size')) : 0;
    const effectiveSizeIntensity = sizeIntensity > 0 ? Math.min(1.5, Math.max(0.35, sizeIntensity)) : 0;
    const rawSize = clampValue(audioState.visual.size, 0.2, 4.5);
    const sizeBoost = modifiers.size
      ? 1 + (rawSize - 1) * effectiveSizeIntensity
      : AUDIO_VISUAL_BASE.size;
    const hueOffset = modifiers.hue ? clampValue(audioState.visual.hue, -540, 540) : AUDIO_VISUAL_BASE.hue;
    const saturationDelta = modifiers.saturation
      ? clampValue(audioState.visual.saturation, -0.35, 0.9)
      : AUDIO_VISUAL_BASE.saturation;
    const brightnessDelta = modifiers.brightness
      ? clampValue(audioState.visual.brightness, -0.35, 1.05)
      : AUDIO_VISUAL_BASE.brightness;
    const hue = ((params.pointHue + hueOffset) % 360 + 360) % 360;
    const baseSaturation = clampValue(params.pointSaturation + saturationDelta, 0.05, 1.4);
    const baseBrightness = clampValue(params.pointValue + brightnessDelta, 0.05, 1.6);
    const saturationIntensity = modifiers.saturation ? Math.max(0, getAudioIntensity('saturation')) : 0;
    const brightnessIntensity = modifiers.brightness ? Math.max(0, getAudioIntensity('brightness')) : 0;
    const effectiveSaturationIntensity = saturationIntensity > 0 ? Math.min(1.6, Math.max(0.25, saturationIntensity)) : 0;
    const effectiveBrightnessIntensity = brightnessIntensity > 0 ? Math.min(1.6, Math.max(0.25, brightnessIntensity)) : 0;
    const saturationBoost = modifiers.saturation
      ? audioState.metrics.treble * 0.22 * effectiveSaturationIntensity
      : 0;
    const brightnessBoost = modifiers.brightness
      ? audioState.metrics.energy * 0.32 * effectiveBrightnessIntensity
      : 0;
    const brightnessAdaptationEnabled = isBrightnessAdaptationEnabled();
    const silenceLevel = clampValue(Number.isFinite(audioState.silenceLevel) ? audioState.silenceLevel : 0, 0, 1);
    const minVisibility = 0.08;
    const visibilityFactor = brightnessAdaptationEnabled
      ? minVisibility + (1 - silenceLevel) * (1 - minVisibility)
      : 1;
    const saturation = clampValue(baseSaturation + saturationBoost * visibilityFactor, 0.05, 1.4);
    const brightness = clampValue((baseBrightness + brightnessBoost) * visibilityFactor, 0.05, 1.6);
    const reactiveColor = hsv2rgb(hue, saturation, brightness);
    audioState.color.copy(reactiveColor);

    const scaleIntensity = modifiers.scale ? Math.max(0, getAudioIntensity('scale')) : 0;
    const effectiveScaleIntensity = scaleIntensity > 0 ? Math.min(1.5, Math.max(0.35, scaleIntensity)) : 0;
    const rawScale = clampValue(audioState.visual.scale, 0.25, 3.5);
    const sphereScale = modifiers.scale
      ? Math.max(0.25, Math.min(3.5, 1 + (rawScale - 1) * effectiveScaleIntensity))
      : AUDIO_VISUAL_BASE.scale;
    if (Number.isFinite(sphereScale)) {
      if (Math.abs(clusterGroup.scale.x - sphereScale) > 1e-4 ||
          Math.abs(clusterGroup.scale.y - sphereScale) > 1e-4 ||
          Math.abs(clusterGroup.scale.z - sphereScale) > 1e-4) {
        clusterGroup.scale.setScalar(sphereScale);
      }
    }

    const bandGain = 0.75 + Math.max(0, getAudioIntensity('scale')) * 0.75;
    const bassValue = Math.min(3, audioState.metrics.bass * bandGain);
    const midValue = Math.min(3, audioState.metrics.mid * bandGain * 0.92);
    const trebleValue = Math.min(3, audioState.metrics.treble * bandGain * 1.08);
    audioBandVector.set(bassValue, midValue, trebleValue);
    const energyUniform = Math.min(3, audioState.metrics.energy * (0.8 + Math.max(0, getAudioIntensity('motion')) * 0.7));
    const waveUniform = Math.min(3, audioState.metrics.wave * (0.8 + Math.max(0, getAudioIntensity('size')) * 0.7));

    const baseAlpha = params.pointAlpha;
    const alphaVisual = modifiers.alpha ? clampValue(audioState.visual.alpha, 0, 1.2) : AUDIO_VISUAL_BASE.alpha;
    const boostedAlpha = Math.max(0.05, Math.min(1, (baseAlpha + alphaVisual) * visibilityFactor));
    const applyAudioToPointMaterial = material => {
      if (!material || !material.uniforms) {
        return;
      }
      const uniforms = material.uniforms;
      if (uniforms.uAudioBands && uniforms.uAudioBands.value) {
        uniforms.uAudioBands.value.copy(audioBandVector);
      }
      if (uniforms.uAudioEnergy) {
        uniforms.uAudioEnergy.value = energyUniform;
      }
      if (uniforms.uAudioWave) {
        uniforms.uAudioWave.value = waveUniform;
      }
      if (uniforms.uSizeFactorSmall) {
        uniforms.uSizeFactorSmall.value = params.sizeFactorSmall * sizeBoost;
      }
      if (uniforms.uSizeFactorMedium) {
        uniforms.uSizeFactorMedium.value = params.sizeFactorMedium * sizeBoost;
      }
      if (uniforms.uSizeFactorLarge) {
        uniforms.uSizeFactorLarge.value = params.sizeFactorLarge * sizeBoost;
      }
      if (uniforms.uAlpha) {
        uniforms.uAlpha.value = boostedAlpha;
      }
      if (uniforms.uColor) {
        uniforms.uColor.value.copy(audioState.color);
      }
      material.needsUpdate = true;
    };
    applyAudioToPointMaterial(starMaterial);
    applyAudioToPointMaterial(stlMaterial);

    if (stlMaterial && stlMaterial.uniforms) {
      if (stlMaterial.uniforms.uAudioBands && stlMaterial.uniforms.uAudioBands.value) {
        stlMaterial.uniforms.uAudioBands.value.copy(audioBandVector);
      }
      if (stlMaterial.uniforms.uAudioEnergy) {
        stlMaterial.uniforms.uAudioEnergy.value = energyUniform;
      }
      if (stlMaterial.uniforms.uAudioWave) {
        stlMaterial.uniforms.uAudioWave.value = waveUniform;
      }
      if (stlMaterial.uniforms.uSizeFactorSmall) {
        stlMaterial.uniforms.uSizeFactorSmall.value = params.sizeFactorSmall * sizeBoost;
      }
      if (stlMaterial.uniforms.uSizeFactorMedium) {
        stlMaterial.uniforms.uSizeFactorMedium.value = params.sizeFactorMedium * sizeBoost;
      }
      if (stlMaterial.uniforms.uSizeFactorLarge) {
        stlMaterial.uniforms.uSizeFactorLarge.value = params.sizeFactorLarge * sizeBoost;
      }
      if (stlMaterial.uniforms.uAlpha) {
        const baseAlpha = params.pointAlpha;
        const alphaVisual = modifiers.alpha ? clampValue(audioState.visual.alpha, 0, 1.2) : AUDIO_VISUAL_BASE.alpha;
        const boostedAlpha = Math.max(0.05, Math.min(1, (baseAlpha + alphaVisual) * visibilityFactor));
        stlMaterial.uniforms.uAlpha.value = boostedAlpha;
      }
      if (stlMaterial.uniforms.uColor) {
        stlMaterial.uniforms.uColor.value.copy(audioState.color);
      }
    }

    if (tinyMaterial && tinyMaterial.uniforms) {
      if (tinyMaterial.uniforms.uAudioBands && tinyMaterial.uniforms.uAudioBands.value) {
        tinyMaterial.uniforms.uAudioBands.value.copy(audioBandVector);
      }
      if (tinyMaterial.uniforms.uAudioEnergy) {
        tinyMaterial.uniforms.uAudioEnergy.value = energyUniform;
      }
      if (tinyMaterial.uniforms.uAudioWave) {
        tinyMaterial.uniforms.uAudioWave.value = waveUniform;
      }
      const waveContribution = modifiers.size ? waveUniform : 0;
      const tinySize = params.sizeFactorTiny * Math.max(0.05, 0.8 + sizeBoost * 0.2 + waveContribution * 0.25);
      if (tinyMaterial.uniforms.uSize) {
        tinyMaterial.uniforms.uSize.value = tinySize;
      }
      if (tinyMaterial.uniforms.uAlpha) {
        const baseTinyAlpha = params.tinyAlpha;
        const alphaVisual = modifiers.alpha ? clampValue(audioState.visual.alpha, 0, 1.2) : AUDIO_VISUAL_BASE.alpha;
        const boostedTinyAlpha = Math.min(1, (baseTinyAlpha + alphaVisual * 0.4) * visibilityFactor);
        tinyMaterial.uniforms.uAlpha.value = boostedTinyAlpha;
      }
      if (tinyMaterial.uniforms.uColor) {
        tinyMaterial.uniforms.uColor.value.copy(audioState.color);
      }
    }
  }

  function applyAudioMotion(delta, modifiers = audioState.modifiers || {}) {
    if (!modifiers.motion) {
      return;
    }
    const motionIntensity = Math.max(0, getAudioIntensity('motion'));
    const rotationStrength = clampValue(audioState.visual.motion, 0, 4.5);
    if (rotationStrength <= 1e-4 || motionIntensity <= 0) {
      return;
    }
    const effectiveMotion = Math.max(0.4, motionIntensity);
    const yaw = rotationStrength * audioState.motionDirection * delta * (0.75 + effectiveMotion * 1.15);
    const waveTilt = clampValue(audioState.metrics.wave * (0.35 + effectiveMotion * 0.55), -3.5, 3.5);
    const pitch = waveTilt * audioState.pitchDirection * delta * (0.6 + effectiveMotion * 0.4);
    const rollBase = clampValue(audioState.metrics.treble * (0.26 + effectiveMotion * 0.4), 0, 3.2);
    const rollDirection = audioState.motionDirection >= 0 ? 1 : -1;
    const roll = rollBase * rollDirection * delta * (0.4 + effectiveMotion * 0.35);
    if (Number.isFinite(yaw) && Math.abs(yaw) < Math.PI) {
      clusterGroup.rotateY(yaw);
    }
    if (Number.isFinite(pitch) && Math.abs(pitch) < Math.PI) {
      clusterGroup.rotateX(pitch);
    }
    if (Number.isFinite(roll) && Math.abs(roll) < Math.PI) {
      clusterGroup.rotateZ(roll);
    }
  }

  function resetAudioReactivity() {
    resetAudioMetrics();
    applyAudioVisualState();
  }

  function isAudioSupported() {
    return !!AudioContextClass;
  }

  function isMicSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function ensureAudioContext() {
    if (!AudioContextClass) {
      throw new Error('Web Audio API nicht verfügbar');
    }
    if (!audioState.context) {
      audioState.context = new AudioContextClass();
    }
    return audioState.context;
  }

  function ensureAnalyser(context) {
    if (!audioState.analyser) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      audioState.analyser = analyser;
      audioState.freqData = new Uint8Array(analyser.frequencyBinCount);
      audioState.timeData = new Uint8Array(analyser.fftSize);
    }
    return audioState.analyser;
  }

  function decodeAudioBuffer(context, arrayBuffer) {
    return new Promise((resolve, reject) => {
      const maybePromise = context.decodeAudioData(arrayBuffer, resolve, reject);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve, reject);
      }
    });
  }

  function resetAudioMetrics() {
    audioState.metrics.energy = 0;
    audioState.metrics.bass = 0;
    audioState.metrics.mid = 0;
    audioState.metrics.treble = 0;
    audioState.metrics.wave = 0;
    audioState.visual.motion = 0;
    audioState.visual.size = 1;
    audioState.visual.hue = 0;
    audioState.visual.alpha = 0;
    audioState.visual.scale = 1;
    audioState.visual.saturation = 0;
    audioState.visual.brightness = 0;
    audioState.motionDirection = 1;
    audioState.pitchDirection = 1;
    audioState.motionFlipCooldown = 0;
    audioState.pitchFlipCooldown = 0;
    audioState.previousBass = 0;
    audioState.previousTreble = 0;
    audioState.previousEnergy = 0;
    audioState.previousWave = 0;
    audioState.previousMid = 0;
    audioState.silenceLevel = 1;
    if (!audioState.dynamicIntensity) {
      audioState.dynamicIntensity = { ...AUDIO_INTENSITY_DEFAULTS };
    } else {
      Object.keys(AUDIO_INTENSITY_DEFAULTS).forEach(key => {
        audioState.dynamicIntensity[key] = 1;
      });
    }
    audioState.dynamicTargets = { ...AUDIO_INTENSITY_DEFAULTS };
    audioState.dynamicTimers = {};
  }

  function disconnectAnalyser() {
    if (audioState.analyser) {
      try { audioState.analyser.disconnect(); } catch (err) { /* ignore */ }
    }
  }

  function stopAudioPlayback({ suspendContext = false, skipUiUpdates = false } = {}) {
    const wasActive = audioState.playing || audioState.usingMic;
    if (audioState.source) {
      try { audioState.source.disconnect(); } catch (err) { /* ignore */ }
      if (typeof audioState.source.stop === 'function') {
        try { audioState.source.stop(); } catch (err) { /* ignore */ }
      }
    }
    audioState.source = null;
    if (audioState.micStream) {
      audioState.micStream.getTracks().forEach(track => track.stop());
    }
    audioState.micStream = null;
    audioState.playing = false;
    audioState.usingMic = false;
    disconnectAnalyser();
    resetAudioReactivity();
    if (!skipUiUpdates && (wasActive || experienceState.panelsHiddenForPlayback)) {
      notifyPlaybackStopped();
    }
    if (audioState.context && suspendContext && typeof audioState.context.suspend === 'function') {
      audioState.context.suspend().catch(() => {});
    }
  }

  function setAudioStatus(message, state = 'idle') {
    audioState.status = state;
    if (audioUI.statusText) {
      audioUI.statusText.textContent = message;
      audioUI.statusText.dataset.state = state;
    }
    if (audioUI.statusDot) {
      audioUI.statusDot.dataset.state = state;
    }
    updateAudioOverlayVisibility();
  }

  function setAudioModifier(key, enabled) {
    if (!audioState.modifiers || !(key in audioState.modifiers)) return;
    audioState.modifiers[key] = Boolean(enabled);
    if (!audioState.modifiers[key] && AUDIO_VISUAL_BASE[key] !== undefined && audioState.visual && key in audioState.visual) {
      audioState.visual[key] = AUDIO_VISUAL_BASE[key];
      if (key === 'motion') {
        audioState.motionDirection = 1;
        audioState.pitchDirection = 1;
      }
    }
    refreshAudioUI();
    applyAudioVisualState();
  }

  function toggleAudioModifier(key) {
    if (!audioState.modifiers || !(key in audioState.modifiers)) return;
    setAudioModifier(key, !audioState.modifiers[key]);
  }

  function shouldShowAudioOverlay() {
    if (!audioUI.overlay) return false;
    if (!isAudioSupported()) return false;
    if (experienceState.editingMode) return false;
    if (audioState.playing || audioState.usingMic) return false;
    if (audioState.status === 'waiting' || audioState.status === 'error') return false;
    return true;
  }

  function updateAudioOverlayVisibility() {
    if (!audioUI.overlay) return;
    const visible = shouldShowAudioOverlay();
    audioUI.overlay.dataset.visible = visible ? 'true' : 'false';
    audioUI.overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (audioUI.overlayButton) {
      if (visible) {
        audioUI.overlayButton.disabled = false;
        audioUI.overlayButton.removeAttribute('aria-busy');
        audioUI.overlayButton.removeAttribute('tabindex');
      } else {
        audioUI.overlayButton.setAttribute('tabindex', '-1');
      }
    }
  }

  function refreshAudioUI() {
    if (!audioUI.playBtn) return;
    const supportedAudio = isAudioSupported();
    const supportedMic = isMicSupported();
    if (audioUI.supportNotice) {
      let noticeText = 'Nutze eine Datei oder das Mikrofon, um die Punktfarben an Audio zu koppeln.';
      let noticeState = 'info';
      if (!supportedAudio) {
        noticeText = 'Audio-Reaktivität wird in diesem Browser nicht unterstützt.';
        noticeState = 'error';
      } else if (!supportedMic) {
        noticeText = 'Mikrofonzugriff nicht verfügbar – nutze eine Datei.';
        noticeState = 'warning';
      }
      audioUI.supportNotice.textContent = noticeText;
      audioUI.supportNotice.dataset.state = noticeState;
    }
    if (audioUI.fileInput) {
      audioUI.fileInput.disabled = !supportedAudio;
    }
    const playlistLength = getPlaylistLength();
    const hasFiles = playlistLength > 0;
    const usingMic = audioState.usingMic;
    const hasTrack = hasFiles && Boolean(audioState.selectedFile);
    audioUI.playBtn.disabled = !supportedAudio || !hasTrack || audioState.playing;
    if (audioUI.stopBtn) {
      audioUI.stopBtn.disabled = !supportedAudio || (!audioState.playing && !audioState.usingMic);
    }
    if (audioUI.prevBtn) {
      audioUI.prevBtn.disabled = !supportedAudio || !hasFiles || playlistLength <= 1 || usingMic;
    }
    if (audioUI.nextBtn) {
      audioUI.nextBtn.disabled = !supportedAudio || !hasFiles || playlistLength <= 1 || usingMic;
    }
    updateRepeatButton(!supportedAudio || !hasFiles);
    if (audioUI.micStartBtn) {
      audioUI.micStartBtn.disabled = !supportedAudio || !supportedMic || audioState.playing;
    }
    if (audioUI.micStopBtn) {
      audioUI.micStopBtn.disabled = !supportedAudio || !audioState.playing || !audioState.usingMic;
    }
    if (!supportedAudio) {
      setAudioStatus('Web Audio API wird nicht unterstützt.', 'error');
    } else if (!supportedMic) {
      // only show info if mic UI exists and audio supported
      if (audioUI.micStartBtn) {
        audioUI.micStartBtn.title = 'Kein Mikrofonzugriff verfügbar';
      }
    } else if (audioUI.micStartBtn) {
      audioUI.micStartBtn.removeAttribute('title');
    }
    if (audioUI.modifierButtons && audioUI.modifierButtons.length) {
      audioUI.modifierButtons.forEach(button => {
        const key = button.dataset.modifier;
        const active = key && audioState.modifiers ? Boolean(audioState.modifiers[key]) : false;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    updateAudioFileMeta(audioState.selectedFile);
    syncAudioIntensityControls();
    if (audioUI.autoRandomBtn) {
      if (!supportedAudio && autoRandomState.enabled) {
        setAutoRandomEnabled(false);
      }
      updateAutoRandomButton(!supportedAudio);
    }
    renderPlaylist({ preserveScroll: true });
    updateAudioOverlayVisibility();
  }

  function getPlaylistLength() {
    return Array.isArray(audioState.playlist) ? audioState.playlist.length : 0;
  }

  function clampTrackIndex(index) {
    const total = getPlaylistLength();
    if (total <= 0) {
      audioState.currentIndex = -1;
      return -1;
    }
    const clamped = Math.max(0, Math.min(total - 1, Number(index) || 0));
    if (audioState.currentIndex !== clamped) {
      audioState.currentIndex = clamped;
    }
    return clamped;
  }

  function isPresetTrack(file) {
    return file instanceof PresetAudioFile;
  }

  function getTrackIdentifier(file) {
    if (!file) return '';
    if (isPresetTrack(file)) {
      return `preset:${file.src || file.name || ''}`;
    }
    const name = file.name || '';
    const size = Number(file.size) || 0;
    const modified = Number(file.lastModified) || 0;
    return `upload:${name}:${size}:${modified}`;
  }

  function describePlaylistItem(file, index) {
    const name = file ? (file.name || `Titel ${index + 1}`) : `Titel ${index + 1}`;
    const metaParts = [];
    if (isPresetTrack(file)) {
      metaParts.push('Preset-Track');
    } else {
      metaParts.push('Eigene Datei');
    }
    const sizeLabel = formatFileSize(file ? file.size : 0);
    if (sizeLabel) {
      metaParts.push(sizeLabel);
    }
    return {
      title: name,
      meta: metaParts.join(' · ')
    };
  }

  function renderPlaylist({ preserveScroll = true } = {}) {
    if (!audioUI.playlistList) return;
    const listEl = audioUI.playlistList;
    const currentScroll = preserveScroll ? listEl.scrollTop : 0;
    listEl.innerHTML = '';
    const playlist = Array.isArray(audioState.playlist) ? audioState.playlist : [];
    if (audioUI.playlistEmpty) {
      audioUI.playlistEmpty.hidden = playlist.length > 0;
    }
    if (!playlist.length) {
      return;
    }
    playlist.forEach((file, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'audio-playlist__item';
      button.dataset.index = String(index);
      const { title, meta } = describePlaylistItem(file, index);
      const titleSpan = document.createElement('span');
      titleSpan.className = 'audio-playlist__item-title';
      titleSpan.textContent = title;
      button.appendChild(titleSpan);
      if (meta) {
        const metaSpan = document.createElement('span');
        metaSpan.className = 'audio-playlist__item-meta';
        metaSpan.textContent = meta;
        button.appendChild(metaSpan);
      }
      const active = index === audioState.currentIndex;
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      listEl.appendChild(button);
    });
    if (preserveScroll) {
      listEl.scrollTop = currentScroll;
    }
  }

  function formatFileSize(bytes = 0) {
    const size = Number(bytes) || 0;
    if (size <= 0) return '';
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatRepeatMode(mode) {
    switch (mode) {
      case 'one':
        return 'Repeat: Track';
      case 'all':
        return 'Repeat: Alle';
      default:
        return 'Repeat aus';
    }
  }

  function updateRepeatButton(disabled = false) {
    if (!audioUI.repeatBtn) return;
    const mode = audioState.repeatMode || 'off';
    let label = '🔁 Repeat aus';
    if (mode === 'all') {
      label = '🔁 Repeat alle';
    } else if (mode === 'one') {
      label = '🔂 Repeat Track';
    }
    audioUI.repeatBtn.textContent = label;
    audioUI.repeatBtn.setAttribute('aria-pressed', mode === 'off' ? 'false' : 'true');
    audioUI.repeatBtn.disabled = disabled;
    if (disabled) {
      audioUI.repeatBtn.setAttribute('aria-disabled', 'true');
    } else {
      audioUI.repeatBtn.removeAttribute('aria-disabled');
    }
  }

  function updateAudioFileMeta(file) {
    const total = getPlaylistLength();
    const hasFiles = total > 0;
    const currentIndex = hasFiles ? clampTrackIndex(audioState.currentIndex) : -1;
    const activeFile = hasFiles ? (file || audioState.playlist[currentIndex] || null) : null;
    if (hasFiles && activeFile !== audioState.selectedFile) {
      audioState.selectedFile = activeFile;
      audioState.fileName = activeFile ? (activeFile.name || 'Audio') : '';
    } else if (!hasFiles && audioState.selectedFile) {
      audioState.selectedFile = null;
      audioState.fileName = '';
    }
    const activeName = activeFile ? (activeFile.name || 'Audio') : 'Keine Auswahl';
    if (audioUI.fileMeta) {
      if (!activeFile) {
        audioUI.fileMeta.textContent = hasFiles ? 'Datei nicht verfügbar' : 'Keine Auswahl';
      } else {
        const sizeLabel = formatFileSize(activeFile.size);
        audioUI.fileMeta.textContent = sizeLabel ? `${activeName} · ${sizeLabel}` : activeName;
      }
    }
    if (audioUI.currentTitle) {
      audioUI.currentTitle.textContent = activeName;
    }
    if (audioUI.currentDetails) {
      let detailText = '';
      if (activeFile) {
        const position = currentIndex >= 0 ? `Titel ${currentIndex + 1} von ${total}` : '';
        const origin = isPresetTrack(activeFile) ? 'Preset-Track' : 'Eigene Datei';
        const size = formatFileSize(activeFile.size);
        detailText = [position, origin, size].filter(Boolean).join(' · ');
      } else if (hasFiles) {
        const position = currentIndex >= 0 ? `Titel ${currentIndex + 1} von ${total}` : '';
        detailText = position ? `${position} · Datei nicht verfügbar` : 'Datei nicht verfügbar';
      } else {
        detailText = 'Lade eigene Songs oder nutze die Preset-Playlist.';
      }
      audioUI.currentDetails.textContent = detailText;
    }
    if (audioUI.playlistMeta) {
      if (!hasFiles) {
        audioUI.playlistMeta.textContent = 'Keine Playlist geladen';
      } else {
        const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
        audioUI.playlistMeta.textContent = `Titel ${displayIndex} von ${total} · ${formatRepeatMode(audioState.repeatMode)}`;
      }
    }
    renderPlaylist({ preserveScroll: true });
  }

  function setPlaylist(files, { append = false, activateFirstNew = false } = {}) {
    const entries = Array.from(files || []).filter(Boolean);
    let playlist = Array.isArray(audioState.playlist) ? audioState.playlist.slice() : [];
    if (!append) {
      playlist = [];
    }
    const seen = new Set(playlist.map(getTrackIdentifier).filter(Boolean));
    let firstNewIndex = -1;
    entries.forEach(file => {
      const identifier = getTrackIdentifier(file);
      if (identifier && seen.has(identifier)) {
        return;
      }
      playlist.push(file);
      if (identifier) {
        seen.add(identifier);
      }
      if (firstNewIndex === -1) {
        firstNewIndex = playlist.length - 1;
      }
    });
    audioState.playlist = playlist;
    let selectionHandled = false;
    if (!playlist.length) {
      audioState.currentIndex = -1;
      audioState.selectedFile = null;
      audioState.fileName = '';
      selectionHandled = true;
      updateAudioFileMeta(null);
    } else if (!append || audioState.currentIndex < 0) {
      selectionHandled = setCurrentTrack(0, { updateMeta: true });
    } else if (activateFirstNew && firstNewIndex !== -1) {
      selectionHandled = setCurrentTrack(firstNewIndex, { updateMeta: true });
    } else {
      clampTrackIndex(audioState.currentIndex);
      updateAudioFileMeta(audioState.selectedFile);
      selectionHandled = true;
    }
    if (!selectionHandled) {
      renderPlaylist({ preserveScroll: append });
    }
    return firstNewIndex;
  }

  class PresetAudioFile {
    constructor({ src, name, size, type }) {
      this.src = src;
      this.name = name || extractFileName(src);
      this.size = Number.isFinite(size) ? size : 0;
      this.type = type || guessMimeTypeFromPath(src);
      this.lastModified = Date.now();
      this._arrayBufferPromise = null;
    }

    async arrayBuffer() {
      if (!this._arrayBufferPromise) {
        this._arrayBufferPromise = fetch(this.src, { cache: 'force-cache' })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} beim Laden von ${this.src}`);
            }
            const length = response.headers.get('content-length');
            if (length && !this.size) {
              const parsed = Number(length);
              if (Number.isFinite(parsed)) {
                this.size = parsed;
              }
            }
            return response.arrayBuffer();
          })
          .catch(error => {
            this._arrayBufferPromise = null;
            throw error;
          });
      }
      return this._arrayBufferPromise;
    }
  }

  function extractFileName(pathname) {
    if (!pathname) return 'Audio';
    try {
      const url = new URL(pathname, window.location.href);
      const segments = url.pathname.split('/').filter(Boolean);
      return decodeURIComponent(segments.pop() || 'Audio');
    } catch (error) {
      const parts = pathname.split(/[\\/]/).filter(Boolean);
      return decodeURIComponent(parts.pop() || 'Audio');
    }
  }

  function guessMimeTypeFromPath(pathname) {
    const ext = (pathname || '').toLowerCase().split('.').pop();
    switch (ext) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
      case 'flac': return 'audio/flac';
      case 'm4a': return 'audio/mp4';
      case 'aac': return 'audio/aac';
      default: return 'audio/mpeg';
    }
  }

  async function fetchPresetTrackDescriptors() {
    const descriptorsFromManifest = await loadPresetManifest();
    if (descriptorsFromManifest.length) {
      return descriptorsFromManifest;
    }
    const descriptorsFromListing = await scrapePresetDirectory();
    return descriptorsFromListing;
  }

  async function loadPresetManifest() {
    try {
      const response = await fetch(PRESET_PLAYLIST_MANIFEST, { cache: 'no-cache' });
      if (!response.ok) {
        return [];
      }
      const payload = await response.json();
      const tracks = Array.isArray(payload?.tracks) ? payload.tracks : Array.isArray(payload) ? payload : [];
      return tracks
        .map(normalizePresetDescriptor)
        .filter(Boolean);
    } catch (error) {
      console.warn('Preset-Playlist konnte nicht über Manifest geladen werden:', error);
      return [];
    }
  }

  async function scrapePresetDirectory() {
    try {
      const response = await fetch(PRESET_AUDIO_DIRECTORY, { cache: 'no-cache' });
      if (!response.ok) {
        return [];
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return [];
      }
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const anchors = Array.from(doc.querySelectorAll('a[href]'));
      const baseHref = new URL(PRESET_AUDIO_DIRECTORY, window.location.href).href;
      const seen = new Set();
      const descriptors = [];
      anchors.forEach(anchor => {
        const href = anchor.getAttribute('href') || '';
        if (!href || href === '../') {
          return;
        }
        try {
          const url = new URL(href, baseHref);
          if (url.pathname.endsWith('/')) {
            return;
          }
          if (!/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(url.pathname)) {
            return;
          }
          const relative = `${decodeURI(url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname)}`;
          if (seen.has(relative)) {
            return;
          }
          seen.add(relative);
          descriptors.push(normalizePresetDescriptor({ src: relative }));
        } catch (error) {
          // ignore malformed hrefs
        }
      });
      return descriptors.filter(Boolean);
    } catch (error) {
      console.warn('Preset-Playlist konnte nicht aus dem Verzeichnis gelesen werden:', error);
      return [];
    }
  }

  function joinPresetPath(segment) {
    if (!segment) {
      return PRESET_AUDIO_DIRECTORY;
    }
    if (/^https?:/i.test(segment)) {
      return segment;
    }
    const trimmedBase = PRESET_AUDIO_DIRECTORY.endsWith('/')
      ? PRESET_AUDIO_DIRECTORY.slice(0, -1)
      : PRESET_AUDIO_DIRECTORY;
    const cleanSegment = segment.startsWith('/') ? segment.slice(1) : segment;
    return `${trimmedBase}/${cleanSegment}`;
  }

  function normalizePresetDescriptor(entry) {
    if (!entry) {
      return null;
    }
    const src = entry.src || entry.url || entry.path;
    if (!src) {
      return null;
    }
    const normalizedSrc = src.startsWith('http') ? src : (src.startsWith('/') ? src.slice(1) : src);
    const resolvedSrc = normalizedSrc.startsWith(PRESET_AUDIO_DIRECTORY)
      ? normalizedSrc
      : joinPresetPath(normalizedSrc);
    const sizeValue = Number(entry.size);
    return {
      src: resolvedSrc,
      name: entry.name || extractFileName(resolvedSrc),
      size: Number.isFinite(sizeValue) ? sizeValue : undefined,
      type: entry.type || guessMimeTypeFromPath(resolvedSrc)
    };
  }

  function ensurePresetPlaylistInitialized() {
    if (!presetPlaylistPromise) {
      presetPlaylistPromise = initializePresetPlaylist();
    }
    return presetPlaylistPromise;
  }

  async function initializePresetPlaylist() {
    const descriptors = await fetchPresetTrackDescriptors();
    if (getPlaylistLength() > 0) {
      return;
    }
    if (!descriptors.length) {
      setAudioStatus('Audio-Reaktivität inaktiv', 'idle');
      refreshAudioUI();
      return;
    }
    const files = descriptors.map(descriptor => new PresetAudioFile(descriptor));
    setPlaylist(files, { append: false, activateFirstNew: true });
    const label = files.length === 1 ? (files[0].name || 'Audio-Datei') : `${files.length} Titel`;
    setAudioStatus(`Preset-Playlist geladen – ${label}`, 'idle');
    refreshAudioUI();
  }

  function setCurrentTrack(index, { updateMeta = true } = {}) {
    const total = getPlaylistLength();
    if (total <= 0) {
      audioState.currentIndex = -1;
      audioState.selectedFile = null;
      audioState.fileName = '';
      if (updateMeta) {
        updateAudioFileMeta(null);
      }
      return false;
    }
    if (!Number.isFinite(index) || index < 0 || index >= total) {
      return false;
    }
    audioState.currentIndex = index;
    audioState.selectedFile = audioState.playlist[index] || null;
    audioState.fileName = audioState.selectedFile ? (audioState.selectedFile.name || 'Audio') : '';
    if (updateMeta) {
      updateAudioFileMeta(audioState.selectedFile);
    } else {
      renderPlaylist({ preserveScroll: true });
    }
    return Boolean(audioState.selectedFile);
  }

  async function requestPlaybackStart({ preferCurrent = true } = {}) {
    if (audioState.playing || audioState.usingMic) {
      return true;
    }
    if (experienceState.editingMode) {
      setEditingMode(false, { skipStop: true, skipPanelRestore: true });
    }
    if (preferCurrent && audioState.selectedFile) {
      prepareExperienceForPlayback();
      await playSelectedFile();
      return true;
    }
    return startFirstPlaylistPlayback();
  }

  async function startFirstPlaylistPlayback() {
    try {
      await ensurePresetPlaylistInitialized();
    } catch (error) {
      console.warn('Preset-Playlist konnte nicht initialisiert werden:', error);
    }
    const total = getPlaylistLength();
    if (total <= 0) {
      setAudioStatus('Keine Musikdateien verfügbar.', 'warning');
      refreshAudioUI();
      return false;
    }
    const randomIndex = Math.floor(Math.random() * total);
    if (!setCurrentTrack(randomIndex)) {
      return false;
    }
    prepareExperienceForPlayback();
    await playSelectedFile();
    return true;
  }

  function playNextTrack({ wrap = false } = {}) {
    const total = getPlaylistLength();
    if (total <= 0) {
      return false;
    }
    let nextIndex = audioState.currentIndex + 1;
    if (nextIndex >= total) {
      if (!wrap) {
        return false;
      }
      nextIndex = 0;
    }
    if (!setCurrentTrack(nextIndex)) {
      return false;
    }
    playSelectedFile();
    return true;
  }

  function playPreviousTrack({ wrap = true } = {}) {
    const total = getPlaylistLength();
    if (total <= 0) {
      return false;
    }
    let prevIndex = audioState.currentIndex - 1;
    if (prevIndex < 0) {
      if (!wrap) {
        return false;
      }
      prevIndex = total - 1;
    }
    if (!setCurrentTrack(prevIndex)) {
      return false;
    }
    playSelectedFile();
    return true;
  }

  function cycleRepeatMode() {
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(audioState.repeatMode);
    const nextMode = modes[(idx + 1) % modes.length];
    audioState.repeatMode = nextMode;
    updateRepeatButton(audioUI.repeatBtn ? audioUI.repeatBtn.disabled : false);
    updateAudioFileMeta(audioState.selectedFile);
  }

  function handleTrackEnded() {
    if (audioState.usingMic) {
      setAudioStatus('Mikrofon aktiv – Live-Reaktion', 'active');
      refreshAudioUI();
      return;
    }
    const total = getPlaylistLength();
    if (total <= 0) {
      stopAudioPlayback();
      setAudioStatus('Audio-Reaktivität inaktiv', 'idle');
      refreshAudioUI();
      return;
    }
    if (audioState.repeatMode === 'one') {
      playSelectedFile();
      return;
    }
    const advanced = playNextTrack({ wrap: audioState.repeatMode === 'all' });
    if (!advanced) {
      stopAudioPlayback();
      setAudioStatus('Wiedergabe beendet', 'idle');
      refreshAudioUI();
    }
  }

  async function playSelectedFile() {
    if (!audioState.selectedFile) {
      setAudioStatus('Bitte eine Audio-Datei auswählen.', 'waiting');
      return;
    }
    if (!isAudioSupported()) {
      setAudioStatus('Web Audio API wird nicht unterstützt.', 'error');
      return;
    }
    try {
      const playlistIndex = clampTrackIndex(audioState.currentIndex);
      const total = getPlaylistLength();
      const trackName = audioState.selectedFile.name || 'Audio';
      const trackDescriptor = total > 0 && playlistIndex >= 0
        ? `${trackName} (${playlistIndex + 1}/${total})`
        : trackName;
      setAudioStatus(`Lade ${trackDescriptor}...`, 'waiting');
      updateAudioFileMeta(audioState.selectedFile);
      if (audioUI.playBtn) {
        audioUI.playBtn.disabled = true;
      }
      const context = ensureAudioContext();
      await context.resume();
      const analyser = ensureAnalyser(context);
      stopAudioPlayback({ skipUiUpdates: true });
      disconnectAnalyser();
      const arrayBuffer = await audioState.selectedFile.arrayBuffer();
      const buffer = await decodeAudioBuffer(context, arrayBuffer);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.onended = () => {
        if (audioState.source === source) {
          audioState.source = null;
          audioState.playing = false;
          handleTrackEnded();
        }
      };
      source.connect(analyser);
      analyser.connect(context.destination);
      source.start();
      audioState.source = source;
      audioState.playing = true;
      audioState.usingMic = false;
      audioState.fileName = audioState.selectedFile.name || 'Audio';
      setAudioStatus(`Wiedergabe läuft – ${trackDescriptor}`, 'active');
      refreshAudioUI();
      notifyPlaybackStarted();
    } catch (error) {
      console.error('Audio playback failed:', error);
      setAudioStatus('Fehler beim Laden der Datei.', 'error');
      stopAudioPlayback();
      refreshAudioUI();
    }
  }

  async function startMicrophone() {
    if (!isAudioSupported()) {
      setAudioStatus('Web Audio API wird nicht unterstützt.', 'error');
      return;
    }
    if (!isMicSupported()) {
      setAudioStatus('Mikrofon wird nicht unterstützt.', 'error');
      return;
    }
    try {
      setAudioStatus('Mikrofon wird gestartet…', 'waiting');
      if (audioUI.micStartBtn) {
        audioUI.micStartBtn.disabled = true;
      }
      const context = ensureAudioContext();
      await context.resume();
      const analyser = ensureAnalyser(context);
      stopAudioPlayback({ skipUiUpdates: true });
      disconnectAnalyser();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      audioState.source = source;
      audioState.micStream = stream;
      audioState.playing = true;
      audioState.usingMic = true;
      setAudioStatus('Mikrofon aktiv – Live-Reaktion', 'active');
      refreshAudioUI();
      notifyPlaybackStarted();
    } catch (error) {
      console.error('Microphone start failed:', error);
      const denied = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      const msg = denied ? 'Mikrofon erfordert Freigabe.' : 'Mikrofon konnte nicht gestartet werden.';
      setAudioStatus(msg, 'error');
      stopAudioPlayback();
      refreshAudioUI();
    }
  }

  function stopAudioFromUser() {
    if (!audioState.playing && !audioState.micStream) {
      setAudioStatus('Audio-Reaktivität inaktiv', 'idle');
      refreshAudioUI();
      return;
    }
    stopAudioPlayback();
    setAudioStatus('Audio-Reaktivität inaktiv', 'idle');
    refreshAudioUI();
  }

  function updateAudioReactive(delta) {
    if (experienceState.editingMode) {
      return;
    }
    let energyTarget = 0;
    let bassTarget = 0;
    let midTarget = 0;
    let trebleTarget = 0;
    let waveTarget = 0;

    if (audioState.analyser && audioState.freqData) {
      audioState.analyser.getByteFrequencyData(audioState.freqData);
    }

    if (audioState.analyser && audioState.timeData) {
      audioState.analyser.getByteTimeDomainData(audioState.timeData);
    }

    if (audioState.freqData) {
      const freqData = audioState.freqData;
      const len = freqData.length;
      if (len > 0) {
        let energySum = 0;
        for (let i = 0; i < len; i++) {
          const norm = freqData[i] / 255;
          energySum += norm * norm;
        }
        energyTarget = Math.min(1, Math.sqrt(energySum / len));
        const bassBins = Math.max(1, Math.round(len * 0.08));
        const midBins = Math.max(1, Math.round(len * 0.32));
        const trebleBins = Math.max(1, len - bassBins - midBins);
        const avgRange = (start, count) => {
          const available = Math.max(0, Math.min(len - start, count));
          if (available <= 0) return 0;
          let sum = 0;
          for (let i = 0; i < available; i++) {
            sum += freqData[start + i];
          }
          return (sum / (available * 255)) || 0;
        };
        bassTarget = avgRange(0, bassBins);
        midTarget = avgRange(bassBins, midBins);
        trebleTarget = avgRange(bassBins + midBins, trebleBins);
      }
    }

    if (audioState.timeData) {
      const timeData = audioState.timeData;
      const tLen = timeData.length;
      if (tLen > 0) {
        let waveSum = 0;
        for (let i = 0; i < tLen; i++) {
          const centered = (timeData[i] - 128) / 128;
          waveSum += Math.abs(centered);
        }
        waveTarget = Math.min(1, waveSum / tLen);
      }
    }

    const metricRate = audioState.playing ? 14 : 6;
    audioState.metrics.energy = damp(audioState.metrics.energy, energyTarget, metricRate, delta);
    audioState.metrics.bass = damp(audioState.metrics.bass, bassTarget, metricRate, delta);
    audioState.metrics.mid = damp(audioState.metrics.mid, midTarget, metricRate, delta);
    audioState.metrics.treble = damp(audioState.metrics.treble, trebleTarget, metricRate, delta);
    audioState.metrics.wave = damp(audioState.metrics.wave, waveTarget, metricRate, delta);

    const modifiers = audioState.modifiers || {};
    const playing = audioState.playing || audioState.usingMic;
    const activityMix = (
      (audioState.metrics.energy * 0.9) +
      ((audioState.metrics.bass + audioState.metrics.mid + audioState.metrics.treble) / 3) * 0.6 +
      audioState.metrics.wave * 0.7
    ) / 2.2;
    const clampedActivity = clampValue(Number.isFinite(activityMix) ? activityMix : 0, 0, 1);
    const silenceTarget = playing ? 1 - clampedActivity : 1;
    const silenceRate = playing ? 2.8 : 1.6;
    audioState.silenceLevel = damp(
      Number.isFinite(audioState.silenceLevel) ? audioState.silenceLevel : 1,
      clampValue(silenceTarget, 0, 1),
      silenceRate,
      delta
    );
    const bassPulse = Math.max(0, bassTarget - audioState.previousBass);
    const energyPulse = Math.max(0, energyTarget - audioState.previousEnergy);
    const wavePulse = Math.max(0, waveTarget - audioState.previousWave);
    const treblePulse = Math.max(0, trebleTarget - audioState.previousTreble);
    const midPulse = Math.max(0, midTarget - audioState.previousMid);

    updateAudioIntensityDynamics(
      delta,
      {
        energy: audioState.metrics.energy,
        bass: audioState.metrics.bass,
        mid: audioState.metrics.mid,
        treble: audioState.metrics.treble,
        wave: audioState.metrics.wave
      },
      { energy: energyPulse, bass: bassPulse, mid: midPulse, treble: treblePulse, wave: wavePulse },
      playing
    );

    const motionIntensity = Math.max(0, getAudioIntensity('motion'));
    audioState.motionFlipCooldown = Math.max(0, audioState.motionFlipCooldown - delta);
    audioState.pitchFlipCooldown = Math.max(0, audioState.pitchFlipCooldown - delta);

    const motionActive = modifiers.motion && motionIntensity > 0;

    if (motionActive) {
      if (audioState.motionFlipCooldown <= 0) {
        const beatPulse = bassPulse * 0.7 + energyPulse * 0.4;
        if (beatPulse > 0.12 && (bassTarget > 0.38 || energyTarget > 0.52)) {
          audioState.motionDirection = (audioState.motionDirection || 1) * -1;
          const cooldownBase = 0.3 + (1 - Math.min(1, motionIntensity)) * 0.4;
          audioState.motionFlipCooldown = cooldownBase + Math.random() * 0.25;
        }
      }
      if (audioState.pitchFlipCooldown <= 0) {
        const tiltPulse = treblePulse * 0.6 + wavePulse * 0.8;
        if (tiltPulse > 0.16) {
          audioState.pitchDirection = (audioState.pitchDirection || 1) * -1;
          const pitchCooldownBase = 0.45 + (1 - Math.min(1, motionIntensity)) * 0.35;
          audioState.pitchFlipCooldown = pitchCooldownBase + Math.random() * 0.2;
        }
      }
    } else {
      audioState.motionDirection = 1;
      audioState.pitchDirection = 1;
    }

    const rawMotion = Math.min(3.2, audioState.metrics.energy * 1.6 + audioState.metrics.bass * 2.5);
    const baseSize = Math.min(2.6, 1 + audioState.metrics.mid * 1.45 + audioState.metrics.wave * 0.6);
    const baseScale = Math.min(2.6, 1 + audioState.metrics.energy * 0.65 + audioState.metrics.wave * 0.5 + audioState.metrics.bass * 0.45);
    const hueBase = audioState.metrics.treble * 160 + audioState.metrics.energy * 20;
    const alphaBase = Math.min(0.7, audioState.metrics.energy * 0.45 + audioState.metrics.wave * 0.3 + audioState.metrics.mid * 0.2);
    const saturationBase = audioState.metrics.treble * 0.6 + audioState.metrics.wave * 0.28;
    const brightnessBase = audioState.metrics.energy * 0.75 + audioState.metrics.mid * 0.35;

    const targetMotion = applyIntensityToTarget(rawMotion, 'motion', 0, { min: 0, max: 3.8 });
    const targetSize = applyIntensityToTarget(baseSize, 'size', 1, { min: 0.4, max: 3.4 });
    const targetScale = applyIntensityToTarget(baseScale, 'scale', 1, { min: 0.4, max: 3.4 });
    const targetHue = applyIntensityToTarget(hueBase, 'hue', 0, { min: -720, max: 720 });
    const targetAlpha = applyIntensityToTarget(alphaBase, 'alpha', 0, { min: 0, max: 0.9 });
    const targetSaturation = applyIntensityToTarget(saturationBase, 'saturation', 0, { min: -0.4, max: 1 });
    const targetBrightness = applyIntensityToTarget(brightnessBase, 'brightness', 0, { min: -0.4, max: 1.1 });

    audioState.visual.motion = damp(audioState.visual.motion, modifiers.motion ? targetMotion : AUDIO_VISUAL_BASE.motion, 6, delta);
    audioState.visual.size = damp(audioState.visual.size, modifiers.size ? targetSize : AUDIO_VISUAL_BASE.size, 7, delta);
    audioState.visual.scale = damp(audioState.visual.scale, modifiers.scale ? targetScale : AUDIO_VISUAL_BASE.scale, 5, delta);
    audioState.visual.hue = damp(audioState.visual.hue, modifiers.hue ? targetHue : AUDIO_VISUAL_BASE.hue, 3, delta);
    audioState.visual.alpha = damp(audioState.visual.alpha, modifiers.alpha ? targetAlpha : AUDIO_VISUAL_BASE.alpha, 6, delta);
    audioState.visual.saturation = damp(
      audioState.visual.saturation,
      modifiers.saturation ? targetSaturation : AUDIO_VISUAL_BASE.saturation,
      5,
      delta
    );
    audioState.visual.brightness = damp(
      audioState.visual.brightness,
      modifiers.brightness ? targetBrightness : AUDIO_VISUAL_BASE.brightness,
      5,
      delta
    );

    audioState.previousBass = bassTarget;
    audioState.previousEnergy = energyTarget;
    audioState.previousTreble = trebleTarget;
    audioState.previousWave = waveTarget;
    audioState.previousMid = midTarget;
  }

  function applyAudioVisuals(delta, skipReactive = false) {
    if (experienceState.editingMode) {
      return;
    }
    if (!skipReactive) {
      updateAudioReactive(delta);
    }
    const modifiers = audioState.modifiers || {};
    applyAudioVisualState(modifiers);
    applyAudioMotion(delta, modifiers);
  }

  /* Globals for stars and tiny connections */
  let starPoints, starGeometry, starMaterial;
  let tinyPoints, tinyGeometry, tinyMaterial;

  function disposeTinyResources() {
    if (tinyPoints) {
      clusterGroup.remove(tinyPoints);
      tinyPoints = undefined;
    }
    if (tinyGeometry) {
      tinyGeometry.dispose();
      tinyGeometry = undefined;
    }
    if (tinyMaterial) {
      tinyMaterial.dispose();
      tinyMaterial = undefined;
    }
  }

  function updatePointColor(applyUniforms = true) {
    const hue = ((params.pointHue % 360) + 360) % 360;
    const saturation = Math.max(0, Math.min(1, params.pointSaturation));
    const value = Math.max(0, Math.min(1, params.pointValue));
    const next = hsv2rgb(hue, saturation, value);
    colorState.point.copy(next);
    const accent = next.clone();
    accent.offsetHSL(0.02, 0.05, 0.08);
    const dim = next.clone();
    dim.offsetHSL(0, -0.12, -0.18);
    clampColor(colorState.point);
    colorState.accent.copy(clampColor(accent));
    colorState.dim.copy(clampColor(dim));
    if (!applyUniforms) return;
    if (starMaterial && starMaterial.uniforms && starMaterial.uniforms.uColor) {
      starMaterial.uniforms.uColor.value.copy(colorState.point);
      if (starMaterial.uniforms.uColorAccent) {
        starMaterial.uniforms.uColorAccent.value.copy(colorState.accent);
      }
      if (starMaterial.uniforms.uColorDim) {
        starMaterial.uniforms.uColorDim.value.copy(colorState.dim);
      }
      starMaterial.needsUpdate = true;
    }
    if (stlMaterial && stlMaterial.uniforms && stlMaterial.uniforms.uColor) {
      stlMaterial.uniforms.uColor.value.copy(colorState.point);
      if (stlMaterial.uniforms.uColorAccent) {
        stlMaterial.uniforms.uColorAccent.value.copy(colorState.accent);
      }
      if (stlMaterial.uniforms.uColorDim) {
        stlMaterial.uniforms.uColorDim.value.copy(colorState.dim);
      }
      stlMaterial.needsUpdate = true;
    }
    if (tinyMaterial && tinyMaterial.uniforms && tinyMaterial.uniforms.uColor) {
      tinyMaterial.uniforms.uColor.value.copy(colorState.point);
      if (tinyMaterial.uniforms.uColorAccent) {
        tinyMaterial.uniforms.uColorAccent.value.copy(colorState.accent);
      }
      if (tinyMaterial.uniforms.uColorDim) {
        tinyMaterial.uniforms.uColorDim.value.copy(colorState.dim);
      }
      tinyMaterial.needsUpdate = true;
    }
  }

  const POINT_VERTEX_SHADER = `
    attribute float aSize;
    attribute float aCat;
    attribute vec3 aBase;
    attribute float aPhase;
    varying float vDepth;
    varying vec3 vBase;
    varying float vPhase;
    varying float vRadius;
    uniform float uSizeFactorSmall;
    uniform float uSizeFactorMedium;
    uniform float uSizeFactorLarge;
    uniform float uTime;
    uniform float uMotionMode;
    uniform float uMotionSpeed;
    uniform float uMotionAmplitude;
    uniform float uNoiseStrength;
    uniform float uNoiseScale;
    uniform vec3 uAudioBands;
    uniform float uAudioEnergy;
    uniform float uAudioWave;

    float hash3(vec3 p) {
      return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
    }

    float valueNoise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
      float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
      vec3 u = f * f * (3.0 - 2.0 * f);
      float nx00 = mix(n000, n100, u.x);
      float nx10 = mix(n010, n110, u.x);
      float nx01 = mix(n001, n101, u.x);
      float nx11 = mix(n011, n111, u.x);
      float nxy0 = mix(nx00, nx10, u.y);
      float nxy1 = mix(nx01, nx11, u.y);
      return mix(nxy0, nxy1, u.z);
    }

    vec3 applyAudioReactive(vec3 pos) {
      float radius = length(pos);
      if (radius < 1e-4) {
        return pos;
      }
      float bandMix = dot(uAudioBands, vec3(0.65, 0.28, 0.12));
      float wavePulse = uAudioWave * 0.7;
      float energyPulse = uAudioEnergy * 0.45;
      float ripple = sin(uTime * 4.0 + aPhase * 12.5663706) * (0.2 + wavePulse * 0.6);
      float scale = 1.0 + bandMix * 0.3 + energyPulse * 0.25 + wavePulse * 0.25;
      float newRadius = max(0.05, radius * scale + ripple * 10.0);
      vec3 radial = normalize(pos);
      return radial * newRadius;
    }

    vec3 applyMotion(vec3 base) {
      float mode = uMotionMode;
      float time = uTime * uMotionSpeed;
      if (mode < 0.5) {
        return base;
      } else if (mode < 1.5) {
        float phase = aPhase * 6.2831853;
        vec3 offset = vec3(
          sin(time + phase + base.x * 0.015),
          sin(time * 0.8 + phase * 1.3 + base.y * 0.02),
          sin(time * 1.2 + phase * 0.7 + base.z * 0.017)
        );
        return base + offset * uMotionAmplitude;
      } else if (mode < 2.5) {
        float scale = max(0.0001, uNoiseScale);
        vec3 samplePos = base * (0.01 * scale);
        float tx = valueNoise(vec3(samplePos.xy, time * 0.35 + aPhase));
        float ty = valueNoise(vec3(samplePos.yz, time * 0.35 + aPhase * 1.7));
        float tz = valueNoise(vec3(samplePos.zx, time * 0.35 + aPhase * 2.3));
        vec3 offset = vec3(tx, ty, tz) * 2.0 - 1.0;
        offset *= uMotionAmplitude * uNoiseStrength;
        return base + offset;
      } else {
        float phase = aPhase * 6.2831853;
        float angle = time * 0.6 + phase * 0.25;
        vec2 xz = base.xz;
        float radius = length(xz);
        float radial = max(0.0, radius + sin(time * 0.4 + phase) * uMotionAmplitude * 0.25);
        float c = cos(angle);
        float s = sin(angle);
        vec2 rotated = vec2(
          xz.x * c - xz.y * s,
          xz.x * s + xz.y * c
        );
        if (radial > 1e-4 && length(rotated) > 1e-5) {
          rotated = normalize(rotated) * radial;
        } else {
          rotated = vec2(radial * cos(angle), radial * sin(angle));
        }
        float yOffset = sin(time * 0.5 + phase * 0.5) * uMotionAmplitude * 0.3;
        return vec3(rotated.x, base.y + yOffset, rotated.y);
      }
    }

    void main() {
      vec3 animated = applyMotion(aBase);
      vec3 audioDriven = applyAudioReactive(animated);
      vBase = aBase;
      vPhase = aPhase;
      vRadius = length(aBase);
      vec4 mv = modelViewMatrix * vec4(audioDriven, 1.0);
      vDepth = -mv.z;
      float cat = clamp(aCat, 0.0, 2.0);
      float sizeFactor = cat < 0.5 ? uSizeFactorSmall : (cat < 1.5 ? uSizeFactorMedium : uSizeFactorLarge);
      float size = max(0.01, aSize * sizeFactor);
      float px = max(1.0, size * 12.0);
      gl_PointSize = px * (300.0 / max(1.0, vDepth));
      gl_Position = projectionMatrix * mv;
    }
  `;

  const POINT_FRAGMENT_SHADER = `
    precision highp float;
    uniform float uAlpha;
    uniform float uEdgeSoftness;
    uniform vec3 uColor;
    uniform vec3 uColorAccent;
    uniform vec3 uColorDim;
    uniform float uColorMode;
    uniform float uColorRadius;
    uniform float uColorIntensity;
    uniform float uColorSpeed;
    uniform float uColorPropagationDistance;
    uniform float uColorPropagationDuration;
    uniform float uColorToneCount;
    uniform float uHueSpread;
    uniform float uTime;
    varying vec3 vBase;
    varying float vPhase;
    varying float vRadius;

    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z * mix(vec3(1.0), rgb, c.y);
    }

    vec3 computeColor() {
      float intensity = clamp(uColorIntensity, 0.0, 1.0);
      float hueSpreadNorm = uHueSpread / 360.0;
      float baseSpeed = max(uColorSpeed, 0.0);
      float colorTime = uTime * baseSpeed;
      float propagationOffset = 0.0;
      if (uColorPropagationDistance > 1e-4 && uColorPropagationDuration > 1e-4) {
        float normRadius = clamp(vRadius / uColorPropagationDistance, 0.0, 1.0);
        propagationOffset = normRadius * uColorPropagationDuration;
      }
      colorTime -= propagationOffset;
      vec3 baseHSVOriginal = rgb2hsv(uColor);
      vec3 accentHSVOriginal = rgb2hsv(uColorAccent);
      vec3 dimHSVOriginal = rgb2hsv(uColorDim);
      float hueShift = 0.0;
      if (hueSpreadNorm > 1e-6) {
        hueShift = sin(colorTime + vPhase * 6.2831853) * hueSpreadNorm;
      }
      vec3 baseHSV = baseHSVOriginal;
      baseHSV.x = fract(baseHSV.x + hueShift);
      vec3 accentHSV = accentHSVOriginal;
      accentHSV.x = fract(accentHSV.x + hueShift);
      vec3 dimHSV = dimHSVOriginal;
      dimHSV.x = fract(dimHSV.x + hueShift);
      vec3 baseColor = hsv2rgb(baseHSV);
      vec3 accentColor = hsv2rgb(accentHSV);
      vec3 dimColor = hsv2rgb(dimHSV);

      if (uColorMode < 0.5) {
        return baseColor;
      } else if (uColorMode < 1.5) {
        float norm = uColorRadius > 1e-4 ? clamp(vRadius / uColorRadius, 0.0, 1.0) : 0.0;
        float pulse = 0.5 + 0.5 * sin(colorTime * 2.2 + norm * 6.2831853 + vPhase * 3.1415926);
        vec3 effect = mix(baseColor, accentColor, pulse);
        return mix(baseColor, effect, intensity);
      } else if (uColorMode < 2.5) {
        float axis = clamp((vBase.y / max(uColorRadius, 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
        float sweep = 0.5 + 0.5 * sin(colorTime * 1.4 + axis * 6.2831853);
        vec3 effect = mix(dimColor, accentColor, sweep);
        return mix(baseColor, effect, intensity);
      } else if (uColorMode < 3.5) {
        float flicker = fract(sin(vPhase * 43758.5453 + colorTime * 0.45) * 43758.5453);
        float mixAmt = smoothstep(0.2, 0.8, flicker);
        vec3 effect = mix(dimColor, accentColor, mixAmt);
        return mix(baseColor, effect, intensity);
      } else {
        float hueRange = hueSpreadNorm;
        float randA = sin(vPhase * 213.135 + colorTime * 1.27);
        float randB = sin(vPhase * 97.531 + colorTime * 0.93);
        float randC = sin(vPhase * 47.853 + colorTime * 1.61);
        float randomShift = (randA * 0.6 + randB * 0.4) * hueRange;
        vec3 rndHSV = baseHSVOriginal;
        rndHSV.x = fract(rndHSV.x + randomShift);
        rndHSV.y = clamp(rndHSV.y * (0.7 + 0.3 * (randB * 0.5 + 0.5)), 0.0, 1.0);
        rndHSV.z = clamp(rndHSV.z * (0.7 + 0.3 * (randC * 0.5 + 0.5)), 0.0, 1.2);
        vec3 randomColor = hsv2rgb(rndHSV);
        return mix(baseColor, randomColor, intensity);
      }
    }

    void main() {
      vec2 uv = gl_PointCoord * 2.0 - 1.0;
      float d = dot(uv, uv);
      if (d > 1.0) discard;
      float inner = 1.0 - uEdgeSoftness;
      float edge = 1.0 - smoothstep(inner, 1.0, d);
      vec3 color = computeColor();
      float toneCount = max(uColorToneCount, 1.0);
      if (toneCount > 1.01) {
        vec3 quantized = rgb2hsv(color);
        quantized.x = floor(quantized.x * toneCount + 1e-4) / toneCount;
        color = hsv2rgb(quantized);
      }
      gl_FragColor = vec4(color, edge * uAlpha);
    }
  `;

  function createPointShaderMaterial() {
    const material = new THREE.ShaderMaterial({
      vertexShader: POINT_VERTEX_SHADER,
      fragmentShader: POINT_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      uniforms: {
        uAlpha: { value: params.pointAlpha },
        uEdgeSoftness: { value: params.filled ? 0.0 : params.edgeSoftness },
        uSizeFactorSmall: { value: params.sizeFactorSmall },
        uSizeFactorMedium: { value: params.sizeFactorMedium },
        uSizeFactorLarge: { value: params.sizeFactorLarge },
        uTime: { value: motionState.time },
        uMotionMode: { value: getMotionModeIndex() },
        uMotionSpeed: { value: params.motionSpeed },
        uMotionAmplitude: { value: params.motionAmplitude },
        uNoiseStrength: { value: params.motionNoiseStrength },
        uNoiseScale: { value: params.motionNoiseScale },
        uAudioBands: { value: new THREE.Vector3() },
        uAudioEnergy: { value: 0 },
        uAudioWave: { value: 0 },
        uColor: { value: colorState.point.clone() },
        uColorAccent: { value: colorState.accent.clone() },
        uColorDim: { value: colorState.dim.clone() },
        uColorMode: { value: getColorModeIndex() },
        uColorRadius: { value: Math.max(1, colorState.radius) },
        uColorIntensity: { value: params.colorIntensity },
        uColorSpeed: { value: params.colorSpeed },
        uColorPropagationDistance: { value: params.colorPropagationDistance },
        uColorPropagationDuration: { value: params.colorPropagationDuration },
        uColorToneCount: { value: params.colorToneCount },
        uHueSpread: { value: params.hueSpread },
      }
    });
    material.blending = (params.blending === 'Additive') ? THREE.AdditiveBlending : THREE.NormalBlending;
    return material;
  }

  function updatePointMaterialUniforms(material, { radiusOverride } = {}) {
    if (!material || !material.uniforms) return;
    if (material.uniforms.uAlpha) {
      material.uniforms.uAlpha.value = params.pointAlpha;
    }
    if (material.uniforms.uEdgeSoftness) {
      material.uniforms.uEdgeSoftness.value = params.filled ? 0.0 : params.edgeSoftness;
    }
    if (material.uniforms.uSizeFactorSmall) {
      material.uniforms.uSizeFactorSmall.value = params.sizeFactorSmall;
    }
    if (material.uniforms.uSizeFactorMedium) {
      material.uniforms.uSizeFactorMedium.value = params.sizeFactorMedium;
    }
    if (material.uniforms.uSizeFactorLarge) {
      material.uniforms.uSizeFactorLarge.value = params.sizeFactorLarge;
    }
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = motionState.time;
    }
    if (material.uniforms.uMotionMode) {
      material.uniforms.uMotionMode.value = getMotionModeIndex();
    }
    if (material.uniforms.uMotionSpeed) {
      material.uniforms.uMotionSpeed.value = params.motionSpeed;
    }
    if (material.uniforms.uMotionAmplitude) {
      material.uniforms.uMotionAmplitude.value = params.motionAmplitude;
    }
    if (material.uniforms.uNoiseStrength) {
      material.uniforms.uNoiseStrength.value = params.motionNoiseStrength;
    }
    if (material.uniforms.uNoiseScale) {
      material.uniforms.uNoiseScale.value = params.motionNoiseScale;
    }
    if (material.uniforms.uColor) {
      material.uniforms.uColor.value.copy(colorState.point);
    }
    if (material.uniforms.uColorAccent) {
      material.uniforms.uColorAccent.value.copy(colorState.accent);
    }
    if (material.uniforms.uColorDim) {
      material.uniforms.uColorDim.value.copy(colorState.dim);
    }
    if (material.uniforms.uColorMode) {
      material.uniforms.uColorMode.value = getColorModeIndex();
    }
    if (material.uniforms.uColorRadius) {
      const baseRadius = Math.max(1, colorState.radius);
      const override = Number.isFinite(radiusOverride) ? Math.max(1, radiusOverride) : baseRadius;
      material.uniforms.uColorRadius.value = override;
    }
    if (material.uniforms.uColorIntensity) {
      const intensity = Math.max(0, Math.min(1, Number(params.colorIntensity) || 0));
      material.uniforms.uColorIntensity.value = intensity;
    }
    if (material.uniforms.uColorSpeed) {
      const speed = Math.max(0, Number(params.colorSpeed) || 0);
      material.uniforms.uColorSpeed.value = speed;
    }
    if (material.uniforms.uColorPropagationDistance) {
      const distance = Math.max(0, Number(params.colorPropagationDistance) || 0);
      material.uniforms.uColorPropagationDistance.value = distance;
    }
    if (material.uniforms.uColorPropagationDuration) {
      const duration = Math.max(0, Number(params.colorPropagationDuration) || 0);
      material.uniforms.uColorPropagationDuration.value = duration;
    }
    if (material.uniforms.uColorToneCount) {
      const tones = Math.max(1, Math.round(Number(params.colorToneCount) || 1));
      params.colorToneCount = tones;
      material.uniforms.uColorToneCount.value = tones;
    }
    if (material.uniforms.uHueSpread) {
      const spread = Math.max(0, Math.min(360, Number(params.hueSpread) || 0));
      material.uniforms.uHueSpread.value = spread;
    }
    material.blending = (params.blending === 'Additive') ? THREE.AdditiveBlending : THREE.NormalBlending;
    material.needsUpdate = true;
  }

  if (!stlMaterial) {
    stlMaterial = createPointShaderMaterial();
  }

  /* Create stars geometry and material */
  function makeStars() {
    if (starPoints) {
      starGeometry.dispose();
      starMaterial.dispose();
      clusterGroup.remove(starPoints);
    }
    const smallCount = Math.max(0, Math.floor(Number(params.catSmallCount) || 0));
    const mediumCount = Math.max(0, Math.floor(Number(params.catMediumCount) || 0));
    const largeCount = Math.max(0, Math.floor(Number(params.catLargeCount) || 0));
    const total = clampTotalCount(smallCount + mediumCount + largeCount);
    params.count = total;
    if (total <= 0) {
      starGeometry = new THREE.BufferGeometry();
      starMaterial = null;
      starPoints = null;
      colorState.radius = Math.max(1, params.radius);
      return;
    }
    starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(total * 3);
    const basePositions = new Float32Array(total * 3);
    const phases = new Float32Array(total);
    const sizes = new Float32Array(total);
    const cats  = new Float32Array(total);
    // thresholds for categories based on counts
    const smallShare = total > 0 ? smallCount / total : 0;
    const mediumShare = total > 0 ? mediumCount / total : 0;
    const mediumThreshold = Math.min(1, smallShare + mediumShare);
    const minSize = Math.max(0.05, 1 - params.sizeVar * 0.5);
    const maxSize = 1 + params.sizeVar * 0.5;
    const span = Math.max(0.0001, maxSize - minSize);
    const smallEnd = minSize + span * smallShare;
    const mediumEnd = minSize + span * mediumThreshold;
    // seeded random for star distribution
    const rand = mulberry32(params.seedStars);
    const phaseRand = mulberry32((params.seedStars ^ 0x51f32a95) >>> 0);
    const catRand = mulberry32(params.seedStars + 0x9e3779b9);
    const categoryPool = [];
    for (let i = 0; i < smallCount; i++) categoryPool.push(0);
    for (let i = 0; i < mediumCount; i++) categoryPool.push(1);
    for (let i = 0; i < largeCount; i++) categoryPool.push(2);
    for (let i = categoryPool.length - 1; i > 0; i--) {
      const j = Math.floor(catRand() * (i + 1));
      const tmp = categoryPool[i];
      categoryPool[i] = categoryPool[j];
      categoryPool[j] = tmp;
    }
    const orientation = new THREE.Matrix4();
    const orientEuler = new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);
    orientation.makeRotationFromEuler(orientEuler);
    const tmpVec = new THREE.Vector3();
    const stlSamples = stlState.samples;
    const stlSampleCount = stlState.sampleCount || 0;
    const desiredRadius = Math.max(1e-3, Number(params.radius) || stlState.boundingRadius || 1);
    const stlRadius = Math.max(1e-3, stlState.boundingRadius || desiredRadius);
    const stlScale = params.distribution === 'stl' ? desiredRadius / stlRadius : 1;
    const stlIndexRand = params.distribution === 'stl'
      ? mulberry32((params.seedStars ^ 0x7f4a7c15) >>> 0)
      : null;
    const stlJitterStrength = params.distribution === 'stl'
      ? Math.max(0, params.cluster) * desiredRadius * 0.04
      : 0;
    const fibOffset = (params.distribution === 'fibonacci' && total > 0) ? (2 / total) : 0;
    const fibIncrement = Math.PI * (3 - Math.sqrt(5));
    const spiralArms = 4;
    const radius = params.radius;
    for (let i = 0; i < total; i++) {
      tmpVec.set(0, 0, 0);
      if (params.distribution === 'fibonacci') {
        const yv = ((i + 0.5) * fibOffset) - 1;
        const clampedY = Math.max(-1, Math.min(1, yv));
        const rCircle = Math.sqrt(Math.max(0, 1 - clampedY * clampedY));
        const phi = i * fibIncrement;
        const bias = params.cluster > 0 ? Math.pow(rand(), 1 + params.cluster * 2.2) : rand();
        const radial = radius * (0.35 + 0.65 * bias);
        let x = Math.cos(phi) * rCircle * radial;
        let y = clampedY * radial;
        let z = Math.sin(phi) * rCircle * radial;
        x += (rand() - 0.5) * radius * 0.04;
        y += (rand() - 0.5) * radius * 0.04;
        z += (rand() - 0.5) * radius * 0.04;
        tmpVec.set(x, y, z).applyMatrix4(orientation);
      } else if (params.distribution === 'spiral') {
        const t = total > 0 ? (i / total) : 0;
        const arm = i % spiralArms;
        const baseAngle = t * Math.PI * 6 + arm * (Math.PI * 2 / spiralArms);
        const spread = radius * Math.pow(rand(), 0.55 + params.cluster * 0.9);
        let x = Math.cos(baseAngle) * spread;
        let z = Math.sin(baseAngle) * spread;
        let y = (rand() - 0.5) * radius * (0.2 + 0.4 * (1 - params.cluster));
        x += (rand() - 0.5) * radius * 0.08;
        y += (rand() - 0.5) * radius * 0.08;
        z += (rand() - 0.5) * radius * 0.08;
        tmpVec.set(x, y, z).applyMatrix4(orientation);
      } else if (params.distribution === 'cube') {
        const shrink = params.cluster > 0 ? Math.pow(rand(), 1 + params.cluster * 1.8) : 1;
        tmpVec.set(
          (rand() * 2 - 1) * radius * shrink,
          (rand() * 2 - 1) * radius * shrink,
          (rand() * 2 - 1) * radius * shrink
        ).applyMatrix4(orientation);
      } else if (params.distribution === 'cylinder') {
        const radialBias = params.cluster > 0 ? Math.pow(rand(), 1 + params.cluster * 1.5) : rand();
        const r = radius * Math.sqrt(radialBias);
        const theta = rand() * Math.PI * 2;
        const heightRand = rand();
        const heightScale = params.cluster > 0 ? Math.pow(heightRand, 1 + params.cluster * 1.3) : heightRand;
        const y = (rand() < 0.5 ? -1 : 1) * radius * heightScale;
        tmpVec.set(
          Math.cos(theta) * r,
          y,
          Math.sin(theta) * r
        ).applyMatrix4(orientation);
      } else if (params.distribution === 'octahedron') {
        let accepted = false;
        for (let attempt = 0; attempt < 12 && !accepted; attempt++) {
          const px = rand() * 2 - 1;
          const py = rand() * 2 - 1;
          const pz = rand() * 2 - 1;
          const sum = Math.abs(px) + Math.abs(py) + Math.abs(pz);
          if (sum <= 1) {
            const bias = params.cluster > 0 ? Math.pow(rand(), 1 + params.cluster * 2.0) : 1;
            tmpVec.set(px * radius * bias, py * radius * bias, pz * radius * bias);
            accepted = true;
          }
        }
        if (!accepted) {
          tmpVec.set((rand() * 2 - 1) * radius, (rand() * 2 - 1) * radius, (rand() * 2 - 1) * radius);
        }
        tmpVec.applyMatrix4(orientation);
      } else if (params.distribution === 'stl') {
        if (stlSamples && stlSampleCount > 0 && stlIndexRand) {
          const idx = Math.floor(stlIndexRand() * stlSampleCount) % stlSampleCount;
          const baseIndex = idx * 3;
          let x = stlSamples[baseIndex];
          let y = stlSamples[baseIndex + 1];
          let z = stlSamples[baseIndex + 2];
          if (stlScale !== 1) {
            x *= stlScale;
            y *= stlScale;
            z *= stlScale;
          }
          if (stlJitterStrength > 0) {
            x += (rand() - 0.5) * stlJitterStrength;
            y += (rand() - 0.5) * stlJitterStrength;
            z += (rand() - 0.5) * stlJitterStrength;
          }
          tmpVec.set(x, y, z);
        } else {
          tmpVec.set((rand() * 2 - 1) * radius, (rand() * 2 - 1) * radius, (rand() * 2 - 1) * radius);
        }
      } else {
        const u = rand();
        const v = rand();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        let r = radius;
        if (rand() < params.cluster) {
          r *= rand();
        }
        tmpVec.set(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
      }
      const x = tmpVec.x;
      const y = tmpVec.y;
      const z = tmpVec.z;
      positions.set([x, y, z], i * 3);
      basePositions.set([x, y, z], i * 3);
      const cat = categoryPool[i] !== undefined ? categoryPool[i] : 2;
      cats[i] = cat;
      let lower = mediumEnd;
      let upper = maxSize;
      if (cat === 0) {
        lower = minSize;
        upper = smallEnd;
      } else if (cat === 1) {
        lower = smallEnd;
        upper = mediumEnd;
      }
      if (upper - lower < 0.001) {
        sizes[i] = lower;
      } else {
        sizes[i] = lower + rand() * (upper - lower);
      }
      phases[i] = phaseRand();
    }
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    const baseAttr = new THREE.BufferAttribute(basePositions, 3);
    const phaseAttr = new THREE.BufferAttribute(phases, 1);
    starGeometry.setAttribute('position', positionAttr);
    starGeometry.setAttribute('aBase', baseAttr);
    starGeometry.setAttribute('aPhase', phaseAttr);
    starGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    starGeometry.setAttribute('aCat', new THREE.BufferAttribute(cats, 1));
    starGeometry.computeBoundingSphere();
    if (starGeometry.boundingSphere) {
      const center = starGeometry.boundingSphere.center.clone();
      if (center.lengthSq() > 1e-6) {
        for (let i = 0; i < positionAttr.count; i++) {
          positionAttr.setXYZ(
            i,
            positionAttr.getX(i) - center.x,
            positionAttr.getY(i) - center.y,
            positionAttr.getZ(i) - center.z
          );
          baseAttr.setXYZ(
            i,
            baseAttr.getX(i) - center.x,
            baseAttr.getY(i) - center.y,
            baseAttr.getZ(i) - center.z
          );
        }
        positionAttr.needsUpdate = true;
        baseAttr.needsUpdate = true;
        starGeometry.boundingSphere.center.set(0, 0, 0);
        controls.target.copy(clusterGroup.position);
      }
    }
    const sphere = starGeometry.boundingSphere;
    colorState.radius = sphere ? Math.max(1, sphere.radius) : Math.max(1, params.radius);
    starMaterial = createPointShaderMaterial();
    updatePointMaterialUniforms(starMaterial);
    starPoints = new THREE.Points(starGeometry, starMaterial);
    clusterGroup.add(starPoints);
    const existingStlPoints = stlState.points;
    if (stlMaterial) {
      stlMaterial.dispose();
      stlMaterial = null;
    }
    ensureStlMaterial();
    if (existingStlPoints && stlMaterial) {
      existingStlPoints.material = stlMaterial;
    }
  }

  /* Create tiny connection points */
  function makeTiny() {
    disposeTinyResources();
    // Determine number of tiny points based on connPercent
    const nTiny = Math.round(params.tinyCount * params.connPercent);
    // Access star positions for connections
    const starPos = (starGeometry && starGeometry.getAttribute) ? starGeometry.getAttribute('position') : null;
    const nStars = starPos ? starPos.count : 0;
    if (!starPos || nStars === 0 || nTiny <= 0) {
      tinyPoints = undefined;
      return;
    }

    tinyGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(Math.max(0, nTiny * 3));
    const basePositions = new Float32Array(Math.max(0, nTiny * 3));
    const phases = new Float32Array(Math.max(0, nTiny));
    if (nTiny > 0 && nStars > 0) {
      const rand = mulberry32(params.seedTiny);
      const phaseRand = mulberry32((params.seedTiny ^ 0x9e3779b9) >>> 0);
      for (let i = 0; i < nTiny; i++) {
        // pick two random stars
        const idxA = Math.floor(rand() * nStars);
        const idxB = Math.floor(rand() * nStars);
        const ax = starPos.getX(idxA), ay = starPos.getY(idxA), az = starPos.getZ(idxA);
        const bx = starPos.getX(idxB), by = starPos.getY(idxB), bz = starPos.getZ(idxB);
        const t = rand();
        // linear interpolation between stars
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const z = az + (bz - az) * t;
        positions.set([x, y, z], i * 3);
        basePositions.set([x, y, z], i * 3);
        phases[i] = phaseRand();
      }
    }
    tinyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tinyGeometry.setAttribute('aBase', new THREE.BufferAttribute(basePositions, 3));
    tinyGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const tinyVert = `
      attribute vec3 aBase;
      attribute float aPhase;
      uniform float uSize;
      uniform float uTime;
      uniform float uMotionMode;
      uniform float uMotionSpeed;
      uniform float uMotionAmplitude;
      uniform float uNoiseStrength;
      uniform float uNoiseScale;
      uniform vec3 uAudioBands;
      uniform float uAudioEnergy;
      uniform float uAudioWave;
      varying float vDepth;
      varying vec3 vBase;
      varying float vPhase;
      varying float vRadius;

      float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float valueNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
        vec3 u = f * f * (3.0 - 2.0 * f);
        float nx00 = mix(n000, n100, u.x);
        float nx10 = mix(n010, n110, u.x);
        float nx01 = mix(n001, n101, u.x);
        float nx11 = mix(n011, n111, u.x);
        float nxy0 = mix(nx00, nx10, u.y);
        float nxy1 = mix(nx01, nx11, u.y);
        return mix(nxy0, nxy1, u.z);
      }

      vec3 applyAudioReactive(vec3 pos) {
        float radius = length(pos);
        if (radius < 1e-4) {
          return pos;
        }
        float bandMix = dot(uAudioBands, vec3(0.6, 0.3, 0.15));
        float wavePulse = uAudioWave * 0.6;
        float energyPulse = uAudioEnergy * 0.35;
        float ripple = sin(uTime * 4.2 + aPhase * 12.5663706) * (0.15 + wavePulse * 0.55);
        float scale = 1.0 + bandMix * 0.25 + energyPulse * 0.2 + wavePulse * 0.25;
        float newRadius = max(0.02, radius * scale + ripple * 6.0);
        vec3 radial = normalize(pos);
        return radial * newRadius;
      }

      vec3 applyMotion(vec3 base) {
        float mode = uMotionMode;
        float time = uTime * uMotionSpeed;
        if (mode < 0.5) {
          return base;
        } else if (mode < 1.5) {
          float phase = aPhase * 6.2831853;
          vec3 offset = vec3(
            sin(time + phase + base.x * 0.015),
            sin(time * 0.8 + phase * 1.3 + base.y * 0.02),
            sin(time * 1.2 + phase * 0.7 + base.z * 0.017)
          );
          return base + offset * uMotionAmplitude;
        } else if (mode < 2.5) {
          float scale = max(0.0001, uNoiseScale);
          vec3 samplePos = base * (0.01 * scale);
          float tx = valueNoise(vec3(samplePos.xy, time * 0.35 + aPhase));
          float ty = valueNoise(vec3(samplePos.yz, time * 0.35 + aPhase * 1.7));
          float tz = valueNoise(vec3(samplePos.zx, time * 0.35 + aPhase * 2.3));
          vec3 offset = vec3(tx, ty, tz) * 2.0 - 1.0;
          offset *= uMotionAmplitude * uNoiseStrength;
          return base + offset;
        } else {
          float phase = aPhase * 6.2831853;
          float angle = time * 0.6 + phase * 0.25;
          vec2 xz = base.xz;
          float radius = length(xz);
          float radial = max(0.0, radius + sin(time * 0.4 + phase) * uMotionAmplitude * 0.25);
          float c = cos(angle);
          float s = sin(angle);
          vec2 rotated = vec2(
            xz.x * c - xz.y * s,
            xz.x * s + xz.y * c
          );
          if (radial > 1e-4 && length(rotated) > 1e-5) {
            rotated = normalize(rotated) * radial;
          } else {
            rotated = vec2(radial * cos(angle), radial * sin(angle));
          }
          float yOffset = sin(time * 0.5 + phase * 0.5) * uMotionAmplitude * 0.3;
          return vec3(rotated.x, base.y + yOffset, rotated.y);
        }
      }

      void main() {
        vec3 animated = applyMotion(aBase);
        vec3 audioDriven = applyAudioReactive(animated);
        vBase = aBase;
        vPhase = aPhase;
        vRadius = length(aBase);
        vec4 mv = modelViewMatrix * vec4(audioDriven, 1.0);
        vDepth = -mv.z;
        float px = max(1.0, uSize * 6.0);
        gl_PointSize = px * (300.0 / max(1.0, vDepth));
        gl_Position = projectionMatrix * mv;
      }
    `;
    const tinyFrag = `
      precision highp float;
      uniform float uAlpha;
      uniform vec3 uColor;
      uniform vec3 uColorAccent;
      uniform vec3 uColorDim;
      uniform float uColorMode;
      uniform float uColorRadius;
      uniform float uColorIntensity;
      uniform float uColorSpeed;
      uniform float uColorPropagationDistance;
      uniform float uColorPropagationDuration;
      uniform float uColorToneCount;
      uniform float uHueSpread;
      uniform float uTime;
      varying vec3 vBase;
      varying float vPhase;
      varying float vRadius;

      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      vec3 computeColor() {
        float intensity = clamp(uColorIntensity, 0.0, 1.0);
        float hueSpreadNorm = uHueSpread / 360.0;
        float baseSpeed = max(uColorSpeed, 0.0);
        float colorTime = uTime * baseSpeed;
        float propagationOffset = 0.0;
        if (uColorPropagationDistance > 1e-4 && uColorPropagationDuration > 1e-4) {
          float normRadius = clamp(vRadius / uColorPropagationDistance, 0.0, 1.0);
          propagationOffset = normRadius * uColorPropagationDuration;
        }
        colorTime -= propagationOffset;
        vec3 baseHSVOriginal = rgb2hsv(uColor);
        vec3 accentHSVOriginal = rgb2hsv(uColorAccent);
        vec3 dimHSVOriginal = rgb2hsv(uColorDim);
        float hueShift = 0.0;
        if (hueSpreadNorm > 1e-6) {
          hueShift = sin(colorTime + vPhase * 6.2831853) * hueSpreadNorm;
        }
        vec3 baseHSV = baseHSVOriginal;
        baseHSV.x = fract(baseHSV.x + hueShift);
        vec3 accentHSV = accentHSVOriginal;
        accentHSV.x = fract(accentHSV.x + hueShift);
        vec3 dimHSV = dimHSVOriginal;
        dimHSV.x = fract(dimHSV.x + hueShift);
        vec3 baseColor = hsv2rgb(baseHSV);
        vec3 accentColor = hsv2rgb(accentHSV);
        vec3 dimColor = hsv2rgb(dimHSV);

        if (uColorMode < 0.5) {
          return baseColor;
        } else if (uColorMode < 1.5) {
          float norm = uColorRadius > 1e-4 ? clamp(vRadius / uColorRadius, 0.0, 1.0) : 0.0;
          float pulse = 0.5 + 0.5 * sin(colorTime * 2.8 + norm * 6.2831853 + vPhase * 4.7123889);
          vec3 effect = mix(baseColor, accentColor, pulse);
          return mix(baseColor, effect, intensity);
        } else if (uColorMode < 2.5) {
          float axis = clamp((vBase.y / max(uColorRadius, 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
          float sweep = 0.5 + 0.5 * sin(colorTime * 1.8 + axis * 6.2831853);
          vec3 effect = mix(dimColor, accentColor, sweep);
          return mix(baseColor, effect, intensity);
        } else if (uColorMode < 3.5) {
          float flicker = fract(sin(vPhase * 43758.5453 + colorTime * 0.6) * 43758.5453);
          float mixAmt = smoothstep(0.15, 0.85, flicker);
          vec3 effect = mix(dimColor, accentColor, mixAmt);
          return mix(baseColor, effect, intensity);
        } else {
          float hueRange = hueSpreadNorm;
          float randA = sin(vPhase * 213.135 + colorTime * 1.47);
          float randB = sin(vPhase * 97.531 + colorTime * 1.03);
          float randC = sin(vPhase * 47.853 + colorTime * 1.71);
          float randomShift = (randA * 0.6 + randB * 0.4) * hueRange;
          vec3 rndHSV = baseHSVOriginal;
          rndHSV.x = fract(rndHSV.x + randomShift);
          rndHSV.y = clamp(rndHSV.y * (0.7 + 0.3 * (randB * 0.5 + 0.5)), 0.0, 1.0);
          rndHSV.z = clamp(rndHSV.z * (0.7 + 0.3 * (randC * 0.5 + 0.5)), 0.0, 1.2);
          vec3 randomColor = hsv2rgb(rndHSV);
          return mix(baseColor, randomColor, intensity);
        }
      }

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float d = dot(uv, uv);
        if (d > 1.0) discard;
        float fade = 1.0 - smoothstep(0.6, 1.0, d);
        vec3 color = computeColor();
        float toneCount = max(uColorToneCount, 1.0);
        if (toneCount > 1.01) {
          vec3 quantized = rgb2hsv(color);
          quantized.x = floor(quantized.x * toneCount + 1e-4) / toneCount;
          color = hsv2rgb(quantized);
        }
        gl_FragColor = vec4(color, fade * uAlpha);
      }
    `;
    tinyMaterial = new THREE.ShaderMaterial({
      vertexShader: tinyVert,
      fragmentShader: tinyFrag,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      uniforms: {
        uAlpha: { value: params.tinyAlpha },
        uSize: { value: params.sizeFactorTiny },
        uTime: { value: motionState.time },
        uMotionMode: { value: getMotionModeIndex() },
        uMotionSpeed: { value: params.motionSpeed },
        uMotionAmplitude: { value: params.motionAmplitude },
        uNoiseStrength: { value: params.motionNoiseStrength },
        uNoiseScale: { value: params.motionNoiseScale },
        uAudioBands: { value: new THREE.Vector3() },
        uAudioEnergy: { value: 0 },
        uAudioWave: { value: 0 },
        uColor: { value: colorState.point.clone() },
        uColorAccent: { value: colorState.accent.clone() },
        uColorDim: { value: colorState.dim.clone() },
        uColorMode: { value: getColorModeIndex() },
        uColorRadius: { value: colorState.radius },
        uColorIntensity: { value: params.colorIntensity },
        uColorSpeed: { value: params.colorSpeed },
        uColorPropagationDistance: { value: params.colorPropagationDistance },
        uColorPropagationDuration: { value: params.colorPropagationDuration },
        uColorToneCount: { value: params.colorToneCount },
        uHueSpread: { value: params.hueSpread },
      }
    });
    tinyMaterial.blending = (params.blending === 'Additive') ? THREE.AdditiveBlending : THREE.NormalBlending;
    tinyPoints = new THREE.Points(tinyGeometry, tinyMaterial);
    clusterGroup.add(tinyPoints);
  }

  /* Update uniforms and materials when parameters change */
  function updateStarUniforms() {
    if (!starMaterial) return;
    starMaterial.uniforms.uAlpha.value = params.pointAlpha;
    starMaterial.uniforms.uEdgeSoftness.value = params.filled ? 0.0 : params.edgeSoftness;
    starMaterial.uniforms.uSizeFactorSmall.value = params.sizeFactorSmall;
    starMaterial.uniforms.uSizeFactorMedium.value = params.sizeFactorMedium;
    starMaterial.uniforms.uSizeFactorLarge.value = params.sizeFactorLarge;
    if (starMaterial.uniforms.uTime) {
      starMaterial.uniforms.uTime.value = motionState.time;
    }
    if (starMaterial.uniforms.uMotionMode) {
      starMaterial.uniforms.uMotionMode.value = getMotionModeIndex();
    }
    if (starMaterial.uniforms.uMotionSpeed) {
      starMaterial.uniforms.uMotionSpeed.value = params.motionSpeed;
    }
    if (starMaterial.uniforms.uMotionAmplitude) {
      starMaterial.uniforms.uMotionAmplitude.value = params.motionAmplitude;
    }
    if (starMaterial.uniforms.uNoiseStrength) {
      starMaterial.uniforms.uNoiseStrength.value = params.motionNoiseStrength;
    }
    if (starMaterial.uniforms.uNoiseScale) {
      starMaterial.uniforms.uNoiseScale.value = params.motionNoiseScale;
    }
    if (starMaterial.uniforms.uColor) {
      starMaterial.uniforms.uColor.value.copy(colorState.point);
    }
    if (starMaterial.uniforms.uColorAccent) {
      starMaterial.uniforms.uColorAccent.value.copy(colorState.accent);
    }
    if (starMaterial.uniforms.uColorDim) {
      starMaterial.uniforms.uColorDim.value.copy(colorState.dim);
    }
    if (starMaterial.uniforms.uColorMode) {
      starMaterial.uniforms.uColorMode.value = getColorModeIndex();
    }
    if (starMaterial.uniforms.uColorRadius) {
      starMaterial.uniforms.uColorRadius.value = Math.max(1, colorState.radius);
    }
    if (starMaterial.uniforms.uColorIntensity) {
      const intensity = Math.max(0, Math.min(1, Number(params.colorIntensity) || 0));
      starMaterial.uniforms.uColorIntensity.value = intensity;
    }
    if (starMaterial.uniforms.uColorSpeed) {
      const speed = Math.max(0, Number(params.colorSpeed) || 0);
      starMaterial.uniforms.uColorSpeed.value = speed;
    }
    if (starMaterial.uniforms.uColorPropagationDistance) {
      const distance = Math.max(0, Number(params.colorPropagationDistance) || 0);
      starMaterial.uniforms.uColorPropagationDistance.value = distance;
    }
    if (starMaterial.uniforms.uColorPropagationDuration) {
      const duration = Math.max(0, Number(params.colorPropagationDuration) || 0);
      starMaterial.uniforms.uColorPropagationDuration.value = duration;
    }
    if (starMaterial.uniforms.uColorToneCount) {
      const tones = Math.max(1, Math.round(Number(params.colorToneCount) || 1));
      params.colorToneCount = tones;
      starMaterial.uniforms.uColorToneCount.value = tones;
    }
    if (starMaterial.uniforms.uHueSpread) {
      const spread = Math.max(0, Math.min(360, Number(params.hueSpread) || 0));
      starMaterial.uniforms.uHueSpread.value = spread;
    }
    starMaterial.blending = (params.blending === 'Additive') ? THREE.AdditiveBlending : THREE.NormalBlending;
    starMaterial.needsUpdate = true;
    if (stlMaterial && stlMaterial.uniforms) {
      if (stlMaterial.uniforms.uAlpha) {
        stlMaterial.uniforms.uAlpha.value = params.pointAlpha;
      }
      if (stlMaterial.uniforms.uEdgeSoftness) {
        stlMaterial.uniforms.uEdgeSoftness.value = params.filled ? 0.0 : params.edgeSoftness;
      }
      if (stlMaterial.uniforms.uSizeFactorSmall) {
        stlMaterial.uniforms.uSizeFactorSmall.value = params.sizeFactorSmall;
      }
      if (stlMaterial.uniforms.uSizeFactorMedium) {
        stlMaterial.uniforms.uSizeFactorMedium.value = params.sizeFactorMedium;
      }
      if (stlMaterial.uniforms.uSizeFactorLarge) {
        stlMaterial.uniforms.uSizeFactorLarge.value = params.sizeFactorLarge;
      }
      if (stlMaterial.uniforms.uTime) {
        stlMaterial.uniforms.uTime.value = motionState.time;
      }
      if (stlMaterial.uniforms.uMotionMode) {
        stlMaterial.uniforms.uMotionMode.value = getMotionModeIndex();
      }
      if (stlMaterial.uniforms.uMotionSpeed) {
        stlMaterial.uniforms.uMotionSpeed.value = params.motionSpeed;
      }
      if (stlMaterial.uniforms.uMotionAmplitude) {
        stlMaterial.uniforms.uMotionAmplitude.value = params.motionAmplitude;
      }
      if (stlMaterial.uniforms.uNoiseStrength) {
        stlMaterial.uniforms.uNoiseStrength.value = params.motionNoiseStrength;
      }
      if (stlMaterial.uniforms.uNoiseScale) {
        stlMaterial.uniforms.uNoiseScale.value = params.motionNoiseScale;
      }
      if (stlMaterial.uniforms.uColor) {
        stlMaterial.uniforms.uColor.value.copy(colorState.point);
      }
      if (stlMaterial.uniforms.uColorAccent) {
        stlMaterial.uniforms.uColorAccent.value.copy(colorState.accent);
      }
      if (stlMaterial.uniforms.uColorDim) {
        stlMaterial.uniforms.uColorDim.value.copy(colorState.dim);
      }
      if (stlMaterial.uniforms.uColorMode) {
        stlMaterial.uniforms.uColorMode.value = getColorModeIndex();
      }
      if (stlMaterial.uniforms.uColorRadius) {
        const radius = Math.max(1, Math.max(colorState.radius, stlState.boundingRadius || 0));
        stlMaterial.uniforms.uColorRadius.value = radius;
      }
      if (stlMaterial.uniforms.uColorIntensity) {
        const intensity = Math.max(0, Math.min(1, Number(params.colorIntensity) || 0));
        stlMaterial.uniforms.uColorIntensity.value = intensity;
      }
      if (stlMaterial.uniforms.uColorSpeed) {
        const speed = Math.max(0, Number(params.colorSpeed) || 0);
        stlMaterial.uniforms.uColorSpeed.value = speed;
      }
      if (stlMaterial.uniforms.uColorPropagationDistance) {
        const distance = Math.max(0, Number(params.colorPropagationDistance) || 0);
        stlMaterial.uniforms.uColorPropagationDistance.value = distance;
      }
      if (stlMaterial.uniforms.uColorPropagationDuration) {
        const duration = Math.max(0, Number(params.colorPropagationDuration) || 0);
        stlMaterial.uniforms.uColorPropagationDuration.value = duration;
      }
      if (stlMaterial.uniforms.uColorToneCount) {
        const tones = Math.max(1, Math.round(Number(params.colorToneCount) || 1));
        stlMaterial.uniforms.uColorToneCount.value = tones;
      }
      if (stlMaterial.uniforms.uHueSpread) {
        const spread = Math.max(0, Math.min(360, Number(params.hueSpread) || 0));
        stlMaterial.uniforms.uHueSpread.value = spread;
      }
      stlMaterial.blending = (params.blending === 'Additive') ? THREE.AdditiveBlending : THREE.NormalBlending;
      stlMaterial.needsUpdate = true;
    }
    updatePointMaterialUniforms(starMaterial);
    const radius = Math.max(colorState.radius, stlState.boundingRadius || 0);
    updatePointMaterialUniforms(stlMaterial, { radiusOverride: radius });
  }

  function updateTinyMaterial() {
    if (!tinyMaterial) return;
    tinyMaterial.uniforms.uAlpha.value = params.tinyAlpha;
    tinyMaterial.uniforms.uSize.value = params.sizeFactorTiny;
    if (tinyMaterial.uniforms.uTime) {
      tinyMaterial.uniforms.uTime.value = motionState.time;
    }
    if (tinyMaterial.uniforms.uMotionMode) {
      tinyMaterial.uniforms.uMotionMode.value = getMotionModeIndex();
    }
    if (tinyMaterial.uniforms.uMotionSpeed) {
      tinyMaterial.uniforms.uMotionSpeed.value = params.motionSpeed;
    }
    if (tinyMaterial.uniforms.uMotionAmplitude) {
      tinyMaterial.uniforms.uMotionAmplitude.value = params.motionAmplitude;
    }
    if (tinyMaterial.uniforms.uNoiseStrength) {
      tinyMaterial.uniforms.uNoiseStrength.value = params.motionNoiseStrength;
    }
    if (tinyMaterial.uniforms.uNoiseScale) {
      tinyMaterial.uniforms.uNoiseScale.value = params.motionNoiseScale;
    }
    if (tinyMaterial.uniforms.uColor) {
      tinyMaterial.uniforms.uColor.value.copy(colorState.point);
    }
    if (tinyMaterial.uniforms.uColorAccent) {
      tinyMaterial.uniforms.uColorAccent.value.copy(colorState.accent);
    }
    if (tinyMaterial.uniforms.uColorDim) {
      tinyMaterial.uniforms.uColorDim.value.copy(colorState.dim);
    }
    if (tinyMaterial.uniforms.uColorMode) {
      tinyMaterial.uniforms.uColorMode.value = getColorModeIndex();
    }
    if (tinyMaterial.uniforms.uColorRadius) {
      tinyMaterial.uniforms.uColorRadius.value = Math.max(1, colorState.radius);
    }
    if (tinyMaterial.uniforms.uColorIntensity) {
      const intensity = Math.max(0, Math.min(1, Number(params.colorIntensity) || 0));
      tinyMaterial.uniforms.uColorIntensity.value = intensity;
    }
    if (tinyMaterial.uniforms.uColorSpeed) {
      const speed = Math.max(0, Number(params.colorSpeed) || 0);
      tinyMaterial.uniforms.uColorSpeed.value = speed;
    }
    if (tinyMaterial.uniforms.uColorPropagationDistance) {
      const distance = Math.max(0, Number(params.colorPropagationDistance) || 0);
      tinyMaterial.uniforms.uColorPropagationDistance.value = distance;
    }
    if (tinyMaterial.uniforms.uColorPropagationDuration) {
      const duration = Math.max(0, Number(params.colorPropagationDuration) || 0);
      tinyMaterial.uniforms.uColorPropagationDuration.value = duration;
    }
    if (tinyMaterial.uniforms.uColorToneCount) {
      const tones = Math.max(1, Math.round(Number(params.colorToneCount) || 1));
      params.colorToneCount = tones;
      tinyMaterial.uniforms.uColorToneCount.value = tones;
    }
    if (tinyMaterial.uniforms.uHueSpread) {
      const spread = Math.max(0, Math.min(360, Number(params.hueSpread) || 0));
      tinyMaterial.uniforms.uHueSpread.value = spread;
    }
    tinyMaterial.blending = (params.blending === 'Additive') ? THREE.AdditiveBlending : THREE.NormalBlending;
    tinyMaterial.needsUpdate = true;
  }

  /* Rebuild functions */
  function rebuildStars() {
    makeStars();
    updateStarUniforms();
    // regenerate tiny connections as they depend on star positions
    makeTiny();
    updateTinyMaterial();
  }
  function rebuildTiny() {
    makeTiny();
    updateTinyMaterial();
  }

  /* Bind UI elements */
  const $ = id => document.getElementById(id);
  const panel = $('panel');
  const panelCloseBtn = $('panelClose');
  const editModeBtn = $('editMode');
  const lockBtn = $('lock');
  const sheetHandleBtn = $('sheetHandle');
  const viewportState = { height: 0 };
  const mobileSheetQuery = window.matchMedia('(max-width: 768px)');
  const sheetState = {
    mode: 'compact',
    expandedHeight: 0,
    compactHeight: 0,
    pointerId: null,
    startY: 0,
    startOffset: 0,
    lastOffset: 0,
    moved: false,
    preventClick: false,
  };
  const SHEET_EXTRA_DRAG_PX = 140;
  const SHEET_HIDE_TRIGGER_PX = 90;
  const doubleTapState = { lastTime: 0, lastX: 0, lastY: 0, blockUntil: 0 };
  const DOUBLE_TAP_TIMEOUT_MS = 420;
  const DOUBLE_TAP_DISTANCE_PX = 46;
  const longPressState = { timerId: null, pointerId: null, startX: 0, startY: 0, triggered: false };
  const LONG_PRESS_DURATION_MS = 600;
  const LONG_PRESS_DISTANCE_PX = 28;

  patternUI.presetList = $('patternPresetList');
  patternUI.activeName = $('patternActiveName');
  patternUI.activeDescription = $('patternActiveDescription');
  patternUI.distributionChips = $('patternDistributionChips');
  patternUI.randomPresetBtn = $('patternRandomPreset');
  patternUI.focusBtn = $('patternFocus');

  presetStudioUI.status = $('presetStudioStatus');
  presetStudioUI.shuffleBtn = $('presetStudioShuffle');
  presetStudioUI.restoreBtn = $('presetStudioRestore');
  presetStudioUI.copyBtn = $('presetStudioCopy');

  customPresetUI.form = $('presetCreateForm');
  customPresetUI.nameInput = $('presetName');
  customPresetUI.notesInput = $('presetNotes');
  customPresetUI.hint = $('presetFormHint');
  customPresetUI.gallery = $('userPresetGallery');
  customPresetUI.emptyState = $('userPresetEmpty');
  customPresetUI.galleryModeButtons = Array.from(document.querySelectorAll('[data-gallery-mode]'));
  customPresetUI.randomBtn = $('presetRandomPlayback');
  if (customPresetUI.gallery) {
    customPresetUI.gallery.dataset.mode = userPresetState.galleryMode;
  }

  if (presetStudioUI.status) {
    setPresetStudioStatus(PRESET_STUDIO_DEFAULT_MESSAGE, 'info');
  }

  const controlPanelRegistry = new Map();
  const controlPanelTabs = new Map();
  const PANEL_ORDER = ['media', 'presets', 'config'];
  const infoPopoverState = { trigger: null, popover: null, hideTimeoutId: null };
  let infoDocumentListenersReady = false;
  let mobileActivePanel = 'presets';
  let lastExpandedPanel = 'presets';

  function computeViewportHeight() {
    if (window.visualViewport && Number.isFinite(window.visualViewport.height)) {
      return window.visualViewport.height;
    }
    const doc = document.documentElement;
    const docHeight = doc && Number.isFinite(doc.clientHeight) ? doc.clientHeight : 0;
    const winHeight = Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
    return Math.max(docHeight, winHeight, 0);
  }

  function updateViewportMetrics() {
    const nextHeight = Math.max(0, Math.round(computeViewportHeight()));
    if (nextHeight <= 0) {
      return viewportState.height;
    }
    viewportState.height = nextHeight;
    const rootStyle = document.documentElement?.style;
    if (rootStyle) {
      rootStyle.setProperty('--app-viewport-height', `${nextHeight}px`);
      const safeMax = Math.max(0, Math.round(nextHeight - 12));
      const maxHeight = Math.min(nextHeight, Math.max(220, safeMax));
      rootStyle.setProperty('--panel-max-height', `${maxHeight}px`);
    }
    return viewportState.height;
  }

  updateViewportMetrics();

  function closeActiveInfoPopover() {
    if (!infoPopoverState.trigger || !infoPopoverState.popover) {
      return;
    }
    const { trigger, popover } = infoPopoverState;
    if (infoPopoverState.hideTimeoutId !== null) {
      clearTimeout(infoPopoverState.hideTimeoutId);
      infoPopoverState.hideTimeoutId = null;
    }
    trigger.setAttribute('aria-expanded', 'false');
    popover.classList.remove('is-visible');
    popover.setAttribute('aria-hidden', 'true');
    const timeoutId = window.setTimeout(() => {
      if (!popover.classList.contains('is-visible')) {
        popover.hidden = true;
      }
      if (infoPopoverState.hideTimeoutId === timeoutId) {
        infoPopoverState.hideTimeoutId = null;
      }
    }, 220);
    infoPopoverState.trigger = null;
    infoPopoverState.popover = null;
    infoPopoverState.hideTimeoutId = timeoutId;
  }

  function openInfoPopover(trigger, popover) {
    if (!trigger || !popover) {
      return;
    }
    if (infoPopoverState.trigger === trigger) {
      closeActiveInfoPopover();
      return;
    }
    closeActiveInfoPopover();
    if (infoPopoverState.hideTimeoutId !== null) {
      clearTimeout(infoPopoverState.hideTimeoutId);
      infoPopoverState.hideTimeoutId = null;
    }
    popover.hidden = false;
    popover.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      popover.classList.add('is-visible');
    });
    trigger.setAttribute('aria-expanded', 'true');
    infoPopoverState.trigger = trigger;
    infoPopoverState.popover = popover;
  }

  function ensureInfoDocumentListeners() {
    if (infoDocumentListenersReady) {
      return;
    }
    infoDocumentListenersReady = true;
    document.addEventListener('click', event => {
      if (!infoPopoverState.trigger || !infoPopoverState.popover) {
        return;
      }
      const target = event.target;
      if (!target) return;
      if (infoPopoverState.popover.contains(target)) return;
      if (infoPopoverState.trigger.contains(target)) return;
      closeActiveInfoPopover();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && infoPopoverState.trigger) {
        closeActiveInfoPopover();
      }
    });
  }

  function setupInfoPopovers() {
    ensureInfoDocumentListeners();
    document.querySelectorAll('[data-info-target]').forEach(trigger => {
      if (!trigger || trigger.dataset.infoInitialized === 'true') {
        return;
      }
      const targetId = trigger.dataset.infoTarget;
      if (!targetId) return;
      const popover = document.getElementById(targetId);
      if (!popover) return;
      trigger.dataset.infoInitialized = 'true';
      trigger.setAttribute('aria-expanded', 'false');
      popover.hidden = true;
      popover.setAttribute('aria-hidden', 'true');
      trigger.addEventListener('click', event => {
        event.preventDefault();
        openInfoPopover(trigger, popover);
      });
    });
  }

  const panelSwipeState = {
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    active: false,
  };

  function resetPanelSwipeState() {
    panelSwipeState.pointerId = null;
    panelSwipeState.startX = 0;
    panelSwipeState.startY = 0;
    panelSwipeState.startTime = 0;
    panelSwipeState.active = false;
  }

  function movePanelBySwipe(direction) {
    if (!isMobileSheetActive()) return false;
    const order = PANEL_ORDER.filter(key => controlPanelRegistry.has(key));
    if (order.length === 0) return false;
    const currentKey = order.includes(mobileActivePanel) ? mobileActivePanel : order[0];
    const currentIndex = order.indexOf(currentKey);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= order.length) {
      return false;
    }
    const nextKey = order[nextIndex];
    expandControlPanel(nextKey, { fromTab: true });
    return true;
  }

  function startPanelSwipe(event) {
    if (!isMobileSheetActive() || !panelVisible) return;
    if (!event || !event.isPrimary) return;
    if (sheetState.pointerId !== null) return;
    const pointerType = event.pointerType || '';
    if (pointerType === 'mouse') return;
    const target = event.target;
    const inTabs = target ? target.closest('.control-panel-tabs') : null;
    if (target) {
      if (target.closest('.sheet-handle')) return;
      if (!inTabs && target.closest('button, input, select, textarea, a, [data-no-swipe]')) return;
    }
    panelSwipeState.pointerId = event.pointerId;
    panelSwipeState.startX = Number.isFinite(event.clientX) ? event.clientX : 0;
    panelSwipeState.startY = Number.isFinite(event.clientY) ? event.clientY : 0;
    panelSwipeState.startTime = performance.now();
    panelSwipeState.active = true;
  }

  function handlePanelSwipeMove(event) {
    if (!panelSwipeState.active || !event || event.pointerId !== panelSwipeState.pointerId) {
      return;
    }
    const dx = Number.isFinite(event.clientX) ? event.clientX - panelSwipeState.startX : 0;
    const dy = Number.isFinite(event.clientY) ? event.clientY - panelSwipeState.startY : 0;
    if (Math.abs(dy) > Math.abs(dx) * 1.4) {
      resetPanelSwipeState();
    }
  }

  function finishPanelSwipe(event) {
    if (!panelSwipeState.active || !event || event.pointerId !== panelSwipeState.pointerId) {
      return;
    }
    const dx = Number.isFinite(event.clientX) ? event.clientX - panelSwipeState.startX : 0;
    const dy = Number.isFinite(event.clientY) ? event.clientY - panelSwipeState.startY : 0;
    const elapsed = performance.now() - panelSwipeState.startTime;
    resetPanelSwipeState();
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      return;
    }
    const absX = Math.abs(dx);
    const quickSwipe = absX > 28 && elapsed < 220;
    if (!quickSwipe && absX < 50) {
      return;
    }
    const direction = dx < 0 ? 1 : -1;
    movePanelBySwipe(direction);
  }

  function cancelPanelSwipe(event) {
    if (!panelSwipeState.active) {
      return;
    }
    if (event && panelSwipeState.pointerId !== null && event.pointerId !== panelSwipeState.pointerId) {
      return;
    }
    resetPanelSwipeState();
  }

  document.querySelectorAll('.control-panel[data-panel]').forEach(panelEl => {
    const key = panelEl.dataset.panel;
    if (!key) return;
    const toggle = panelEl.querySelector('[data-panel-toggle]');
    const expanded = !panelEl.classList.contains('is-collapsed');
    controlPanelRegistry.set(key, { el: panelEl, toggle, expanded });
    updatePanelToggleLabel(controlPanelRegistry.get(key), expanded);
    if (expanded) {
      lastExpandedPanel = key;
    }
    panelEl.hidden = !expanded;
    panelEl.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const entry = controlPanelRegistry.get(key);
        if (!entry) return;
        if (entry.expanded) {
          collapseControlPanel(key);
        } else {
          expandControlPanel(key);
        }
      });
    }
  });

  document.querySelectorAll('[data-panel-tab]').forEach(tab => {
    const key = tab.dataset.panelTab;
    if (!key) return;
    controlPanelTabs.set(key, tab);
    tab.addEventListener('click', () => {
      closeActiveInfoPopover();
      const entry = controlPanelRegistry.get(key);
      if (!entry) return;
      if (mobileSheetQuery.matches) {
        expandControlPanel(key, { fromTab: true });
        return;
      }
      expandControlPanel(key, { fromTab: true });
    });
  });

  function updatePanelToggleLabel(entry, expanded) {
    if (!entry || !entry.toggle) return;
    const label = expanded ? 'Panel einklappen' : 'Panel einblenden';
    entry.toggle.textContent = expanded ? '⬇️' : '⬆️';
    entry.toggle.setAttribute('aria-label', label);
  }

  function syncPanelTabs(activeKey) {
    controlPanelTabs.forEach((tab, key) => {
      const active = Boolean(activeKey && key === activeKey);
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function collapseControlPanel(key, { skipTab = false } = {}) {
    const entry = controlPanelRegistry.get(key);
    if (!entry || !entry.expanded) {
      if (!skipTab && mobileSheetQuery.matches) {
        syncPanelTabs(mobileActivePanel);
      }
      return;
    }
    entry.expanded = false;
    entry.el.classList.add('is-collapsed');
    entry.el.setAttribute('aria-hidden', 'true');
    if (entry.toggle) {
      entry.toggle.setAttribute('aria-expanded', 'false');
    }
    entry.el.hidden = true;
    if (infoPopoverState.popover && entry.el.contains(infoPopoverState.popover)) {
      closeActiveInfoPopover();
    }
    updatePanelToggleLabel(entry, false);
    if (mobileSheetQuery.matches) {
      if (!skipTab) {
        syncPanelTabs(mobileActivePanel);
      }
    } else if (!skipTab) {
      if (lastExpandedPanel === key) {
        const fallback = Array.from(controlPanelRegistry.entries()).find(([, value]) => value.expanded);
        lastExpandedPanel = fallback ? fallback[0] : null;
      }
      syncPanelTabs(lastExpandedPanel);
    }
  }

  function expandControlPanel(key, { fromTab = false } = {}) {
    closeActiveInfoPopover();
    const entry = controlPanelRegistry.get(key);
    if (!entry) return;
    if (entry.expanded && !mobileSheetQuery.matches) {
      if (fromTab) {
        lastExpandedPanel = key;
        syncPanelTabs(lastExpandedPanel);
      }
      return;
    }
    entry.expanded = true;
    entry.el.classList.remove('is-collapsed');
    entry.el.setAttribute('aria-hidden', 'false');
    entry.el.hidden = false;
    if (entry.toggle) {
      entry.toggle.setAttribute('aria-expanded', 'true');
    }
    updatePanelToggleLabel(entry, true);
    lastExpandedPanel = key;
    controlPanelRegistry.forEach((otherEntry, otherKey) => {
      if (otherKey !== key) {
        collapseControlPanel(otherKey, { skipTab: true });
      }
    });
    if (mobileSheetQuery.matches) {
      mobileActivePanel = key;
    }
    syncPanelTabs(key);
  }

  function initializeControlPanels() {
    const availablePanels = PANEL_ORDER.filter(panelKey => controlPanelRegistry.has(panelKey));
    if (mobileSheetQuery.matches) {
      if (!controlPanelRegistry.has(mobileActivePanel)) {
        mobileActivePanel = availablePanels[0] || null;
      }
      if (mobileActivePanel) {
        expandControlPanel(mobileActivePanel, { fromTab: true });
      }
    } else {
      if (!controlPanelRegistry.has(lastExpandedPanel)) {
        lastExpandedPanel = availablePanels[0] || null;
      }
      if (lastExpandedPanel) {
        expandControlPanel(lastExpandedPanel, { fromTab: true });
      }
      controlPanelRegistry.forEach((entry, key) => {
        if (key !== lastExpandedPanel) {
          collapseControlPanel(key, { skipTab: true });
        }
      });
      syncPanelTabs(lastExpandedPanel);
    }
  }

  mobileSheetQuery.addEventListener('change', () => {
    if (!mobileSheetQuery.matches) {
      mobileActivePanel = 'presets';
    } else if (!controlPanelRegistry.get(mobileActivePanel)?.expanded) {
      mobileActivePanel = 'presets';
    }
    initializeControlPanels();
    setupInfoPopovers();
    closeActiveInfoPopover();
  });

  initializeControlPanels();
  setupInfoPopovers();

  audioUI.panel = $('audioPanel');
  audioUI.body = $('audioPanelBody');
  audioUI.toggle = $('audioPanelToggle');
  audioUI.fileInput = $('audioFile');
  audioUI.fileMeta = $('audioFileMeta');
  audioUI.playlistMeta = $('audioPlaylistMeta');
  audioUI.playlistList = $('audioPlaylist');
  audioUI.playlistEmpty = $('audioPlaylistEmpty');
  audioUI.currentTitle = $('audioCurrentTitle');
  audioUI.currentDetails = $('audioCurrentDetails');
  audioUI.playBtn = $('audioPlay');
  audioUI.stopBtn = $('audioStop');
  audioUI.prevBtn = $('audioPrev');
  audioUI.nextBtn = $('audioNext');
  audioUI.repeatBtn = $('audioRepeat');
  audioUI.micStartBtn = $('audioMicStart');
  audioUI.micStopBtn = $('audioMicStop');
  audioUI.statusText = $('audioStatus');
  audioUI.statusDot = $('audioStatusDot');
  audioUI.modifierButtons = Array.from(document.querySelectorAll('#audioModifierGrid [data-modifier]'));

  renderPatternPresets();
  renderDistributionChips();
  setCurrentPattern(currentPatternName);

  loadUserPresetsFromStorage();
  setPresetGalleryMode(userPresetState.galleryMode);
  renderUserPresets();

  if (customPresetUI.form) {
    customPresetUI.form.addEventListener('submit', handlePresetFormSubmit);
  }
  if (customPresetUI.galleryModeButtons.length) {
    customPresetUI.galleryModeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const desired = button.dataset.galleryMode === 'list' ? 'list' : 'grid';
        setPresetGalleryMode(desired);
      });
    });
  }
  if (customPresetUI.randomBtn) {
    customPresetUI.randomBtn.addEventListener('click', () => {
      if (userPresetState.selected.size === 0) {
        return;
      }
      const active = autoRandomState.enabled && autoRandomState.mode === 'presets';
      setAutoRandomEnabled(!active || autoRandomState.mode !== 'presets', { mode: 'presets' });
    });
    updatePresetRandomButton();
  }

  audioUI.intensityControls = new Map();
  audioUI.supportNotice = $('audioSupportNotice');
  audioUI.intensityControls = new Map();
  audioUI.supportNotice = $('audioSupportNotice');
  audioUI.autoRandomBtn = $('audioRandomMode');
  audioUI.overlay = $('audioOverlay');
  audioUI.overlayButton = $('audioOverlayButton');
  audioUI.brightnessAdaptationBtn = $('brightnessAdaptationToggle');

  stlUI.input = $('stlFiles');
  stlUI.meta = $('stlFileMeta');
  stlUI.clearBtn = $('stlClear');
  stlDistributionOption = document.querySelector('#pDistribution option[value="stl"]');
  updateStlOptionAvailability();

  if (stlUI.input) {
    stlUI.input.addEventListener('change', event => {
      const files = event.target.files ? Array.from(event.target.files).filter(Boolean) : [];
      loadStlFilesFromInput(files).catch(error => {
        console.error('Fehler beim Verarbeiten der STL-Auswahl:', error);
        updateStlMeta([], { error: 'Fehler beim Laden der STL-Dateien.' });
      });
    });
  }
  if (stlUI.clearBtn) {
    stlUI.clearBtn.addEventListener('click', () => {
      clearStlModels();
    });
  }

  updateStlMeta([]);

  if (audioUI.toggle && audioUI.body) {
    audioUI.toggle.addEventListener('click', () => {
      const expanded = audioUI.toggle.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      audioUI.toggle.setAttribute('aria-expanded', String(next));
      if (next) {
        audioUI.body.hidden = false;
        if (audioUI.panel) audioUI.panel.classList.remove('is-collapsed');
      } else {
        audioUI.body.hidden = true;
        if (audioUI.panel) audioUI.panel.classList.add('is-collapsed');
      }
    });
  }

  document.querySelectorAll('[data-intensity-target]').forEach(input => {
    const key = input.dataset.intensityTarget;
    if (!key || !(key in AUDIO_INTENSITY_DEFAULTS)) return;
    const container = input.closest('[data-intensity-row]') || input.parentElement;
    const valueEl = document.querySelector(`[data-intensity-value="${key}"]`);
    const limitInput = container ? container.querySelector(`[data-intensity-limit="${key}"]`) : null;
    audioUI.intensityControls.set(key, { input, valueEl, container, limitInput });
    const limit = getAudioIntensityLimit(key);
    const baseValue = audioState.intensity && key in audioState.intensity
      ? audioState.intensity[key]
      : (AUDIO_INTENSITY_BASE_DEFAULTS[key] || limit || 1);
    const limitPercent = clampIntensityPercent(limit * 100, (AUDIO_INTENSITY_LIMIT_DEFAULTS[key] || 1) * 100, 200);
    const initialPercent = limit > 0
      ? clampIntensityPercent((Number.isFinite(baseValue) ? baseValue : limit) / limit * 100, 0, 100)
      : 0;
    input.value = String(initialPercent);
    input.setAttribute('aria-valuemin', '0');
    input.setAttribute('aria-valuemax', '100');
    if (valueEl) {
      valueEl.textContent = `${initialPercent}% (Max ${limitPercent}%)`;
      valueEl.setAttribute('title', `Aktuell ${initialPercent}% von ${limitPercent}%`);
    }
    if (limitInput) {
      limitInput.value = String(limitPercent);
      limitInput.addEventListener('input', event => {
        setAudioIntensityLimit(key, event.target.value);
      });
      limitInput.addEventListener('change', event => {
        setAudioIntensityLimit(key, event.target.value);
      });
    }
    input.addEventListener('input', event => {
      setAudioIntensity(key, event.target.value);
    });
  });
  syncAudioIntensityControls();

  function updateAutoRandomButton(forceDisabled = false) {
    if (!audioUI.autoRandomBtn) return;
    const disabled = Boolean(forceDisabled || experienceState.editingMode);
    if (disabled) {
      audioUI.autoRandomBtn.disabled = true;
      audioUI.autoRandomBtn.setAttribute('aria-disabled', 'true');
    } else {
      audioUI.autoRandomBtn.disabled = false;
      audioUI.autoRandomBtn.removeAttribute('aria-disabled');
    }
    const active = autoRandomState.enabled && autoRandomState.mode === 'parameters';
    audioUI.autoRandomBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    audioUI.autoRandomBtn.textContent = active ? '🔀 Komplett Random an' : '🔀 Komplett Random aus';
  }

  function scheduleNextAutoRandom() {
    const min = autoRandomState.minInterval;
    const max = autoRandomState.maxInterval;
    const playing = audioState.playing || audioState.usingMic;
    const drive = playing ? Math.max(audioState.metrics.energy, audioState.metrics.bass, audioState.metrics.wave) : 0;
    const baseInterval = min + Math.random() * Math.max(0, max - min);
    const modulation = playing ? Math.max(0.45, 1 - Math.min(0.65, drive * 0.8)) : 1;
    const interval = Math.max(6, baseInterval * modulation);
    autoRandomState.nextTrigger = autoRandomState.elapsed + interval;
  }

  function setAutoRandomEnabled(enabled, { mode = autoRandomState.mode } = {}) {
    const desiredMode = mode === 'presets' ? 'presets' : 'parameters';
    const allow = !experienceState.editingMode && Boolean(enabled);
    const modeChanged = autoRandomState.mode !== desiredMode;
    const shouldEnable = allow && (desiredMode === 'parameters' || userPresetState.selected.size > 0);
    if (desiredMode === 'presets' && allow && userPresetState.selected.size === 0 && customPresetUI.hint) {
      customPresetUI.hint.textContent = 'Bitte wähle mindestens ein Preset für den Shuffle aus.';
    }
    const statusChanged = autoRandomState.enabled !== shouldEnable || modeChanged;
    autoRandomState.mode = desiredMode;
    if (!statusChanged) {
      updateAutoRandomButton();
      updatePresetRandomButton();
      return;
    }
    autoRandomState.enabled = shouldEnable;
    autoRandomState.nudgeAccumulator = 0;
    if (autoRandomState.enabled) {
      autoRandomState.elapsed = 0;
      scheduleNextAutoRandom();
    } else {
      autoRandomState.nextTrigger = Infinity;
    }
    if (desiredMode !== 'presets' || !autoRandomState.enabled) {
      autoRandomState.lastPresetId = null;
    }
    updateAutoRandomButton();
    updatePresetRandomButton();
  }

  function isUserInteractingWithControls() {
    const active = document.activeElement;
    if (!active || active === document.body) return false;
    if (panel && panel.contains(active)) return true;
    if (audioUI.panel && audioUI.panel.contains(active)) return true;
    return false;
  }

  function nudgeSliderValue(id, delta) {
    const handler = sliderHandlers[id];
    const getter = sliderValueGetters[id];
    if (typeof handler !== 'function' || typeof getter !== 'function') {
      return false;
    }
    const current = Number(getter());
    const change = Number(delta);
    if (!Number.isFinite(current) || !Number.isFinite(change) || Math.abs(change) < 1e-4) {
      return false;
    }
    const next = clampToSliderBounds(id, current + change);
    if (!Number.isFinite(next) || Math.abs(next - current) < 1e-4) {
      return false;
    }
    handler(next);
    return true;
  }

  function applyAudioDrivenTweaks(delta, playing) {
    if (!playing) {
      autoRandomState.nudgeAccumulator = 0;
      return false;
    }
    if (isUserInteractingWithControls()) {
      autoRandomState.nudgeAccumulator = 0;
      return false;
    }
    autoRandomState.nudgeAccumulator += delta;
    const dynamicInterval = Math.max(0.18, autoRandomState.nudgeInterval - audioState.metrics.wave * 0.2);
    if (autoRandomState.nudgeAccumulator < dynamicInterval) {
      return false;
    }
    autoRandomState.nudgeAccumulator = 0;

    const bass = audioState.metrics.bass;
    const energy = audioState.metrics.energy;
    const wave = audioState.metrics.wave;
    const treble = audioState.metrics.treble;
    const drive = Math.max(bass * 1.15 + energy * 0.75, wave * 0.9 + treble * 0.7);
    const gain = Math.max(0, Math.min(1.6, drive * (0.6 + getAudioIntensity('scale') * 0.4)));
    if (gain < 0.18) {
      return false;
    }

    const operations = [
      () => nudgeSliderValue('pMotionSpeed', randomRange(-0.32, 0.52) * gain),
      () => nudgeSliderValue('pMotionAmplitude', randomRange(-4.5, 5.5) * gain),
      () => nudgeSliderValue('pMotionNoiseStrength', randomRange(-0.38, 0.6) * gain),
      () => nudgeSliderValue('pMotionNoiseScale', randomRange(-0.38, 0.42) * gain),
      () => nudgeSliderValue('pColorSpeed', randomRange(-0.45, 0.65) * gain),
      () => nudgeSliderValue('pColorIntensity', randomRange(-0.35, 0.35) * gain),
      () => nudgeSliderValue('pHueSpread', randomRange(-16, 18) * gain),
      () => nudgeSliderValue('pHue', (treble * 35 - 17) * gain + randomRange(-8, 8) * gain),
      () => nudgeSliderValue('pSaturation', randomRange(-0.18, 0.22) * gain),
      () => nudgeSliderValue('pValue', randomRange(-0.15, 0.2) * gain),
      () => nudgeSliderValue('pPointAlpha', randomRange(-0.12, 0.15) * gain),
      () => nudgeSliderValue('pSizeVar', randomRange(-0.42, 0.5) * gain),
      () => nudgeSliderValue('pSizeSmall', randomRange(-0.24, 0.28) * gain * 0.6),
      () => nudgeSliderValue('pSizeMedium', randomRange(-0.24, 0.28) * gain * 0.6),
      () => nudgeSliderValue('pSizeLarge', randomRange(-0.24, 0.28) * gain * 0.6)
    ];
    const attempts = Math.max(1, Math.min(operations.length, Math.round(2 + drive * 4)));
    let changed = false;
    for (let i = 0; i < attempts && operations.length; i++) {
      const index = Math.floor(Math.random() * operations.length);
      const op = operations.splice(index, 1)[0];
      if (op && op()) {
        changed = true;
      }
    }
    return changed;
  }

  function updateAutoRandom(delta) {
    if (experienceState.editingMode) {
      autoRandomState.elapsed = 0;
      autoRandomState.nextTrigger = Infinity;
      return;
    }
    autoRandomState.elapsed += delta;
    if (!autoRandomState.enabled) {
      return;
    }
    if (autoRandomState.mode === 'presets' && userPresetState.selected.size === 0) {
      setAutoRandomEnabled(false, { mode: 'parameters' });
      return;
    }
    const playing = audioState.playing || audioState.usingMic;
    if (autoRandomState.elapsed >= autoRandomState.nextTrigger) {
      if (playing) {
        if (autoRandomState.mode === 'presets') {
          playRandomPresetFromSelection();
        } else {
          randomizeParameters({ syncUI: true });
        }
      }
      scheduleNextAutoRandom();
    }
    if (autoRandomState.mode === 'parameters') {
      const nudged = applyAudioDrivenTweaks(delta, playing);
      if (nudged) {
        setSliders();
      }
    }
  }

  if (audioUI.modifierButtons.length) {
    audioUI.modifierButtons.forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.modifier;
        if (key) {
          toggleAudioModifier(key);
        }
      });
    });
  }

  if (audioUI.autoRandomBtn) {
    audioUI.autoRandomBtn.addEventListener('click', () => {
      const active = autoRandomState.enabled && autoRandomState.mode === 'parameters';
      setAutoRandomEnabled(!active || autoRandomState.mode !== 'parameters', { mode: 'parameters' });
    });
    updateAutoRandomButton(false);
  }

  if (audioUI.overlayButton) {
    audioUI.overlayButton.addEventListener('click', async () => {
      if (audioUI.overlayButton.disabled) return;
      audioUI.overlayButton.disabled = true;
      audioUI.overlayButton.setAttribute('aria-busy', 'true');
      const started = await requestPlaybackStart({ preferCurrent: false });
      if (!started && shouldShowAudioOverlay()) {
        audioUI.overlayButton.disabled = false;
      }
      audioUI.overlayButton.removeAttribute('aria-busy');
      updateAudioOverlayVisibility();
    });
  }

  setAutoRandomEnabled(false);
  updateAudioOverlayVisibility();

  document.addEventListener('keydown', event => {
    if ((event.code !== 'Space' && event.key !== ' ') || event.defaultPrevented) {
      return;
    }
    if (event.repeat) {
      return;
    }
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName))) {
      return;
    }
    event.preventDefault();
    if (audioState.playing || audioState.usingMic) {
      stopAudioFromUser();
      setEditingMode(true, { skipStop: true });
    } else {
      requestPlaybackStart({ preferCurrent: true });
    }
  });

  if (audioUI.brightnessAdaptationBtn) {
    audioUI.brightnessAdaptationBtn.addEventListener('click', () => {
      setBrightnessAdaptationEnabled(!isBrightnessAdaptationEnabled());
    });
    updateBrightnessAdaptationButton();
  }

  if (audioUI.fileInput) {
    audioUI.fileInput.addEventListener('change', event => {
      const files = event.target.files ? Array.from(event.target.files).filter(Boolean) : [];
      if (!files.length) {
        if (!audioState.playing && !audioState.usingMic) {
          setAudioStatus('Audio-Reaktivität inaktiv', 'idle');
        }
        event.target.value = '';
        return;
      }
      if (audioState.usingMic) {
        stopAudioPlayback();
      }
      const hadPlaylist = getPlaylistLength() > 0;
      const firstNewIndex = setPlaylist(files, { append: true, activateFirstNew: !hadPlaylist });
      const label = files.length === 1
        ? (files[0].name || 'Audio-Datei')
        : `${files.length} Titel`;
      if (firstNewIndex !== -1) {
        const statusLabel = hadPlaylist ? 'Playlist erweitert' : 'Playlist geladen';
        setAudioStatus(`${statusLabel} – ${label}`, 'idle');
      } else {
        setAudioStatus('Diese Dateien befinden sich bereits in der Playlist.', 'warning');
      }
      refreshAudioUI();
      event.target.value = '';
    });
  }

  if (audioUI.playlistList) {
    audioUI.playlistList.addEventListener('click', event => {
      const button = event.target.closest('button.audio-playlist__item');
      if (!button || button.disabled) return;
      const index = Number(button.dataset.index);
      if (!Number.isFinite(index)) return;
      const changed = setCurrentTrack(index, { updateMeta: true });
      if (!changed) {
        refreshAudioUI();
        return;
      }
      if (audioState.playing && !audioState.usingMic) {
        playSelectedFile();
      } else {
        const name = audioState.fileName || 'Audio';
        setAudioStatus(`Titel ausgewählt – ${name}`, 'idle');
      }
      refreshAudioUI();
    });
  }

  if (audioUI.playBtn) {
    audioUI.playBtn.addEventListener('click', () => {
      requestPlaybackStart({ preferCurrent: true });
    });
  }

  if (audioUI.stopBtn) {
    audioUI.stopBtn.addEventListener('click', () => {
      stopAudioFromUser();
    });
  }

  if (audioUI.prevBtn) {
    audioUI.prevBtn.addEventListener('click', () => {
      playPreviousTrack({ wrap: true });
    });
  }

  if (audioUI.nextBtn) {
    audioUI.nextBtn.addEventListener('click', () => {
      playNextTrack({ wrap: true });
    });
  }

  if (audioUI.repeatBtn) {
    audioUI.repeatBtn.addEventListener('click', () => {
      cycleRepeatMode();
    });
  }

  if (patternUI.focusBtn) {
    patternUI.focusBtn.addEventListener('click', () => {
      focusOnFeldappenCenter({ repositionCamera: true });
    });
  }

  if (patternUI.randomPresetBtn) {
    patternUI.randomPresetBtn.addEventListener('click', () => {
      const appliedName = generateRandomBiome({ syncUI: true, repositionCamera: true });
      if (appliedName) {
        setCurrentPattern(appliedName);
      }
    });
  }

  if (presetStudioUI.shuffleBtn) {
    presetStudioUI.shuffleBtn.addEventListener('click', () => {
      randomizeParameters({ syncUI: true });
      setPresetStudioStatus('Zufällige Szene aktiviert.', 'success');
    });
  }

  if (presetStudioUI.restoreBtn) {
    presetStudioUI.restoreBtn.addEventListener('click', () => {
      const applied = applyScenePreset(INITIAL_SCENE_PRESET, {
        syncUI: true,
        patternName: 'Ausgangsszene',
        patternDescription: 'Zurück zur Standard-Konfiguration.',
      });
      if (applied) {
        setPresetStudioStatus('Ausgangsszene wiederhergestellt.', 'success');
      } else {
        setPresetStudioStatus('Ausgangsszene konnte nicht geladen werden.', 'error');
      }
    });
  }

  if (presetStudioUI.copyBtn) {
    presetStudioUI.copyBtn.addEventListener('click', async () => {
      const copied = await copyCurrentPresetToClipboard();
      if (copied) {
        setPresetStudioStatus('Preset in die Zwischenablage kopiert.', 'success');
      } else {
        setPresetStudioStatus('Preset konnte nicht kopiert werden.', 'error');
      }
    });
  }

  if (audioUI.micStartBtn) {
    audioUI.micStartBtn.addEventListener('click', () => {
      startMicrophone();
    });
  }

  if (audioUI.micStopBtn) {
    audioUI.micStopBtn.addEventListener('click', () => {
      stopAudioFromUser();
    });
  }

  if (audioUI.fileMeta || audioUI.playlistMeta) {
    updateAudioFileMeta(audioState.selectedFile);
  }
  setAudioStatus('Audio-Reaktivität inaktiv', 'idle');
  refreshAudioUI();
  presetPlaylistPromise = ensurePresetPlaylistInitialized();
  let panelVisible = false;
  let audioPanelVisible = false;
  let cameraLocked = false;

  function isMobileSheetActive() {
    return mobileSheetQuery.matches;
  }

  function getSheetCompactOffset() {
    return Math.max(0, sheetState.expandedHeight - sheetState.compactHeight);
  }

  function setAudioPanelVisible(show) {
    audioPanelVisible = !!show;
    if (audioUI.panel) {
      audioUI.panel.classList.toggle('is-hidden', !audioPanelVisible);
      audioUI.panel.setAttribute('aria-hidden', audioPanelVisible ? 'false' : 'true');
    }
  }

  function updateSheetHandleAria() {
    if (!sheetHandleBtn) return;
    if (!isMobileSheetActive()) {
      sheetHandleBtn.setAttribute('tabindex', '-1');
      sheetHandleBtn.setAttribute('aria-expanded', 'false');
      sheetHandleBtn.setAttribute('aria-hidden', 'true');
      sheetHandleBtn.style.pointerEvents = 'none';
      const label = 'Panel vergrößern';
      sheetHandleBtn.setAttribute('aria-label', label);
      const labelSpan = sheetHandleBtn.querySelector('.sheet-handle-label');
      if (labelSpan) labelSpan.textContent = label;
      return;
    }
    sheetHandleBtn.style.pointerEvents = '';
    sheetHandleBtn.removeAttribute('aria-hidden');
    sheetHandleBtn.setAttribute('tabindex', '0');
    const expanded = panelVisible && sheetState.mode === 'expanded';
    const label = expanded ? 'Panel verkleinern' : 'Panel vergrößern';
    sheetHandleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    sheetHandleBtn.setAttribute('aria-label', label);
    const labelSpan = sheetHandleBtn.querySelector('.sheet-handle-label');
    if (labelSpan) labelSpan.textContent = label;
  }

  function applySheetOffset() {
    if (!isMobileSheetActive()) {
      panel.style.removeProperty('--sheet-offset');
      sheetState.lastOffset = 0;
      return;
    }
    const compactOffset = getSheetCompactOffset();
    let offset = sheetState.mode === 'expanded' ? 0 : compactOffset;
    if (!panelVisible) {
      offset = compactOffset;
    }
    sheetState.lastOffset = offset;
    panel.style.setProperty('--sheet-offset', `${Math.max(0, Math.round(offset))}px`);
  }

  function setSheetMode(mode, options = {}) {
    const next = mode === 'expanded' ? 'expanded' : 'compact';
    if (sheetState.mode === next && !options.force) return;
    sheetState.mode = next;
    panel.dataset.sheetState = next;
    applySheetOffset();
    updateSheetHandleAria();
  }

  function recalculateSheetMetrics() {
    if (!isMobileSheetActive()) {
      sheetState.expandedHeight = 0;
      sheetState.compactHeight = 0;
      panel.style.removeProperty('--sheet-expanded-height');
      panel.style.removeProperty('--sheet-compact-height');
      panel.removeAttribute('data-sheet-state');
      applySheetOffset();
      updateSheetHandleAria();
      return;
    }
    const vh = Math.max(viewportState.height || window.innerHeight || 0, 0);
    const minSceneHeight = Math.max(0, Math.round(vh * 0.5));
    const allowed = Math.max(0, vh - minSceneHeight);
    const baseCompact = Math.max(0, Math.round(vh * 0.3));
    let compact = Math.max(baseCompact, 140);
    if (allowed > 0) {
      compact = Math.min(compact, allowed);
    }
    if (allowed < 140) {
      compact = allowed;
    }
    compact = Math.max(0, compact);
    sheetState.compactHeight = Math.round(compact);
    const maxAvailable = Math.max(sheetState.compactHeight, Math.max(0, Math.round(vh - 56)));
    const proposedExpanded = Math.max(sheetState.compactHeight + 80, Math.round(vh * 0.88));
    sheetState.expandedHeight = Math.min(Math.max(proposedExpanded, sheetState.compactHeight), maxAvailable);
    panel.style.setProperty('--sheet-expanded-height', `${sheetState.expandedHeight}px`);
    panel.style.setProperty('--sheet-compact-height', `${sheetState.compactHeight}px`);
    if (sheetState.mode !== 'expanded') {
      sheetState.mode = 'compact';
    } else if (sheetState.expandedHeight <= sheetState.compactHeight) {
      sheetState.mode = 'compact';
    }
    applySheetOffset();
    updateSheetHandleAria();
  }

  function handleMobileMediaChange() {
    sheetState.pointerId = null;
    sheetState.moved = false;
    sheetState.preventClick = false;
    panel.classList.remove('is-dragging');
    closeActiveInfoPopover();
    if (!isMobileSheetActive()) {
      sheetState.mode = 'compact';
      panel.removeAttribute('data-sheet-state');
    } else if (panelVisible) {
      setSheetMode('compact', { force: true });
    }
    recalculateSheetMetrics();
  }

  function setPanelVisible(show) {
    panelVisible = !!show;
    if (panelCloseBtn) {
      panelCloseBtn.hidden = !panelVisible;
      panelCloseBtn.setAttribute('aria-expanded', panelVisible ? 'true' : 'false');
      panelCloseBtn.setAttribute('aria-hidden', panelVisible ? 'false' : 'true');
    }
    if (!panel) {
      setAudioPanelVisible(panelVisible);
      return;
    }
    closeActiveInfoPopover();
    cancelPanelSwipe();
    panel.classList.toggle('is-hidden', !panelVisible);
    panel.setAttribute('aria-hidden', panelVisible ? 'false' : 'true');
    if (panelCloseBtn) {
      panelCloseBtn.setAttribute('aria-expanded', panelVisible ? 'true' : 'false');
    }
    if (isMobileSheetActive()) {
      if (panelVisible) {
        setSheetMode('compact', { force: true });
      }
      applySheetOffset();
    } else {
      panel.removeAttribute('data-sheet-state');
    }
    setAudioPanelVisible(panelVisible);
    if (!panelVisible) {
      sheetState.mode = 'compact';
      panel.removeAttribute('data-sheet-state');
      if (sheetState.pointerId !== null && panel.releasePointerCapture) {
        try { panel.releasePointerCapture(sheetState.pointerId); } catch (err) { /* noop */ }
      }
      sheetState.pointerId = null;
      sheetState.moved = false;
      sheetState.preventClick = false;
      panel.classList.remove('is-dragging');
      sheetState.lastOffset = getSheetCompactOffset();
      applySheetOffset();
    }
    updateSheetHandleAria();
  }

  function updateEditModeButton() {
    if (!editModeBtn) return;
    const active = experienceState.editingMode;
    editModeBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    editModeBtn.textContent = active ? '🛠️ Bearbeitungsmodus an' : '🛠️ Bearbeitungsmodus aus';
    const label = active
      ? 'Bearbeitungsmodus aktiv – Panels bleiben sichtbar.'
      : 'Bearbeitungsmodus deaktiviert.';
    editModeBtn.setAttribute('aria-label', label);
  }

  function setEditingMode(enabled, { skipStop = false, skipPanelRestore = false } = {}) {
    const next = Boolean(enabled);
    if (experienceState.editingMode === next) {
      updateEditModeButton();
      return;
    }
    experienceState.editingMode = next;
    updateEditModeButton();
    if (next) {
      experienceState.editingPreviousPanel = panelVisible;
      setPanelVisible(true);
      setAutoRandomEnabled(false);
      if (!skipStop) {
        stopAudioFromUser();
      } else {
        refreshAudioUI();
      }
      resetAudioReactivity();
      applyAudioVisualState();
      restoreInterfaceAfterPlayback();
      updateAudioOverlayVisibility();
    } else {
      const prevPanel = experienceState.editingPreviousPanel;
      experienceState.editingPreviousPanel = null;
      if (!skipPanelRestore) {
        if (prevPanel !== null) {
          setPanelVisible(prevPanel);
        }
      }
      updateAudioOverlayVisibility();
    }
    updateAutoRandomButton();
    updatePresetRandomButton();
  }

  function getDefaultPanelVisibility() {
    return window.innerWidth > 580;
  }

  function hideInterfaceForPlayback({ remember = true } = {}) {
    if (experienceState.editingMode) {
      experienceState.panelsHiddenForPlayback = false;
      return;
    }
    if (experienceState.panelsHiddenForPlayback) return;
    if (remember) {
      if (experienceState.previousPanelVisible === null) {
        experienceState.previousPanelVisible = panelVisible;
      }
    }
    setPanelVisible(false);
    experienceState.panelsHiddenForPlayback = true;
  }

  function restoreInterfaceAfterPlayback() {
    if (!experienceState.panelsHiddenForPlayback) return;
    if (experienceState.editingMode) {
      setPanelVisible(true);
      experienceState.panelsHiddenForPlayback = false;
      experienceState.previousPanelVisible = null;
      return;
    }
    const desiredPanel = experienceState.previousPanelVisible;
    const shouldShowPanel = (desiredPanel === null) ? getDefaultPanelVisibility() : desiredPanel;
    setPanelVisible(shouldShowPanel);
    experienceState.panelsHiddenForPlayback = false;
    experienceState.previousPanelVisible = null;
  }

  function notifyPlaybackStarted() {
    if (experienceState.editingMode) {
      setEditingMode(false, { skipStop: true, skipPanelRestore: true });
    }
    hideInterfaceForPlayback({ remember: true });
    experienceState.started = true;
    experienceState.pendingOverlayStart = false;
  }

  function notifyPlaybackStopped() {
    experienceState.pendingOverlayStart = false;
    restoreInterfaceAfterPlayback();
  }

  function prepareExperienceForPlayback() {
    if (experienceState.editingMode) {
      setEditingMode(false, { skipStop: true, skipPanelRestore: true });
    }
    if (!experienceState.started && experienceState.previousPanelVisible === null) {
      experienceState.previousPanelVisible = getDefaultPanelVisibility();
    }
    const presetName = generateRandomBiome({ syncUI: true, repositionCamera: true });
    if (presetName) {
      setCurrentPattern(presetName);
    }
    setAutoRotation(false);
    experienceState.pendingOverlayStart = true;
    hideInterfaceForPlayback({ remember: true });
  }

  function setCameraLocked(lock) {
    cameraLocked = lock;
    controls.enabled = !lock;
    controls.enablePan = !lock;
    controls.enableZoom = !lock;
    controls.enableRotate = !lock;
    if (lock) {
      controls.target.copy(clusterGroup.position);
    }
    controls.update();
    if (lockBtn) {
      lockBtn.textContent = lock ? '🔒 Kamera gesperrt' : '🔓 Kamera frei';
      lockBtn.setAttribute('aria-pressed', lock ? 'true' : 'false');
    }
    renderer.domElement.classList.toggle('locked', lock);
  }

  function startSheetDrag(event) {
    if (!sheetHandleBtn || !isMobileSheetActive() || !panelVisible) return;
    sheetState.pointerId = event.pointerId;
    sheetState.startY = event.clientY;
    sheetState.startOffset = sheetState.mode === 'expanded' ? 0 : getSheetCompactOffset();
    sheetState.lastOffset = sheetState.startOffset;
    sheetState.moved = false;
    sheetState.preventClick = false;
    panel.classList.add('is-dragging');
    if (panel.setPointerCapture) {
      try { panel.setPointerCapture(event.pointerId); } catch (err) { /* noop */ }
    }
  }

  function handleSheetDragMove(event) {
    if (sheetState.pointerId === null || event.pointerId !== sheetState.pointerId) return;
    const delta = event.clientY - sheetState.startY;
    const maxOffset = getSheetCompactOffset();
    let next = sheetState.startOffset + delta;
    if (!Number.isFinite(next)) next = 0;
    const hideLimit = maxOffset + SHEET_EXTRA_DRAG_PX;
    if (next > maxOffset) {
      const overshoot = Math.min(hideLimit - maxOffset, next - maxOffset);
      next = maxOffset + overshoot * 0.6;
    }
    next = Math.max(0, Math.min(hideLimit, next));
    if (Math.abs(delta) > 6) {
      sheetState.moved = true;
    }
    sheetState.lastOffset = next;
    panel.style.setProperty('--sheet-offset', `${Math.max(0, Math.round(next))}px`);
  }

  function finishSheetDrag(event) {
    if (sheetState.pointerId === null || event.pointerId !== sheetState.pointerId) return;
    if (panel.releasePointerCapture) {
      try { panel.releasePointerCapture(event.pointerId); } catch (err) { /* noop */ }
    }
    panel.classList.remove('is-dragging');
    const moved = sheetState.moved;
    const lastOffset = sheetState.lastOffset;
    sheetState.pointerId = null;
    sheetState.moved = false;
    const maxOffset = getSheetCompactOffset();
    const hideThreshold = maxOffset + SHEET_HIDE_TRIGGER_PX;
    if (lastOffset >= hideThreshold) {
      setPanelVisible(false);
      sheetState.preventClick = true;
      return;
    }
    if (moved) {
      const threshold = maxOffset * 0.45;
      const nextState = lastOffset > threshold ? 'compact' : 'expanded';
      setSheetMode(nextState, { force: true });
      sheetState.preventClick = true;
    } else {
      sheetState.preventClick = false;
      applySheetOffset();
    }
  }

  /* Rotation dynamics */
  const autoSpinBtn = $('autoSpin');
  const spinStopBtn = $('spinStop');
  const spinInertiaBtn = $('spinInertia');
  const spinDecaySlider = $('spinDecay');
  const spinDecayValue = $('vSpinDecay');
  const spinInertiaValue = $('vInertia');
  const spinAxisSliders = {
    x: $('spinVelX'),
    y: $('spinVelY'),
    z: $('spinVelZ'),
  };
  const spinAxisValues = {
    x: $('vSpinX'),
    y: $('vSpinY'),
    z: $('vSpinZ'),
  };
  const spinSpeedSlider = $('spinSpeed');
  const spinSpeedValue = $('vSpinSpeed');
  const spinAxisKeys = ['x', 'y', 'z'];

  const spinState = {
    autoEnabled: false,
    inertiaEnabled: true,
    inertiaDuration: 12,
    velocity: new THREE.Vector3(),
    velocityComponents: new THREE.Vector3(),
    speedMultiplier: 1,
    isDragging: false,
    activePointerId: null,
    prevPointerTime: 0,
    decayStartSpeed: 0,
    decayTime: 0,
    controlsSnapshot: null,
  };

  const spinVectors = {
    prev: new THREE.Vector3(),
    curr: new THREE.Vector3(),
    axis: new THREE.Vector3(),
  };

  const MAX_AUTO_SPIN_SPEED = 20;
  const defaultSpinSpeed = 0.2;
  const defaultSpinAxis = new THREE.Vector3(0, 1, 0);
  const spinApplyAxis = new THREE.Vector3();

  function enforceMaxSpinSpeed(updateComponents = true) {
    const speed = spinState.velocity.length();
    if (speed <= MAX_AUTO_SPIN_SPEED) {
      return false;
    }
    spinState.velocity.setLength(MAX_AUTO_SPIN_SPEED);
    if (updateComponents) {
      if (Math.abs(spinState.speedMultiplier) <= 1e-6) {
        spinState.velocityComponents.copy(spinState.velocity);
      } else {
        spinState.velocityComponents.copy(spinState.velocity).divideScalar(spinState.speedMultiplier);
      }
      spinAxisKeys.forEach(axis => {
        const id = axis === 'x' ? 'spinVelX' : axis === 'y' ? 'spinVelY' : 'spinVelZ';
        spinState.velocityComponents[axis] = clampToSliderBounds(id, spinState.velocityComponents[axis]);
      });
      spinState.velocity.set(
        spinState.velocityComponents.x * spinState.speedMultiplier,
        spinState.velocityComponents.y * spinState.speedMultiplier,
        spinState.velocityComponents.z * spinState.speedMultiplier,
      );
    }
    return true;
  }

  function syncSpinSliderUI() {
    spinAxisKeys.forEach(axis => {
      const slider = spinAxisSliders[axis];
      const valueEl = spinAxisValues[axis];
      const component = spinState.velocityComponents[axis];
      const id = axis === 'x' ? 'spinVelX' : axis === 'y' ? 'spinVelY' : 'spinVelZ';
      if (slider) {
        applySliderValue(id, component);
      }
      if (valueEl) {
        valueEl.textContent = formatDisplayNumber(component, 2) + ' rad/s';
      }
    });
    if (spinSpeedSlider) {
      applySliderValue('spinSpeed', spinState.speedMultiplier);
    }
    if (spinSpeedValue) {
      spinSpeedValue.textContent = '×' + formatDisplayNumber(spinState.speedMultiplier, 2);
    }
  }

  function updateVelocityFromComponents() {
    spinState.velocity.set(
      spinState.velocityComponents.x * spinState.speedMultiplier,
      spinState.velocityComponents.y * spinState.speedMultiplier,
      spinState.velocityComponents.z * spinState.speedMultiplier,
    );
    enforceMaxSpinSpeed(true);
  }

  function updateComponentsFromVelocity(syncUI = true) {
    if (Math.abs(spinState.speedMultiplier) <= 1e-6) {
      spinState.velocityComponents.copy(spinState.velocity);
    } else {
      spinState.velocityComponents.copy(spinState.velocity).divideScalar(spinState.speedMultiplier);
    }
    spinAxisKeys.forEach(axis => {
      const id = axis === 'x' ? 'spinVelX' : axis === 'y' ? 'spinVelY' : 'spinVelZ';
      spinState.velocityComponents[axis] = clampToSliderBounds(id, spinState.velocityComponents[axis]);
    });
    if (syncUI) {
      syncSpinSliderUI();
    }
  }

  function setSpinAxisComponent(axis, value) {
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) return;
    const id = axis === 'x' ? 'spinVelX' : axis === 'y' ? 'spinVelY' : 'spinVelZ';
    const clamped = clampToSliderBounds(id, numeric);
    spinState.velocityComponents[axis] = clamped;
    updateVelocityFromComponents();
    handleVelocityChange();
  }

  function setSpinSpeedMultiplier(value) {
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) return;
    const clamped = clampToSliderBounds('spinSpeed', numeric);
    spinState.speedMultiplier = clamped;
    updateVelocityFromComponents();
    handleVelocityChange();
  }

  function handleVelocityChange(updateUI = true) {
    const speed = spinState.velocity.length();
    spinState.decayTime = 0;
    if (spinState.autoEnabled && spinState.inertiaEnabled && speed > 1e-6) {
      spinState.decayStartSpeed = speed;
    } else if (!spinState.autoEnabled || speed <= 1e-6) {
      spinState.decayStartSpeed = 0;
    } else {
      spinState.decayStartSpeed = 0;
    }
    if (updateUI) {
      updateRotationUI();
    }
  }

  function clearSpinVelocity({ resetMultiplier = false, updateUI = true } = {}) {
    spinState.velocity.set(0, 0, 0);
    spinState.velocityComponents.set(0, 0, 0);
    if (resetMultiplier) {
      spinState.speedMultiplier = 1;
    }
    spinState.decayStartSpeed = 0;
    spinState.decayTime = 0;
    if (updateUI) {
      updateRotationUI();
    } else {
      syncSpinSliderUI();
    }
  }

  function hasSpinVelocity() {
    return spinState.velocity.lengthSq() > 1e-8;
  }

  function updateRotationUI() {
    if (!autoSpinBtn) return;
    autoSpinBtn.setAttribute('aria-pressed', spinState.autoEnabled ? 'true' : 'false');
    autoSpinBtn.textContent = spinState.autoEnabled ? '🌀 Auto-Rotation an' : '🌀 Auto-Rotation aus';
    spinInertiaBtn.setAttribute('aria-pressed', spinState.inertiaEnabled ? 'true' : 'false');
    spinInertiaBtn.textContent = spinState.inertiaEnabled ? '🪁 Trägheit an' : '🪁 Trägheit aus';
    if (spinDecaySlider) {
      spinDecaySlider.disabled = !spinState.inertiaEnabled;
      applySliderValue('spinDecay', spinState.inertiaDuration);
    }
    if (spinDecayValue) {
      spinDecayValue.textContent = formatDisplayNumber(spinState.inertiaDuration, 0) + ' s';
    }
    if (spinInertiaValue) {
      spinInertiaValue.textContent = spinState.inertiaEnabled ? 'aktiv' : 'aus';
    }
    const velocityActive = spinState.autoEnabled && hasSpinVelocity();
    if (spinStopBtn) {
      spinStopBtn.disabled = !velocityActive;
      spinStopBtn.setAttribute('aria-disabled', velocityActive ? 'false' : 'true');
    }
    syncSpinSliderUI();
  }

  function stopRotation(updateUI = true) {
    clearSpinVelocity({ updateUI });
  }

  function setAutoRotation(enabled) {
    if (!enabled) {
      spinState.autoEnabled = false;
      clearSpinVelocity({ resetMultiplier: true, updateUI: false });
      updateRotationUI();
      return;
    }
    spinState.autoEnabled = true;
    if (!hasSpinVelocity()) {
      spinState.velocityComponents.copy(defaultSpinAxis).multiplyScalar(defaultSpinSpeed);
    } else {
      updateComponentsFromVelocity(false);
    }
    updateVelocityFromComponents();
    spinState.decayStartSpeed = spinState.inertiaEnabled ? spinState.velocity.length() : 0;
    spinState.decayTime = 0;
    updateRotationUI();
  }

  function setInertiaEnabled(enabled) {
    spinState.inertiaEnabled = enabled;
    if (!enabled) {
      spinState.decayStartSpeed = 0;
      spinState.decayTime = 0;
    } else if (hasSpinVelocity() && !spinState.isDragging) {
      spinState.decayStartSpeed = spinState.velocity.length();
      spinState.decayTime = 0;
    }
    updateRotationUI();
  }

  function setInertiaDuration(seconds) {
    let next = Math.round(Number(seconds));
    if (!Number.isFinite(next)) {
      next = spinState.inertiaDuration;
    }
    const clamped = Math.round(clampToSliderBounds('spinDecay', next));
    spinState.inertiaDuration = clamped;
    if (spinState.inertiaEnabled && !spinState.isDragging && hasSpinVelocity()) {
      spinState.decayStartSpeed = spinState.velocity.length();
      spinState.decayTime = 0;
    }
    updateRotationUI();
  }

  function resetDoubleTapState() {
    doubleTapState.lastTime = 0;
    doubleTapState.lastX = 0;
    doubleTapState.lastY = 0;
    doubleTapState.blockUntil = 0;
  }

  function clearLongPressState() {
    if (longPressState.timerId !== null) {
      clearTimeout(longPressState.timerId);
      longPressState.timerId = null;
    }
    longPressState.pointerId = null;
    longPressState.startX = 0;
    longPressState.startY = 0;
    longPressState.triggered = false;
  }

  function triggerLongPressAction() {
    const now = performance.now();
    resetDoubleTapState();
    doubleTapState.blockUntil = now + DOUBLE_TAP_TIMEOUT_MS;
    setPanelVisible(true);
    if (isMobileSheetActive()) {
      setSheetMode('expanded', { force: true });
    }
  }

  function scheduleLongPress(event) {
    if (!event || event.isPrimary === false) {
      clearLongPressState();
      return;
    }
    const pointerType = typeof event.pointerType === 'string' ? event.pointerType : '';
    if (pointerType !== 'touch' && pointerType !== 'pen') {
      clearLongPressState();
      return;
    }
    clearLongPressState();
    longPressState.pointerId = event.pointerId;
    longPressState.startX = Number.isFinite(event.clientX) ? event.clientX : 0;
    longPressState.startY = Number.isFinite(event.clientY) ? event.clientY : 0;
    longPressState.timerId = window.setTimeout(() => {
      longPressState.timerId = null;
      if (longPressState.pointerId === null) {
        return;
      }
      longPressState.triggered = true;
      triggerLongPressAction();
    }, LONG_PRESS_DURATION_MS);
  }

  function handleLongPressMove(event) {
    if (longPressState.pointerId === null || event.pointerId !== longPressState.pointerId) {
      return;
    }
    if (longPressState.triggered) {
      return;
    }
    const x = Number.isFinite(event.clientX) ? event.clientX : 0;
    const y = Number.isFinite(event.clientY) ? event.clientY : 0;
    const distance = Math.hypot(x - longPressState.startX, y - longPressState.startY);
    if (distance > LONG_PRESS_DISTANCE_PX) {
      clearLongPressState();
    }
  }

  function handleLongPressEnd(event) {
    if (longPressState.pointerId === null || event.pointerId !== longPressState.pointerId) {
      return;
    }
    const triggered = longPressState.triggered;
    clearLongPressState();
    if (triggered && event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  }

  async function triggerDoubleTapAction() {
    if (!panelVisible && isMobileSheetActive()) {
      setPanelVisible(true);
      return;
    }
    randomizeParameters({ syncUI: true });
    try {
      const started = await requestPlaybackStart({ preferCurrent: false });
      if (!started) {
        setAudioStatus('Preset-Playlist nicht verfügbar – zufällige Szene ohne Musik.', 'warning');
        refreshAudioUI();
      }
    } catch (error) {
      console.warn('Doppeltipp-Aktion fehlgeschlagen:', error);
    }
  }

  async function handleScenePointerTap(event) {
    if (!event) return;
    if (spinState.isDragging) return;
    const pointerType = event.pointerType || '';
    if (pointerType === 'mouse' && typeof event.button === 'number' && event.button !== 0) {
      return;
    }
    if (event.isPrimary === false) {
      return;
    }
    const now = performance.now();
    if (now <= doubleTapState.blockUntil) {
      return;
    }
    const x = Number.isFinite(event.clientX) ? event.clientX : 0;
    const y = Number.isFinite(event.clientY) ? event.clientY : 0;
    if (doubleTapState.lastTime > 0) {
      const delta = now - doubleTapState.lastTime;
      const distance = Math.hypot(x - doubleTapState.lastX, y - doubleTapState.lastY);
      if (delta <= DOUBLE_TAP_TIMEOUT_MS && distance <= DOUBLE_TAP_DISTANCE_PX) {
        resetDoubleTapState();
        doubleTapState.blockUntil = now + DOUBLE_TAP_TIMEOUT_MS;
        if (!panelVisible) {
          setPanelVisible(true);
          if (isMobileSheetActive()) {
            setSheetMode('compact', { force: true });
          }
        } else {
          await triggerDoubleTapAction();
        }
        return;
      }
    }
    doubleTapState.lastTime = now;
    doubleTapState.lastX = x;
    doubleTapState.lastY = y;
  }

  async function handleSceneDoubleClick(event) {
    const now = performance.now();
    if (now <= doubleTapState.blockUntil) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      return;
    }
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    resetDoubleTapState();
    doubleTapState.blockUntil = now + DOUBLE_TAP_TIMEOUT_MS;
    if (!panelVisible) {
      setPanelVisible(true);
      if (isMobileSheetActive()) {
        setSheetMode('compact', { force: true });
      }
      return;
    }
    await triggerDoubleTapAction();
  }

  function projectOnTrackball(clientX, clientY, target) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((clientY - rect.top) / rect.height) * -2 + 1;
    target.set(x, y, 0);
    const lengthSq = x * x + y * y;
    if (lengthSq <= 1) {
      target.z = Math.sqrt(1 - lengthSq);
    } else {
      target.normalize();
    }
    return target;
  }

  function onSpinPointerDown(e) {
    if (!spinState.autoEnabled || e.button !== 0) return;
    resetDoubleTapState();
    doubleTapState.blockUntil = performance.now() + DOUBLE_TAP_TIMEOUT_MS;
    spinState.isDragging = true;
    spinState.activePointerId = e.pointerId;
    spinState.decayTime = 0;
    spinState.prevPointerTime = performance.now();
    projectOnTrackball(e.clientX, e.clientY, spinVectors.prev);
    spinState.controlsSnapshot = {
      enabled: controls.enabled,
      enableRotate: controls.enableRotate,
    };
    controls.enabled = false;
    controls.enableRotate = false;
    if (renderer.domElement.setPointerCapture) {
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
  }

  function onSpinPointerMove(e) {
    if (!spinState.isDragging || e.pointerId !== spinState.activePointerId) return;
    projectOnTrackball(e.clientX, e.clientY, spinVectors.curr);
    const dot = THREE.MathUtils.clamp(spinVectors.prev.dot(spinVectors.curr), -1, 1);
    const angle = Math.acos(dot);
    if (angle > 1e-5) {
      spinVectors.axis.crossVectors(spinVectors.prev, spinVectors.curr);
      if (spinVectors.axis.lengthSq() > 1e-6) {
        spinVectors.axis.normalize();
        clusterGroup.rotateOnAxis(spinVectors.axis, angle);
        const now = performance.now();
        const dt = Math.max((now - spinState.prevPointerTime) / 1000, 1e-3);
        spinState.prevPointerTime = now;
        spinState.velocity.copy(spinVectors.axis).multiplyScalar(angle / dt);
        enforceMaxSpinSpeed(true);
        updateComponentsFromVelocity();
      }
    }
    spinVectors.prev.copy(spinVectors.curr);
  }

  function onSpinPointerUp(e) {
    if (!spinState.isDragging) return;
    if (typeof e.pointerId === 'number' && spinState.activePointerId !== null && e.pointerId !== spinState.activePointerId) {
      return;
    }
    if (renderer.domElement.releasePointerCapture && spinState.activePointerId !== null) {
      try {
        if (!renderer.domElement.hasPointerCapture || renderer.domElement.hasPointerCapture(spinState.activePointerId)) {
          renderer.domElement.releasePointerCapture(spinState.activePointerId);
        }
      } catch (err) {
        // ignore release errors
      }
    }
    spinState.isDragging = false;
    spinState.activePointerId = null;
    if (!spinState.autoEnabled) {
      stopRotation(false);
    } else if (spinState.inertiaEnabled && hasSpinVelocity()) {
      spinState.decayStartSpeed = spinState.velocity.length();
      spinState.decayTime = 0;
    } else {
      spinState.decayStartSpeed = 0;
      spinState.decayTime = 0;
    }
    if (spinState.controlsSnapshot) {
      controls.enabled = spinState.controlsSnapshot.enabled;
      controls.enableRotate = spinState.controlsSnapshot.enableRotate;
      spinState.controlsSnapshot = null;
      controls.update();
    }
    updateRotationUI();
  }

  renderer.domElement.addEventListener('pointerdown', onSpinPointerDown);
  renderer.domElement.addEventListener('pointermove', onSpinPointerMove);
  renderer.domElement.addEventListener('pointerup', onSpinPointerUp);
  renderer.domElement.addEventListener('pointercancel', onSpinPointerUp);
  renderer.domElement.addEventListener('pointerleave', e => {
    if (spinState.isDragging) {
      onSpinPointerUp(e);
    }
  });
  renderer.domElement.addEventListener('pointerdown', scheduleLongPress);
  renderer.domElement.addEventListener('pointermove', handleLongPressMove);
  renderer.domElement.addEventListener('pointerup', handleLongPressEnd);
  renderer.domElement.addEventListener('pointercancel', handleLongPressEnd);
  renderer.domElement.addEventListener('pointerleave', handleLongPressEnd);
  renderer.domElement.addEventListener('pointercancel', resetDoubleTapState);
  renderer.domElement.addEventListener('pointerup', handleScenePointerTap);
  renderer.domElement.addEventListener('dblclick', handleSceneDoubleClick);

  if (autoSpinBtn) {
    autoSpinBtn.addEventListener('click', () => {
      setAutoRotation(!spinState.autoEnabled);
    });
  }
  if (spinStopBtn) {
    spinStopBtn.addEventListener('click', () => {
      stopRotation();
    });
  }
  if (spinInertiaBtn) {
    spinInertiaBtn.addEventListener('click', () => {
      setInertiaEnabled(!spinState.inertiaEnabled);
    });
  }
  function setCategoryCount(kind, value) {
    const keyMap = { small: 'catSmallCount', medium: 'catMediumCount', large: 'catLargeCount' };
    const key = keyMap[kind];
    if (!key) return;
    const next = Math.max(0, Math.floor(Number(value) || 0));
    if (params[key] === next) {
      return;
    }
    params[key] = next;
    rebuildStars();
  }

  function getSizeRange(sizeVar = params.sizeVar) {
    const min = Math.max(0.05, 1 - sizeVar * 0.5);
    const max = 1 + sizeVar * 0.5;
    return { min, max, delta: max - min };
  }

  function clampValue(value, min, max) {
    let next = Number(value);
    if (!Number.isFinite(next)) return next;
    let minVal = Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY;
    let maxVal = Number.isFinite(max) ? max : Number.POSITIVE_INFINITY;
    if (minVal > maxVal) {
      const tmp = minVal;
      minVal = maxVal;
      maxVal = tmp;
    }
    if (Number.isFinite(minVal)) {
      next = Math.max(next, minVal);
    }
    if (Number.isFinite(maxVal)) {
      next = Math.min(next, maxVal);
    }
    return next;
  }

  function formatDisplayNumber(value, fractionDigits = 2) {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : value.toFixed(fractionDigits);
  }

  const sliderBoundSettings = {};
  const sliderBoundInputs = {};

  function getSliderBounds(id) {
    const slider = $(id);
    const settings = sliderBoundSettings[id];
    let min = settings ? settings.min : undefined;
    let max = settings ? settings.max : undefined;
    if (!Number.isFinite(min) && slider) {
      const rawMin = parseFloat(slider.getAttribute('min'));
      if (Number.isFinite(rawMin)) {
        min = rawMin;
      }
    }
    if (!Number.isFinite(max) && slider) {
      const rawMax = parseFloat(slider.getAttribute('max'));
      if (Number.isFinite(rawMax)) {
        max = rawMax;
      }
    }
    return { min, max };
  }

  function clampToSliderBounds(id, value) {
    const bounds = getSliderBounds(id);
    return clampValue(value, bounds.min, bounds.max);
  }

  function syncSliderUI(id) {
    const slider = $(id);
    const settings = sliderBoundSettings[id];
    if (!slider || !settings) return;
    slider.min = String(settings.min);
    slider.max = String(settings.max);
    const pair = sliderBoundInputs[id];
    if (pair && pair.min && document.activeElement !== pair.min) {
      pair.min.value = settings.min;
    }
    if (pair && pair.max && document.activeElement !== pair.max) {
      pair.max.value = settings.max;
    }
  }

  function handleBoundInputChange(id, kind, inputEl) {
    const settings = sliderBoundSettings[id];
    if (!settings) return;
    let value = parseFloat(inputEl.value);
    if (!Number.isFinite(value)) {
      inputEl.value = settings[kind];
      return;
    }
    if (kind === 'min') {
      settings.min = value;
      if (value > settings.max) {
        settings.max = value;
        const partner = sliderBoundInputs[id] && sliderBoundInputs[id].max;
        if (partner) {
          partner.value = settings.max;
        }
      }
    } else {
      settings.max = value;
      if (value < settings.min) {
        settings.min = value;
        const partner = sliderBoundInputs[id] && sliderBoundInputs[id].min;
        if (partner) {
          partner.value = settings.min;
        }
      }
    }
    inputEl.value = settings[kind];
    syncSliderUI(id);
    const getter = sliderValueGetters[id];
    const handler = sliderHandlers[id];
    if (getter && handler) {
      const current = getter();
      if (Number.isFinite(current)) {
        const clamped = clampValue(current, settings.min, settings.max);
        if (clamped !== current) {
          handler(String(clamped));
        }
      }
    }
    setSliders();
  }

  function registerSliderBounds(id) {
    const slider = $(id);
    if (!slider) return;
    let min = parseFloat(slider.getAttribute('min'));
    let max = parseFloat(slider.getAttribute('max'));
    if (!Number.isFinite(min) && Number.isFinite(max)) {
      min = max < 0 ? max : 0;
    }
    if (!Number.isFinite(max) && Number.isFinite(min)) {
      max = min > 0 ? min : 1;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = min;
    if (min > max) {
      const tmp = min;
      min = max;
      max = tmp;
    }
    sliderBoundSettings[id] = { min, max };
    const wrap = slider.closest('.wrap');
    const labelElement = document.querySelector(`label[for="${id}"]`);
    let descriptor = '';
    if (labelElement && labelElement.textContent) {
      descriptor = labelElement.textContent.replace(/\s+/g, ' ').trim();
    } else if (wrap) {
      const tag = wrap.querySelector('.tag');
      if (tag && tag.textContent) {
        descriptor = tag.textContent.replace(/\s+/g, ' ').trim();
      }
    }
    const minLabel = descriptor ? `${descriptor} – Minimum` : 'Minimum';
    const maxLabel = descriptor ? `${descriptor} – Maximum` : 'Maximum';
    if (wrap) {
      const minInput = wrap.querySelector(`input[data-target="${id}"][data-bound="min"]`);
      const maxInput = wrap.querySelector(`input[data-target="${id}"][data-bound="max"]`);
      sliderBoundInputs[id] = sliderBoundInputs[id] || {};
      const step = slider.step && slider.step.length ? slider.step : 'any';
      const numericStep = Number(step);
      const hasNumericStep = Number.isFinite(numericStep) && step !== 'any';
      const isIntegerStep = hasNumericStep && Number.isInteger(numericStep);
      const inputMode = isIntegerStep ? 'numeric' : 'decimal';
      if (minInput) {
        sliderBoundInputs[id].min = minInput;
        minInput.value = min;
        minInput.step = step;
        minInput.inputMode = inputMode;
        minInput.setAttribute('aria-label', minLabel);
        minInput.title = minLabel;
        minInput.addEventListener('change', event => handleBoundInputChange(id, 'min', event.target));
      }
      if (maxInput) {
        sliderBoundInputs[id].max = maxInput;
        maxInput.value = max;
        maxInput.step = step;
        maxInput.inputMode = inputMode;
        maxInput.setAttribute('aria-label', maxLabel);
        maxInput.title = maxLabel;
        maxInput.addEventListener('change', event => handleBoundInputChange(id, 'max', event.target));
      }
    }
    syncSliderUI(id);
  }

  function initializeSliderBounds() {
    for (const id in sliderValueGetters) {
      registerSliderBounds(id);
    }
  }

  function applySliderValue(id, value) {
    const slider = $(id);
    if (!slider) return value;
    const bounds = getSliderBounds(id);
    const clamped = Number.isFinite(value) ? clampValue(value, bounds.min, bounds.max) : value;
    slider.value = Number.isFinite(clamped) ? clamped : slider.value;
    return Number.isFinite(clamped) ? clamped : value;
  }

  function enforceBounds() {
    let changed = false;
    for (const id in sliderValueGetters) {
      const getter = sliderValueGetters[id];
      const handler = sliderHandlers[id];
      const settings = sliderBoundSettings[id];
      if (!getter || !handler || !settings) continue;
      const current = getter();
      if (!Number.isFinite(current)) continue;
      const clamped = clampValue(current, settings.min, settings.max);
      if (clamped !== current) {
        handler(String(clamped));
        changed = true;
      }
    }
    return changed;
  }

  const sliderHandlers = {
    pCount:       val => {
      params.count = clampTotalCount(val);
      rebuildStars();
    },
    pRadius:      val => { params.radius = parseFloat(val); rebuildStars(); },
    pSizeVar:     val => { params.sizeVar = parseFloat(val); rebuildStars(); },
    pCluster:     val => { params.cluster = parseFloat(val); rebuildStars(); },
    pPointAlpha:  val => { params.pointAlpha = parseFloat(val); updateStarUniforms(); },
    pHue:         val => { params.pointHue = parseFloat(val); updatePointColor(); updateStarUniforms(); updateTinyMaterial(); },
    pSaturation:  val => { params.pointSaturation = parseFloat(val); updatePointColor(); updateStarUniforms(); updateTinyMaterial(); },
    pValue:       val => { params.pointValue = parseFloat(val); updatePointColor(); updateStarUniforms(); updateTinyMaterial(); },
    pColorIntensity: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.colorIntensity = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pColorSpeed: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.colorSpeed = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pHueSpread: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.hueSpread = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pColorPropagationDistance: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.colorPropagationDistance = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pColorPropagationDuration: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.colorPropagationDuration = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pColorToneCount: val => {
      const numeric = parseFloat(val);
      if (!Number.isNaN(numeric)) {
        params.colorToneCount = Math.max(1, Math.round(numeric));
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pSeedStars:   val => { params.seedStars = parseInt(val, 10); rebuildStars(); },
    pCatSmallCount:  val => { setCategoryCount('small', val); },
    pCatMediumCount: val => { setCategoryCount('medium', val); },
    pCatLargeCount:  val => { setCategoryCount('large', val); },
    pSizeTiny:    val => { params.sizeFactorTiny = parseFloat(val); updateTinyMaterial(); },
    pSizeSmall:   val => { params.sizeFactorSmall = parseFloat(val); updateStarUniforms(); },
    pSizeMedium:  val => { params.sizeFactorMedium = parseFloat(val); updateStarUniforms(); },
    pSizeLarge:   val => { params.sizeFactorLarge = parseFloat(val); updateStarUniforms(); },
    pTinyCount:   val => { params.tinyCount = parseInt(val, 10); rebuildTiny(); },
    pConnPercent: val => { params.connPercent = parseFloat(val); rebuildTiny(); },
    pTinyAlpha:   val => { params.tinyAlpha = parseFloat(val); updateTinyMaterial(); },
    pSeedTiny:    val => { params.seedTiny = parseInt(val, 10); rebuildTiny(); },
    pEdgeSoft:    val => { params.edgeSoftness = parseFloat(val); updateStarUniforms(); },
    pMotionSpeed: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.motionSpeed = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pMotionAmplitude: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.motionAmplitude = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pMotionNoiseStrength: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.motionNoiseStrength = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    pMotionNoiseScale: val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        params.motionNoiseScale = next;
        updateStarUniforms();
        updateTinyMaterial();
      }
    },
    spinVelX:     val => { setSpinAxisComponent('x', val); },
    spinVelY:     val => { setSpinAxisComponent('y', val); },
    spinVelZ:     val => { setSpinAxisComponent('z', val); },
    spinSpeed:    val => { setSpinSpeedMultiplier(val); },
    spinDecay:    val => {
      const next = parseFloat(val);
      if (!Number.isNaN(next)) {
        setInertiaDuration(next);
      }
    },
  };

  const sliderValueGetters = {
    pRadius: () => params.radius,
    pSizeVar: () => params.sizeVar,
    pCluster: () => params.cluster,
    pPointAlpha: () => params.pointAlpha,
    pHue: () => params.pointHue,
    pSaturation: () => params.pointSaturation,
    pValue: () => params.pointValue,
    pColorIntensity: () => params.colorIntensity,
    pColorSpeed: () => params.colorSpeed,
    pHueSpread: () => params.hueSpread,
    pColorPropagationDistance: () => params.colorPropagationDistance,
    pColorPropagationDuration: () => params.colorPropagationDuration,
    pColorToneCount: () => params.colorToneCount,
    pSeedStars: () => params.seedStars,
    pSizeTiny: () => params.sizeFactorTiny,
    pSizeSmall: () => params.sizeFactorSmall,
    pSizeMedium: () => params.sizeFactorMedium,
    pSizeLarge: () => params.sizeFactorLarge,
    pTinyCount: () => params.tinyCount,
    pConnPercent: () => params.connPercent,
    pTinyAlpha: () => params.tinyAlpha,
    pSeedTiny: () => params.seedTiny,
    pEdgeSoft: () => params.edgeSoftness,
    pMotionSpeed: () => params.motionSpeed,
    pMotionAmplitude: () => params.motionAmplitude,
    pMotionNoiseStrength: () => params.motionNoiseStrength,
    pMotionNoiseScale: () => params.motionNoiseScale,
    spinVelX: () => spinState.velocityComponents.x,
    spinVelY: () => spinState.velocityComponents.y,
    spinVelZ: () => spinState.velocityComponents.z,
    spinSpeed: () => spinState.speedMultiplier,
    spinDecay: () => spinState.inertiaDuration,
  };

  const colorPickerInput = $('pHueColor');
  const colorSwatchButtons = Array.from(document.querySelectorAll('[data-color-swatch]'));

  function updateColorPickerInput() {
    if (!colorPickerInput) return;
    const hex = hsvToHex(params.pointHue, params.pointSaturation, params.pointValue);
    if (hex && colorPickerInput.value.toLowerCase() !== hex) {
      colorPickerInput.value = hex;
    }
  }

  function updateColorSwatchState() {
    if (!colorSwatchButtons.length) return;
    const hue = normalizeHue(params.pointHue);
    const saturation = clamp01(params.pointSaturation);
    const value = clamp01(params.pointValue);
    colorSwatchButtons.forEach(button => {
      const btnHue = normalizeHue(parseFloat(button.dataset.h));
      const btnSat = clamp01(parseFloat(button.dataset.s));
      const btnVal = clamp01(parseFloat(button.dataset.v));
      const isMatch = hueDifference(hue, btnHue) < 6 &&
        Math.abs(saturation - btnSat) < 0.08 &&
        Math.abs(value - btnVal) < 0.08;
      button.setAttribute('aria-pressed', String(isMatch));
    });
  }

  function applyBaseColorFromHSV(h, s, v, forceUniform = false) {
    params.pointHue = normalizeHue(h);
    params.pointSaturation = clamp01(s);
    params.pointValue = clamp01(v);
    if (forceUniform && params.colorMode !== 'uniform') {
      params.colorMode = 'uniform';
    }
    updatePointColor();
    updateStarUniforms();
    updateTinyMaterial();
    setSliders();
  }

  if (colorPickerInput) {
    const initialHex = hsvToHex(params.pointHue, params.pointSaturation, params.pointValue);
    if (initialHex) {
      colorPickerInput.value = initialHex;
    }
    colorPickerInput.addEventListener('input', event => {
      const hsv = hexToHsv(event.target.value);
      if (!hsv) return;
      applyBaseColorFromHSV(hsv.h, hsv.s, hsv.v, true);
    });
  }

  if (colorSwatchButtons.length) {
    colorSwatchButtons.forEach(button => {
      button.addEventListener('click', () => {
        const h = parseFloat(button.dataset.h);
        const s = parseFloat(button.dataset.s);
        const v = parseFloat(button.dataset.v);
        if ([h, s, v].some(val => Number.isNaN(val))) return;
        applyBaseColorFromHSV(h, s, v, true);
      });
    });
  }

  initializeSliderBounds();
  enforceBounds();
  // assign input event handlers
  for (const id in sliderHandlers) {
    const element = $(id);
    if (!element) continue;
    element.addEventListener('input', e => {
      sliderHandlers[id](e.target.value);
      setSliders();
    });
  }
  // Blending select
  $('pBlending').addEventListener('change', e => {
    params.blending = e.target.value;
    updateStarUniforms();
    updateTinyMaterial();
  });
  $('pDistribution').addEventListener('change', e => {
    const value = e.target.value;
    if (value === 'stl') {
      const applied = useStlAsDistribution({ rememberPrevious: true });
      if (!applied) {
        stlState.displayMode = 'overlay';
        updateStlOptionAvailability();
        const fallback = stlState.previousDistribution && stlState.previousDistribution !== 'stl'
          ? stlState.previousDistribution
          : 'random';
        params.distribution = fallback;
        e.target.value = fallback;
        setSliders();
        updateStlMeta(stlState.files);
        updateStlVisibility();
        return;
      }
      rebuildStars();
      setSliders();
      updateStlVisibility();
      updateStlMeta(stlState.files);
      return;
    }
    if (params.distribution === 'stl') {
      revertFromStlDistribution({ fallback: value });
      stlState.displayMode = 'overlay';
    }
    params.distribution = value;
    rebuildStars();
    setSliders();
    updateStlVisibility();
    updateStlMeta(stlState.files);
  });
  $('pColorMode').addEventListener('change', e => {
    params.colorMode = e.target.value;
    updateStarUniforms();
    updateTinyMaterial();
  });
  $('pMotionMode').addEventListener('change', e => {
    params.motionMode = e.target.value;
    updateStarUniforms();
    updateTinyMaterial();
    setSliders();
  });
  // Filled checkbox
  $('pFilled').addEventListener('change', e => {
    params.filled = e.target.checked;
    updateStarUniforms();
  });

  /* Accordion controls */
  const accordionTriggers = Array.from(document.querySelectorAll('.accordion__trigger'));

  function setAccordionState(trigger, expanded) {
    const panelId = trigger.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;
    trigger.setAttribute('aria-expanded', String(expanded));
    panel.hidden = !expanded;
    trigger.classList.toggle('is-open', expanded);
    panel.classList.toggle('is-open', expanded);
  }

  let firstAccordionExpanded = false;
  accordionTriggers.forEach((trigger, index) => {
    let expanded = trigger.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      if (firstAccordionExpanded) {
        expanded = false;
      } else {
        firstAccordionExpanded = true;
      }
    }
    if (!firstAccordionExpanded && index === accordionTriggers.length - 1) {
      expanded = true;
      firstAccordionExpanded = true;
    }
    setAccordionState(trigger, expanded);
    trigger.addEventListener('click', () => {
      const next = trigger.getAttribute('aria-expanded') !== 'true';
      if (next) {
        accordionTriggers.forEach(other => {
          if (other !== trigger) {
            setAccordionState(other, false);
          }
        });
      }
      setAccordionState(trigger, next);
    });
  });

  if (editModeBtn) {
    editModeBtn.addEventListener('click', () => {
      setEditingMode(!experienceState.editingMode);
    });
  }

  if (sheetHandleBtn) {
    sheetHandleBtn.addEventListener('pointerdown', event => {
      if (!isMobileSheetActive()) return;
      startSheetDrag(event);
    });
    sheetHandleBtn.addEventListener('click', event => {
      if (!isMobileSheetActive()) return;
      if (sheetState.preventClick) {
        sheetState.preventClick = false;
        event.preventDefault();
        return;
      }
      const next = sheetState.mode === 'expanded' ? 'compact' : 'expanded';
      setSheetMode(next, { force: true });
    });
  }

  if (panelCloseBtn) {
    panelCloseBtn.addEventListener('click', () => {
      setPanelVisible(false);
      if (renderer && renderer.domElement && typeof renderer.domElement.focus === 'function') {
        try {
          renderer.domElement.focus({ preventScroll: true });
        } catch (err) {
          renderer.domElement.focus();
        }
      }
    });
  }

  if (panel) {
    panel.addEventListener('pointermove', handleSheetDragMove);
    panel.addEventListener('pointerup', finishSheetDrag);
    panel.addEventListener('pointercancel', finishSheetDrag);

    panel.addEventListener('pointerdown', startPanelSwipe);
    panel.addEventListener('pointermove', handlePanelSwipeMove);
    panel.addEventListener('pointerup', finishPanelSwipe);
    panel.addEventListener('pointercancel', cancelPanelSwipe);
  }

  if (mobileSheetQuery.addEventListener) {
    mobileSheetQuery.addEventListener('change', handleMobileMediaChange);
  } else if (mobileSheetQuery.addListener) {
    mobileSheetQuery.addListener(handleMobileMediaChange);
  }

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      setCameraLocked(!cameraLocked);
    });
  }

  function randomizeParameters({ syncUI = true } = {}) {
    const totalCount = 500 + Math.floor(Math.random() * 7500);
    params.count = clampTotalCount(totalCount);
    params.radius = 60 + Math.random() * 180;
    params.sizeVar = Math.random() * 9.5;
    params.cluster = Math.random() * 0.95;
    params.pointAlpha = 0.3 + Math.random() * 0.7;
    params.pointHue = Math.random() * 360;
    params.pointSaturation = Math.random();
    params.pointValue = 0.3 + Math.random() * 0.7;
    params.seedStars = 1 + Math.floor(Math.random() * 9999);
    const distributions = getAvailableDistributions();
    params.distribution = distributions[Math.floor(Math.random() * distributions.length)] || 'random';
    params.colorMode = COLOR_MODES[Math.floor(Math.random() * COLOR_MODES.length)];
    params.colorIntensity = Math.random();
    params.colorSpeed = Math.random() * 4.5;
    params.hueSpread = Math.random() * 180;
    params.colorPropagationDistance = 40 + Math.random() * 260;
    params.colorPropagationDuration = 0.5 + Math.random() * 9.5;
    params.colorToneCount = 1 + Math.floor(Math.random() * 6);
    const weights = [Math.random(), Math.random(), Math.random()];
    const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
    const provisional = weights.map(value => Math.max(0, Math.floor((value / weightSum) * totalCount)));
    let assigned = provisional.reduce((sum, value) => sum + value, 0);
    let diff = totalCount - assigned;
    let idx = 0;
    const adjustOrder = [0, 1, 2];
    while (diff > 0 && idx < 300) {
      const target = adjustOrder[idx % adjustOrder.length];
      provisional[target] += 1;
      diff -= 1;
      idx += 1;
    }
    params.catSmallCount = provisional[0];
    params.catMediumCount = provisional[1];
    params.catLargeCount = Math.max(0, totalCount - params.catSmallCount - params.catMediumCount);
    params.sizeFactorSmall = 0.5 + Math.random() * 2.5;
    params.sizeFactorMedium = 0.5 + Math.random() * 2.5;
    params.sizeFactorLarge = 0.5 + Math.random() * 2.5;
    params.sizeFactorTiny = 0.05 + Math.random() * 0.6;
    params.tinyCount = Math.floor(Math.random() * 5000);
    params.connPercent = Math.random();
    params.tinyAlpha = Math.random();
    params.seedTiny = 1 + Math.floor(Math.random() * 9999);
    params.edgeSoftness = Math.random();
    params.blending = (Math.random() < 0.5) ? 'Normal' : 'Additive';
    params.filled = Math.random() < 0.3;
    params.motionMode = MOTION_MODES[Math.floor(Math.random() * MOTION_MODES.length)];
    params.motionSpeed = Math.random() * 2.5;
    params.motionAmplitude = Math.random() * 30;
    params.motionNoiseStrength = Math.random() * 2.0;
    params.motionNoiseScale = 0.1 + Math.random() * 3.5;
    enforceBounds();
    updatePointColor();
    rebuildStars();
    setCurrentPattern('Freestyle');
    if (syncUI) {
      setSliders();
    }
  }

  ['random', 'patternRandomParameters'].forEach(id => {
    const button = $(id);
    if (!button) return;
    button.addEventListener('click', () => {
      randomizeParameters({ syncUI: true });
    });
  });

  /* Update slider displays */
  function setSliders() {
    // star params
    params.count = clampTotalCount(params.count);
    params.colorToneCount = Math.max(1, Math.round(Number(params.colorToneCount) || 1));
    updateDistributionChips();
    if ($('pCount')) {
      $('pCount').value = params.count;
    }
    $('vCount').textContent = params.count;
    const radiusValue = applySliderValue('pRadius', params.radius);
    $('vRadius').textContent = formatDisplayNumber(radiusValue, 2);
    $('pDistribution').value = params.distribution;
    const sizeVarValue = applySliderValue('pSizeVar', params.sizeVar);
    const sizeRange = getSizeRange(sizeVarValue);
    $('vSizeVar').textContent = sizeRange.delta.toFixed(2);
    const clusterValue = applySliderValue('pCluster', params.cluster);
    $('vCluster').textContent = formatDisplayNumber(clusterValue, 2);
    const alphaValue = applySliderValue('pPointAlpha', params.pointAlpha);
    $('vPointAlpha').textContent = alphaValue.toFixed(2);
    const hueValue = applySliderValue('pHue', params.pointHue);
    $('vHue').textContent = formatDisplayNumber(hueValue, 1) + '°';
    const saturationValue = applySliderValue('pSaturation', params.pointSaturation);
    $('vSaturation').textContent = (saturationValue * 100).toFixed(0) + '%';
    const valueValue = applySliderValue('pValue', params.pointValue);
    $('vValue').textContent = (valueValue * 100).toFixed(0) + '%';
    updateColorPickerInput();
    updateColorSwatchState();
    $('pColorMode').value = params.colorMode;
    const colorIntensityValue = applySliderValue('pColorIntensity', params.colorIntensity);
    $('vColorIntensity').textContent = (colorIntensityValue * 100).toFixed(0) + '%';
    const colorSpeedValue = applySliderValue('pColorSpeed', params.colorSpeed);
    $('vColorSpeed').textContent = colorSpeedValue.toFixed(2) + '×';
    const hueSpreadValue = applySliderValue('pHueSpread', params.hueSpread);
    $('vHueSpread').textContent = formatDisplayNumber(hueSpreadValue, 1) + '°';
    const colorPropagationDistanceValue = applySliderValue('pColorPropagationDistance', params.colorPropagationDistance);
    $('vColorPropagationDistance').textContent = formatDisplayNumber(colorPropagationDistanceValue, 1) + ' Einheiten';
    const colorPropagationDurationValue = applySliderValue('pColorPropagationDuration', params.colorPropagationDuration);
    $('vColorPropagationDuration').textContent = colorPropagationDurationValue.toFixed(1) + ' s';
    const colorToneCountValue = applySliderValue('pColorToneCount', params.colorToneCount);
    $('vColorToneCount').textContent = formatDisplayNumber(colorToneCountValue, 0) + ' Töne';
    $('pColorMode').value = params.colorMode;
    const seedStarsValue = applySliderValue('pSeedStars', params.seedStars);
    $('vSeedStars').textContent = formatDisplayNumber(seedStarsValue);
    $('pCatSmallCount').value = params.catSmallCount; $('vCatSmallCount').textContent = params.catSmallCount;
    $('pCatMediumCount').value = params.catMediumCount; $('vCatMediumCount').textContent = params.catMediumCount;
    $('pCatLargeCount').value = params.catLargeCount; $('vCatLargeCount').textContent = params.catLargeCount;
    // size factors
    const sizeTinyValue = applySliderValue('pSizeTiny', params.sizeFactorTiny);
    $('vSizeTiny').textContent = sizeTinyValue.toFixed(2);
    const sizeSmallValue = applySliderValue('pSizeSmall', params.sizeFactorSmall);
    $('vSizeSmall').textContent = sizeSmallValue.toFixed(2);
    const sizeMediumValue = applySliderValue('pSizeMedium', params.sizeFactorMedium);
    $('vSizeMedium').textContent = sizeMediumValue.toFixed(2);
    const sizeLargeValue = applySliderValue('pSizeLarge', params.sizeFactorLarge);
    $('vSizeLarge').textContent = sizeLargeValue.toFixed(2);
    // tiny / connection
    const tinyCountValue = applySliderValue('pTinyCount', params.tinyCount);
    $('vTinyCount').textContent = formatDisplayNumber(tinyCountValue);
    const connPercentValue = applySliderValue('pConnPercent', params.connPercent);
    $('vConnPercent').textContent = (connPercentValue * 100).toFixed(0) + '%';
    const tinyAlphaValue = applySliderValue('pTinyAlpha', params.tinyAlpha);
    $('vTinyAlpha').textContent = tinyAlphaValue.toFixed(2);
    const seedTinyValue = applySliderValue('pSeedTiny', params.seedTiny);
    $('vSeedTiny').textContent = formatDisplayNumber(seedTinyValue);
    // motion
    $('pMotionMode').value = params.motionMode;
    const motionSpeedValue = applySliderValue('pMotionSpeed', params.motionSpeed);
    $('vMotionSpeed').textContent = motionSpeedValue.toFixed(2) + '×';
    const motionAmplitudeValue = applySliderValue('pMotionAmplitude', params.motionAmplitude);
    $('vMotionAmplitude').textContent = formatDisplayNumber(motionAmplitudeValue, 1);
    const motionNoiseStrengthValue = applySliderValue('pMotionNoiseStrength', params.motionNoiseStrength);
    $('vMotionNoiseStrength').textContent = motionNoiseStrengthValue.toFixed(2);
    const motionNoiseScaleValue = applySliderValue('pMotionNoiseScale', params.motionNoiseScale);
    $('vMotionNoiseScale').textContent = motionNoiseScaleValue.toFixed(2);
    // edge & blending
    const edgeSoftValue = applySliderValue('pEdgeSoft', params.edgeSoftness);
    $('vEdgeSoft').textContent = edgeSoftValue.toFixed(2);
    $('pBlending').value = params.blending;
    $('pFilled').checked = params.filled;
    updateRotationUI();
  }

  /* Resize handler */
  function handleViewportChange({ recalcRenderer = false } = {}) {
    updateViewportMetrics();
    if (recalcRenderer) {
      const width = Math.max(window.innerWidth || 0, 1);
      const height = Math.max(window.innerHeight || viewportState.height || 0, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    recalculateSheetMetrics();
    if (isMobileSheetActive()) {
      applySheetOffset();
    }
  }

  window.addEventListener('resize', () => {
    handleViewportChange({ recalcRenderer: true });
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      handleViewportChange({ recalcRenderer: true });
    }, 120);
  });

  if (window.visualViewport) {
    const onViewportMetricsChange = () => handleViewportChange();
    window.visualViewport.addEventListener('resize', onViewportMetricsChange);
    window.visualViewport.addEventListener('scroll', onViewportMetricsChange);
  }

  /* Animation loop */
  let lastFrameTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const current = (typeof now === 'number') ? now : performance.now();
    const delta = Math.min(Math.max((current - lastFrameTime) / 1000, 0), 0.25);
    lastFrameTime = current;

    motionState.time += delta;
    if (motionState.time > 1e6) {
      motionState.time = 0;
    }
    if (starMaterial && starMaterial.uniforms && starMaterial.uniforms.uTime) {
      starMaterial.uniforms.uTime.value = motionState.time;
    }
    if (stlMaterial && stlMaterial.uniforms && stlMaterial.uniforms.uTime) {
      stlMaterial.uniforms.uTime.value = motionState.time;
    }
    if (tinyMaterial && tinyMaterial.uniforms && tinyMaterial.uniforms.uTime) {
      tinyMaterial.uniforms.uTime.value = motionState.time;
    }

    if (spinState.autoEnabled && !spinState.isDragging) {
      updateVelocityFromComponents();
      if (spinState.inertiaEnabled && spinState.decayStartSpeed > 0 && hasSpinVelocity()) {
        spinState.decayTime += delta;
        const duration = Math.max(spinState.inertiaDuration, 0.001);
        const progress = Math.min(spinState.decayTime / duration, 1);
        const newSpeed = spinState.decayStartSpeed * (1 - progress);
        if (newSpeed <= 1e-4) {
          stopRotation(false);
          updateRotationUI();
        } else {
          spinState.velocity.setLength(newSpeed);
          updateComponentsFromVelocity();
        }
      }
      const speed = spinState.velocity.length();
      if (speed > 1e-6) {
        spinApplyAxis.copy(spinState.velocity).normalize();
        clusterGroup.rotateOnAxis(spinApplyAxis, speed * delta);
      }
    }

    updateAudioReactive(delta);
    updateAutoRandom(delta);
    applyAudioVisuals(delta, true);

    if (cameraLocked) {
      controls.target.copy(clusterGroup.position);
    }
    controls.update();
    if (!cameraLocked && !controls.target.equals(clusterGroup.position)) {
      clusterGroup.position.copy(controls.target);
    }
    renderer.render(scene, camera);
  }

  /* Initialization */
  setInertiaDuration(spinState.inertiaDuration);
  setInertiaEnabled(spinState.inertiaEnabled);
  setAutoRotation(false);
  handleViewportChange({ recalcRenderer: true });
  const initialPanelVisible = false;
  setPanelVisible(initialPanelVisible);
  const urlParams = new URLSearchParams(window.location.search);
  const startInEditingMode = urlParams.get('edit') === '1' || window.location.hash.includes('edit');
  if (startInEditingMode) {
    setEditingMode(true, { skipStop: true });
  } else {
    updateEditModeButton();
  }
  setCameraLocked(false);
  updatePointColor(false);
  setSliders();
  rebuildStars();
  focusOnFeldappenCenter({ repositionCamera: true });
  applyAudioVisualState();
  requestAnimationFrame(animate);
}
