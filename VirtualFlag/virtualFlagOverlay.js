// Virtual Flag LED Matrix Animation Engine

// Configuration
// Enable TEST_MODE if via query parameter or if explicitly requested
const urlParams = new URLSearchParams(window.location.search);
const TEST_MODE = urlParams.get('test') === 'true' || urlParams.get('edit') === 'true';
const DISPLAY_MODE = urlParams.get('mode') || 'compact'; // 'compact' or 'split'
const TEST_FLAG = urlParams.get('flag'); // specific flag to test (optional)
const SHOW_MESSAGE = urlParams.get('text') !== 'false'; // show message text (default: true)
const PANEL_OPACITY = urlParams.get('opacity') !== null ? parseFloat(urlParams.get('opacity')) : 0.35; // opacity of surrounding box (default: 0.35)
const DEBUG_MODE = urlParams.get('debug') === 'true'; // debug logging (default: false)
const IDLE_FADE_TIMEOUT_SECONDS = urlParams.get('idleFade') !== null ? parseInt(urlParams.get('idleFade')) : 15; // idle fade timeout in seconds (0 = off, default: 15)
const SC_VARIANT = urlParams.get('SCvariant') || 'complex'; // safety car variant: 'simple1', 'simple2', 'complex' (default: complex)

// Debug logging wrapper
const debugLog = (message, ...args) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

debugLog('TEST_MODE enabled:', TEST_MODE);
debugLog('DISPLAY_MODE:', DISPLAY_MODE);
debugLog('TEST_FLAG:', TEST_FLAG);
debugLog('SHOW_MESSAGE:', SHOW_MESSAGE);
debugLog('PANEL_OPACITY:', PANEL_OPACITY);
debugLog('IDLE_FADE_TIMEOUT_SECONDS:', IDLE_FADE_TIMEOUT_SECONDS);
debugLog('URL params:', Object.fromEntries(urlParams));

const MATRIX_COLS_FIXED = DISPLAY_MODE === 'split' ? 8 : 16;
const MATRIX_ROWS_FIXED = 16;

const DEFAULT_SIMPLE_FLAG_FRAME_MS = 750;  // Duration of each simple flag flash state (on or off), in milliseconds
const GAP = 3;
const TINY_MARGIN = 4;

// Calculate Safety Car loop count and duration based on variant
const getSafetyCarConfig = (variant) => {
  switch (variant) {
    case 'simple1':
      // 4 frames × 150ms = 600ms per loop
      return { loopCount: 4, durationMs: 2400 };
    case 'simple2':
      // 2 frames × 1000ms = 2000ms per loop
      return { loopCount: 2, durationMs: 4000 };
    case 'complex':
    default:
      // (8×500 + 8×100 + 1×1000)ms = 5800ms per loop
      return { loopCount: 2, durationMs: 11600 };
  }
};

const SAFETYCAR_CONFIG = getSafetyCarConfig(SC_VARIANT);
const SAFETYCAR_LOOP_COUNT = SAFETYCAR_CONFIG.loopCount;
const SAFETYCAR_DURATION_MS = SAFETYCAR_CONFIG.durationMs;

// Expose to window for CoffeeScript access
window.SAFETYCAR_DURATION_MS = SAFETYCAR_DURATION_MS;
window.SAFETYCAR_LOOP_COUNT = SAFETYCAR_LOOP_COUNT;
window.SC_VARIANT = SC_VARIANT;

debugLog('SC_VARIANT:', SC_VARIANT);
debugLog('SAFETYCAR_LOOP_COUNT:', SAFETYCAR_LOOP_COUNT);
debugLog('SAFETYCAR_DURATION_MS:', SAFETYCAR_DURATION_MS);

// Simple flag frame duration (can be overridden by config.ini) - controls flash speed
let SIMPLE_FLAG_FRAME_MS = DEFAULT_SIMPLE_FLAG_FRAME_MS;

// Frame durations for other flags (can be overridden by config.ini)
let YELLOWWAVING_FRAME_MS = 250;
let BLUE_FRAME_MS = 500;
let PENALTY_FRAME_MS = 500;
let MEATBALL_FRAME_MS = 500;
let SLOWDOWN_FRAME_MS = 500;
let DEBRIS_FRAME_MS = 500;
let DISQUALIFY_FRAME_MS = 1000;
let CHECKERED_FRAME_MS = 500;
let ONELAPTOGREEN_FRAME_MS = 150;
let SAFETYCAR_SIMPLE1_FRAME_MS = 150;
let SAFETYCAR_SIMPLE2_FRAME_MS = 1000;

// Expose to window for CoffeeScript queue access
window.SIMPLE_FLAG_FRAME_MS = SIMPLE_FLAG_FRAME_MS;

// Default flag loop counts (can be overridden by config.ini)
let FLAG_LOOP_COUNTS = {
  'green': 1,
  'yellow': 1,
  'yellowWaving': 1,
  'blue': 4,
  'white': 1,
  'penalty': 4,
  'disqualify': 4,
  'meatball': 4,
  'slowdown': 2,
  'checkered': 4,
  'safetycar': SAFETYCAR_LOOP_COUNT,
  'debris': 1,
  'oneLapToGreen': 2
};

// Default flag enable/disable (can be overridden by config.ini)
let FLAG_ENABLED_CONFIG = {
  'green': true,
  'yellow': true,
  'yellowWaving': true,
  'blue': true,
  'white': true,
  'penalty': true,
  'disqualify': true,
  'meatball': true,
  'slowdown': true,
  'checkered': true,
  'safetycar': true,
  'debris': true,
  'oneLapToGreen': true
};

// Frame duration definitions for calculating total animation time
// Simple flags (green, yellow, white, debris) use SIMPLE_FLAG_FRAME_MS × 2 (on/off)
// Other flags have their own base durations
const FRAME_DURATIONS = {
  'green': -1,              // Uses SIMPLE_FLAG_FRAME_MS
  'yellow': -1,             // Uses SIMPLE_FLAG_FRAME_MS
  'yellowWaving': 2000,     // Waving animation
  'blue': 1000,             // 2 frames × 500ms = 1000ms per loop
  'white': -1,              // Uses SIMPLE_FLAG_FRAME_MS
  'penalty': 1000,          // 2 frames × 500ms = 1000ms per loop
  'disqualify': 1000,       // Animated pattern
  'meatball': 1000,         // Animated pattern
  'slowdown': 1000,         // Animated pattern
  'checkered': 2000,        // Animated pattern
  'safetycar': -1,          // Special: use SAFETYCAR_DURATION_MS
  'debris': -1,             // Uses SIMPLE_FLAG_FRAME_MS
  'oneLapToGreen': 1200     // Animated pattern
};

// Track if config has been loaded
let configLoaded = false;
let configLoadAttempted = false;

// Parse INI configuration file
async function loadConfigFile() {
  if (configLoadAttempted) {
    debugLog('Config file already loaded/attempted');
    return configLoaded;
  }
  
  configLoadAttempted = true;
  
  try {
    debugLog('Attempting to load config.ini...');
    const response = await fetch('config.ini');
    
    if (!response.ok) {
      console.warn('Config file not found (404), using default values');
      debugLog('Config file not found, using defaults');
      configLoaded = true;
      return false;
    }
    
    const text = await response.text();
    console.log('Config file loaded, parsing...');
    parseIniConfig(text);
    configLoaded = true;
    console.log('Config file parsed successfully');
    debugLog('Config file loaded and parsed successfully');
    return true;
  } catch (e) {
    console.error('Error loading config file:', e.message);
    debugLog('Error loading config file:', e);
    configLoaded = true;
    return false;
  }
}

// Parse INI format configuration
function parseIniConfig(iniText) {
  const lines = iniText.split('\n');
  let currentSection = null;
  let flagsEnabledCount = 0;
  let loopCountsCount = 0;
  let simpleFlagFrameUpdated = false;
  let frameDurationsUpdated = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Section headers [section_name]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1);
      continue;
    }
    
    // Parse key=value pairs
    if (trimmed.includes('=')) {
      const [key, value] = trimmed.split('=').map(s => s.trim());
      
      if (currentSection === 'flags_enabled') {
        const flagName = key;
        if (flagName in FLAG_ENABLED_CONFIG) {
          const wasEnabled = FLAG_ENABLED_CONFIG[flagName];
          FLAG_ENABLED_CONFIG[flagName] = value.toLowerCase() === 'true';
          if (wasEnabled !== FLAG_ENABLED_CONFIG[flagName]) {
            console.log(`  [flags_enabled] ${flagName} = ${FLAG_ENABLED_CONFIG[flagName]}`);
          }
          debugLog(`Flag '${flagName}' enabled: ${FLAG_ENABLED_CONFIG[flagName]}`);
          flagsEnabledCount++;
        } else {
          console.warn(`  [flags_enabled] Unknown flag: ${flagName}`);
        }
      } else if (currentSection === 'loop_counts') {
        const flagName = key;
        if (flagName in FLAG_LOOP_COUNTS) {
          const loopCount = parseInt(value);
          if (!isNaN(loopCount) && loopCount > 0) {
            const oldCount = FLAG_LOOP_COUNTS[flagName];
            FLAG_LOOP_COUNTS[flagName] = loopCount;
            if (oldCount !== loopCount) {
              if (DEBUG_MODE) console.log(`  [loop_counts] ${flagName} = ${loopCount} (was ${oldCount})`);
            }
            debugLog(`Flag '${flagName}' custom loop count: ${loopCount}`);
            loopCountsCount++;
          } else {
            console.warn(`  [loop_counts] Invalid value for ${flagName}: ${value}`);
          }
        } else {
          console.warn(`  [loop_counts] Unknown flag: ${flagName}`);
        }
      } else if (currentSection === 'simple_flags') {
        if (key === 'frame_ms') {
          const frameMs = parseInt(value);
          if (!isNaN(frameMs) && frameMs > 0) {
            const oldValue = SIMPLE_FLAG_FRAME_MS;
            SIMPLE_FLAG_FRAME_MS = frameMs;
            if (oldValue !== frameMs) {
              if (DEBUG_MODE) console.log(`  [simple_flags] frame_ms = ${frameMs}ms (was ${oldValue}ms)`);
            }
            debugLog(`Simple flag frame duration: ${frameMs}ms`);
            simpleFlagFrameUpdated = true;
          } else {
            console.warn(`  [simple_flags] Invalid value for frame_ms: ${value}`);
          }
        }
      } else if (currentSection === 'frame_durations') {
        const frameMs = parseInt(value);
        if (!isNaN(frameMs) && frameMs > 0) {
          let updated = false;
          switch(key) {
            case 'yellowWaving_ms':
              if (YELLOWWAVING_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] yellowWaving_ms = ${frameMs}ms (was ${YELLOWWAVING_FRAME_MS}ms)`);
                YELLOWWAVING_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'blue_ms':
              if (BLUE_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] blue_ms = ${frameMs}ms (was ${BLUE_FRAME_MS}ms)`);
                BLUE_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'penalty_ms':
              if (PENALTY_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] penalty_ms = ${frameMs}ms (was ${PENALTY_FRAME_MS}ms)`);
                PENALTY_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'meatball_ms':
              if (MEATBALL_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] meatball_ms = ${frameMs}ms (was ${MEATBALL_FRAME_MS}ms)`);
                MEATBALL_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'slowdown_ms':
              if (SLOWDOWN_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] slowdown_ms = ${frameMs}ms (was ${SLOWDOWN_FRAME_MS}ms)`);
                SLOWDOWN_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'debris_ms':
              if (DEBRIS_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] debris_ms = ${frameMs}ms (was ${DEBRIS_FRAME_MS}ms)`);
                DEBRIS_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'disqualify_ms':
              if (DISQUALIFY_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] disqualify_ms = ${frameMs}ms (was ${DISQUALIFY_FRAME_MS}ms)`);
                DISQUALIFY_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'checkered_ms':
              if (CHECKERED_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] checkered_ms = ${frameMs}ms (was ${CHECKERED_FRAME_MS}ms)`);
                CHECKERED_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'oneLapToGreen_ms':
              if (ONELAPTOGREEN_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] oneLapToGreen_ms = ${frameMs}ms (was ${ONELAPTOGREEN_FRAME_MS}ms)`);
                ONELAPTOGREEN_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'safetycar_simple1_ms':
              if (SAFETYCAR_SIMPLE1_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] safetycar_simple1_ms = ${frameMs}ms (was ${SAFETYCAR_SIMPLE1_FRAME_MS}ms)`);
                SAFETYCAR_SIMPLE1_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            case 'safetycar_simple2_ms':
              if (SAFETYCAR_SIMPLE2_FRAME_MS !== frameMs) {
                if (DEBUG_MODE) console.log(`  [frame_durations] safetycar_simple2_ms = ${frameMs}ms (was ${SAFETYCAR_SIMPLE2_FRAME_MS}ms)`);
                SAFETYCAR_SIMPLE2_FRAME_MS = frameMs;
                updated = true;
              }
              break;
            default:
              console.warn(`  [frame_durations] Unknown setting: ${key}`);
          }
          if (updated) frameDurationsUpdated++;
        } else {
          console.warn(`  [frame_durations] Invalid value for ${key}: ${value}`);
        }
      }
    }
  }
  
  // Expose to window for CoffeeScript queue access
  window.SIMPLE_FLAG_FRAME_MS = SIMPLE_FLAG_FRAME_MS;
  
  // DEBUG: Log all loop counts after parsing
  if (DEBUG_MODE) console.log(`Config parsed: ${flagsEnabledCount} flags_enabled, ${loopCountsCount} loop_counts${simpleFlagFrameUpdated ? ', 1 simple_flags' : ''}${frameDurationsUpdated > 0 ? `, ${frameDurationsUpdated} frame_durations` : ''}`);
  if (DEBUG_MODE) console.log('Parsed FLAG_LOOP_COUNTS:', JSON.stringify(FLAG_LOOP_COUNTS, null, 2));
  if (DEBUG_MODE) console.log('Parsed FLAG_ENABLED_CONFIG:', JSON.stringify(FLAG_ENABLED_CONFIG, null, 2));
}

// Helper function to calculate flag duration from loop count
function calculateFlagDuration(flagName) {
  if (flagName === 'safetycar') {
    // Safety car uses pre-calculated duration
    return SAFETYCAR_DURATION_MS;
  }
  
  const loopCount = FLAG_LOOP_COUNTS[flagName];
  if (loopCount === undefined) {
    console.warn(`Unknown flag for duration calculation: ${flagName}, using default 1500ms`);
    return 1500;
  }
  
  const frameDuration = FRAME_DURATIONS[flagName];
  if (frameDuration === undefined) {
    console.warn(`No frame duration defined for flag: ${flagName}, using default 1500ms`);
    return 1500;
  }
  
  // Special handling for simple flags marked with -1
  if (frameDuration === -1) {
    return SIMPLE_FLAG_FRAME_MS * 2 * loopCount;  // 2 frames for on/off cycle
  }
  
  return frameDuration * loopCount;
}

// Helper function to get flag duration (respects config overrides)
function getFlagDuration(flagName) {
  const duration = calculateFlagDuration(flagName);
  if (DEBUG_MODE) console.log(`[getFlagDuration] ${flagName}: ${duration}ms (loopCount=${FLAG_LOOP_COUNTS[flagName]}, SIMPLE_FLAG_FRAME_MS=${SIMPLE_FLAG_FRAME_MS})`);
  return duration;
}

// Helper function to check if flag is enabled
function isFlagEnabled(flagName) {
  const enabled = FLAG_ENABLED_CONFIG[flagName] !== false;
  if (DEBUG_MODE) console.log(`[isFlagEnabled] ${flagName}: ${enabled}`);
  return enabled;
}

// Global state - will be set by initializeApp()
let panel = null;
let matrix = null;
let matrixLeft = null;
let matrixRight = null;
let messageEl = null;

let leds = [];
let ledsLeft = [];
let ledsRight = [];
let MATRIX_COLS = MATRIX_COLS_FIXED;
let MATRIX_ROWS = MATRIX_ROWS_FIXED;

// Idle fade tracking
let lastFlagTime = Date.now();
let idleFadeTimer = null;
let isFadedOut = false;const sleep = ms => new Promise(res => setTimeout(res, ms));

// --- Frame Sequences ---

// Compact mode (16x16)
const safetyCarFrames = [
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },

  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'white' : 'black', duration: 100 },
  { pattern: () => 'black', duration: 100 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'white' : 'black', duration: 100 },
  { pattern: () => 'black', duration: 100 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'white', duration: 100 },
  { pattern: () => 'black', duration: 100 },
  { pattern: (r, c) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'white', duration: 100 },
  { pattern: () => 'black', duration: 100 },

  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      const S = [
        [4, 3], [5, 3], [6, 3], [7, 3], [11, 3], [4, 4], [7, 4], [11, 4], [4, 5], [8, 5], [11, 5], [4, 6], [8, 6], [9, 6], [10, 6], [11, 6],
      ];
      const C = [
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [11, 10], [4, 11], [11, 11], [4, 12], [11, 12],
      ];
      const isS = S.some(([yr, yc]) => yr === r && yc === c);
      const isC = C.some(([yr, yc]) => yr === r && yc === c);
      if (isBorder || isS || isC) return 'yellow';
      return 'black';
    },
    duration: 1000
  },
];

// Split mode (16x8) - shows 'S' and 'C' together
const safetyCarFrames_split = [
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'black', duration: 500 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'yellow', duration: 500 },

  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'white' : 'black', duration: 100 },
  { pattern: () => 'black', duration: 100 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'white' : 'black', duration: 100 },
  { pattern: () => 'black', duration: 100 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'white', duration: 100 },
  { pattern: () => 'black', duration: 100 },
  { pattern: (r, c, side) => Math.floor(c / 2) % 2 === 0 ? 'black' : 'white', duration: 100 },
  { pattern: () => 'black', duration: 100 },

  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      
      if (side === 'left') {
        // S character for left matrix
        const S = [
          [4, 2], [5, 2], [6, 2], [7, 2], [11, 2], [4, 3], [7, 3], [11, 3], [4, 4], [8, 4], [11, 4], [4, 5], [8, 5], [9, 5], [10, 5], [11, 5],
        ];
        const isS = S.some(([yr, yc]) => yr === r && yc === c);
        if (isBorder || isS) return 'yellow';
      } else {
        // C character for right matrix
        const C = [
          [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [4, 3], [11, 3], [4, 4], [11, 4], [4, 5], [11, 5],
        ];
        const isC = C.some(([yr, yc]) => yr === r && yc === c);
        if (isBorder || isC) return 'yellow';
      }
      return 'black';
    },
    duration: 1000
  },
];

// Safety Car - Simple variant (compact 16x16) - SC coords + animated rotating yellow border
const safetyCarFrames_simple = [
  {
    pattern: (r, c) => {
      const S = [
        [4, 3], [5, 3], [6, 3], [7, 3], [11, 3], [4, 4], [7, 4], [11, 4], [4, 5], [8, 5], [11, 5], [4, 6], [8, 6], [9, 6], [10, 6], [11, 6],
      ];
      const C = [
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [11, 10], [4, 11], [11, 11], [4, 12], [11, 12],
      ];
      const isS = S.some(([yr, yc]) => yr === r && yc === c);
      const isC = C.some(([yr, yc]) => yr === r && yc === c);
      if (isS || isC) return 'yellow';
      if (isBorderAnimated_compact_yellow(r, c, 0)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  },
  {
    pattern: (r, c) => {
      const S = [
        [4, 3], [5, 3], [6, 3], [7, 3], [11, 3], [4, 4], [7, 4], [11, 4], [4, 5], [8, 5], [11, 5], [4, 6], [8, 6], [9, 6], [10, 6], [11, 6],
      ];
      const C = [
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [11, 10], [4, 11], [11, 11], [4, 12], [11, 12],
      ];
      const isS = S.some(([yr, yc]) => yr === r && yc === c);
      const isC = C.some(([yr, yc]) => yr === r && yc === c);
      if (isS || isC) return 'yellow';
      if (isBorderAnimated_compact_yellow(r, c, 1)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  },
  {
    pattern: (r, c) => {
      const S = [
        [4, 3], [5, 3], [6, 3], [7, 3], [11, 3], [4, 4], [7, 4], [11, 4], [4, 5], [8, 5], [11, 5], [4, 6], [8, 6], [9, 6], [10, 6], [11, 6],
      ];
      const C = [
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [11, 10], [4, 11], [11, 11], [4, 12], [11, 12],
      ];
      const isS = S.some(([yr, yc]) => yr === r && yc === c);
      const isC = C.some(([yr, yc]) => yr === r && yc === c);
      if (isS || isC) return 'yellow';
      if (isBorderAnimated_compact_yellow(r, c, 2)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  },
  {
    pattern: (r, c) => {
      const S = [
        [4, 3], [5, 3], [6, 3], [7, 3], [11, 3], [4, 4], [7, 4], [11, 4], [4, 5], [8, 5], [11, 5], [4, 6], [8, 6], [9, 6], [10, 6], [11, 6],
      ];
      const C = [
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [11, 10], [4, 11], [11, 11], [4, 12], [11, 12],
      ];
      const isS = S.some(([yr, yc]) => yr === r && yc === c);
      const isC = C.some(([yr, yc]) => yr === r && yc === c);
      if (isS || isC) return 'yellow';
      if (isBorderAnimated_compact_yellow(r, c, 3)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  }
];

// Safety Car - Simple variant (split 8x16) - SC coords + animated rotating yellow border
const safetyCarFrames_simple_split = [
  {
    pattern: (r, c, side) => {
      if (side === 'left') {
        const S = [
          [4, 2], [5, 2], [6, 2], [7, 2], [11, 2], [4, 3], [7, 3], [11, 3], [4, 4], [8, 4], [11, 4], [4, 5], [8, 5], [9, 5], [10, 5], [11, 5],
        ];
        const isS = S.some(([yr, yc]) => yr === r && yc === c);
        if (isS) return 'yellow';
      } else {
        const C = [
          [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [4, 3], [11, 3], [4, 4], [11, 4], [4, 5], [11, 5],
        ];
        const isC = C.some(([yr, yc]) => yr === r && yc === c);
        if (isC) return 'yellow';
      }
      if (isBorderAnimated_split_yellow(r, c, 0)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      if (side === 'left') {
        const S = [
          [4, 2], [5, 2], [6, 2], [7, 2], [11, 2], [4, 3], [7, 3], [11, 3], [4, 4], [8, 4], [11, 4], [4, 5], [8, 5], [9, 5], [10, 5], [11, 5],
        ];
        const isS = S.some(([yr, yc]) => yr === r && yc === c);
        if (isS) return 'yellow';
      } else {
        const C = [
          [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [4, 3], [11, 3], [4, 4], [11, 4], [4, 5], [11, 5],
        ];
        const isC = C.some(([yr, yc]) => yr === r && yc === c);
        if (isC) return 'yellow';
      }
      if (isBorderAnimated_split_yellow(r, c, 1)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      if (side === 'left') {
        const S = [
          [4, 2], [5, 2], [6, 2], [7, 2], [11, 2], [4, 3], [7, 3], [11, 3], [4, 4], [8, 4], [11, 4], [4, 5], [8, 5], [9, 5], [10, 5], [11, 5],
        ];
        const isS = S.some(([yr, yc]) => yr === r && yc === c);
        if (isS) return 'yellow';
      } else {
        const C = [
          [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [4, 3], [11, 3], [4, 4], [11, 4], [4, 5], [11, 5],
        ];
        const isC = C.some(([yr, yc]) => yr === r && yc === c);
        if (isC) return 'yellow';
      }
      if (isBorderAnimated_split_yellow(r, c, 2)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      if (side === 'left') {
        const S = [
          [4, 2], [5, 2], [6, 2], [7, 2], [11, 2], [4, 3], [7, 3], [11, 3], [4, 4], [8, 4], [11, 4], [4, 5], [8, 5], [9, 5], [10, 5], [11, 5],
        ];
        const isS = S.some(([yr, yc]) => yr === r && yc === c);
        if (isS) return 'yellow';
      } else {
        const C = [
          [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [4, 3], [11, 3], [4, 4], [11, 4], [4, 5], [11, 5],
        ];
        const isC = C.some(([yr, yc]) => yr === r && yc === c);
        if (isC) return 'yellow';
      }
      if (isBorderAnimated_split_yellow(r, c, 3)) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE1_FRAME_MS
  }
];

// Safety Car - Simple2 variant (compact 16x16) - SC coords + solid yellow border + flashing animation
const safetyCarFrames_simple2 = [
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      const S = [
        [4, 3], [5, 3], [6, 3], [7, 3], [11, 3], [4, 4], [7, 4], [11, 4], [4, 5], [8, 5], [11, 5], [4, 6], [8, 6], [9, 6], [10, 6], [11, 6],
      ];
      const C = [
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [11, 10], [4, 11], [11, 11], [4, 12], [11, 12],
      ];
      const isS = S.some(([yr, yc]) => yr === r && yc === c);
      const isC = C.some(([yr, yc]) => yr === r && yc === c);
      if (isBorder || isS || isC) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE2_FRAME_MS
  },
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      if (isBorder) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE2_FRAME_MS
  }
];

// Safety Car - Simple2 variant (split 8x16) - SC coords + solid yellow border + flashing animation
const safetyCarFrames_simple2_split = [
  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      
      if (side === 'left') {
        const S = [
          [4, 2], [5, 2], [6, 2], [7, 2], [11, 2], [4, 3], [7, 3], [11, 3], [4, 4], [8, 4], [11, 4], [4, 5], [8, 5], [9, 5], [10, 5], [11, 5],
        ];
        const isS = S.some(([yr, yc]) => yr === r && yc === c);
        if (isBorder || isS) return 'yellow';
      } else {
        const C = [
          [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [4, 3], [11, 3], [4, 4], [11, 4], [4, 5], [11, 5],
        ];
        const isC = C.some(([yr, yc]) => yr === r && yc === c);
        if (isBorder || isC) return 'yellow';
      }
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE2_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (isBorder) return 'yellow';
      return 'black';
    },
    duration: SAFETYCAR_SIMPLE2_FRAME_MS
  }
];

const penaltyFrames = [
  {
    pattern: (r, c) => {
      // True 45° diagonal split for square 16x16 matrix
      return r > c ? 'white' : 'black';
    }, duration: PENALTY_FRAME_MS
  },
  {
    pattern: (r, c) => {
      // True 45° diagonal split (inverted)
      return r > c ? 'black' : 'white';
    }, duration: PENALTY_FRAME_MS
  }
];

// Split mode penalty frames - adjusted for 8x16 rectangular aspect ratio
const penaltyFrames_split = [
  {
    pattern: (r, c, side) => {
      // 45° diagonal split accounting for rectangular aspect ratio (2:1)
      return r > c * 2 ? 'white' : 'black';
    }, duration: PENALTY_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      // 45° diagonal split (inverted)
      return r > c * 2 ? 'black' : 'white';
    }, duration: PENALTY_FRAME_MS
  }
];
// Simple flags (green, yellow, white, debris) - on/off animation
// These create solid color flashes controlled by SIMPLE_FLAG_FRAME_MS from config
const createSimpleFlagFrames = (color) => [
  {
    pattern: () => color,
    duration: SIMPLE_FLAG_FRAME_MS  // ON state
  },
  {
    pattern: () => 'black',
    duration: SIMPLE_FLAG_FRAME_MS  // OFF state
  }
];

// Split mode simple flags - same as compact, pattern function handles both sides equally
const createSimpleFlagFrames_split = (color) => [
  {
    pattern: () => color,
    duration: SIMPLE_FLAG_FRAME_MS  // ON state
  },
  {
    pattern: () => 'black',
    duration: SIMPLE_FLAG_FRAME_MS  // OFF state
  }
];

// Yellow waving flag (flashing local yellow) - compact 16x16
const yellowWavingFrames = [
  {
    pattern: (r, c) => {
      // 45° diagonal split for square 16x16 matrix
      return r > c ? 'yellow' : 'black';
    }, duration: YELLOWWAVING_FRAME_MS
  },
  {
    pattern: (r, c) => {
      // 45° diagonal split (inverted)
      return r > c ? 'black' : 'yellow';
    }, duration: YELLOWWAVING_FRAME_MS
  }
];

// Split mode yellow waving frames - adjusted for 8x16 rectangular aspect ratio
const yellowWavingFrames_split = [
  {
    pattern: (r, c, side) => {
      // 45° diagonal split accounting for rectangular aspect ratio (2:1)
      return r > c * 2 ? 'yellow' : 'black';
    }, duration: YELLOWWAVING_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      // 45° diagonal split (inverted)
      return r > c * 2 ? 'black' : 'yellow';
    }, duration: YELLOWWAVING_FRAME_MS
  }
];

const checkeredFrames = [
  {
    pattern: (r, c) => {
      if (Math.floor(r / 2) % 2 === Math.floor(c / 2) % 2) {
        return 'white';
      } else {
        return 'black';
      }
    },
    duration: CHECKERED_FRAME_MS
  },
  {
    pattern: (r, c) => {
      if (Math.floor(r / 2) % 2 !== Math.floor(c / 2) % 2) {
        return 'white';
      } else {
        return 'black';
      }
    },
    duration: CHECKERED_FRAME_MS
  }
];

// Split mode checkered frames (works for both left and right - geometric pattern)
const checkeredFrames_split = checkeredFrames;

const slowDownFrames = [
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      const X = [
        [4, 3], [5, 3], [10, 3], [11, 3], [6, 4], [9, 4], [9, 6], [7, 5], [8, 5], [6, 6], [4, 7], [5, 7], [10, 7], [11, 7],
      ];
      const D = [
        [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [4, 10], [11, 10], [4, 11], [11, 11], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12],
      ];
      const isX = X.some(([yr, yc]) => yr === r && yc === c);
      const isD = D.some(([yr, yc]) => yr === r && yc === c);
      if (isBorder || isX || isD) return 'orange';
      return 'black';
    },
    duration: SLOWDOWN_FRAME_MS
  },
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      const X = [
        [4, 3], [5, 3], [10, 3], [11, 3], [6, 4], [9, 4], [9, 6], [7, 5], [8, 5], [6, 6], [4, 7], [5, 7], [10, 7], [11, 7],
      ];
      const D = [
        [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [4, 10], [11, 10], [4, 11], [11, 11], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12],
      ];
      const isX = X.some(([yr, yc]) => yr === r && yc === c);
      const isD = D.some(([yr, yc]) => yr === r && yc === c);
      if (isBorder || isX || isD) return 'black';
      return 'orange';
    },
    duration: SLOWDOWN_FRAME_MS
  }
];

// Split mode slowdown frames (16x8 each) - inverted left and right
const slowDownFrames_split = [
  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (side === 'left') {
        if (isBorder) return 'orange';
        return 'black';
      } else {
        if (isBorder) return 'black';
        return 'orange';
      }
    },
    duration: SLOWDOWN_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (side === 'left') {
        if (isBorder) return 'black';
        return 'orange';
      } else {
        if (isBorder) return 'orange';
        return 'black';
      }
    },
    duration: SLOWDOWN_FRAME_MS
  }
];

const meatballFrames = [
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      const cx = 8 - 0.5;
      const cy = 8 - 0.5;
      const radius = 5;
      const dx = c - cx;
      const dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isBall = dist <= radius - 0.3;
      if (isBorder || isBall) return 'orange';
      return 'black';
    },
    duration: MEATBALL_FRAME_MS
  },
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      if (isBorder) return 'orange';
      return 'black';
    },
    duration: MEATBALL_FRAME_MS
  },
];

// Split mode meatball frames (16x8 each)
const meatballFrames_split = [
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      const cx = 4 - 0.5;
      const cy = 8 - 0.5;
      const radius = 2;
      const dx = c - cx;
      const dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isBall = dist <= radius - 0.3;
      if (isBorder || isBall) return 'orange';
      return 'black';
    },
    duration: MEATBALL_FRAME_MS
  },
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (isBorder) return 'orange';
      return 'black';
    },
    duration: MEATBALL_FRAME_MS
  },
];

// Debris flag - yellow and red vertical stripes (compact 16x16)
const debrisFrames = [
  {
    pattern: (r, c) => {
      return Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'red';
    },
    duration: DEBRIS_FRAME_MS
  },
  {
    pattern: (r, c) => {
      return Math.floor(c / 2) % 2 === 0 ? 'red' : 'yellow';
    },
    duration: DEBRIS_FRAME_MS
  }
];

// Debris flag split mode (8x16 each)
const debrisFrames_split = [
  {
    pattern: (r, c, side) => {
      return Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'red';
    },
    duration: DEBRIS_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      return Math.floor(c / 2) % 2 === 0 ? 'red' : 'yellow';
    },
    duration: DEBRIS_FRAME_MS
  }
];

// Blue flag with yellow diagonal stripe at 45° (compact 16x16)
const blueFrames = [
  {
    pattern: (r, c) => {
      const diagonal = r + c;
      if (Math.abs(diagonal - 15) <= 1) {
        return 'yellow';
      }
      return 'blue';
    },
    duration: BLUE_FRAME_MS
  },
  {
    pattern: (r, c) => {
      return 'black';
    },
    duration: BLUE_FRAME_MS
  }
];

// Blue flag split mode (8x16 each) with yellow diagonal stripe at 45°
const blueFrames_split = [
  {
    pattern: (r, c, side) => {
      const diagonal = r + c;
      if (Math.abs(diagonal - 11) <= 1) {
        return 'yellow';
      }
      return 'blue';
    },
    duration: BLUE_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      return 'black';
    },
    duration: BLUE_FRAME_MS
  }
];

// Helper function to check if position is part of numeral 1 (compact 16x16)
function isNumeralOne_compact(r, c) {
  const one = [
    [3, 6], [3, 7], [3, 8],
    [4, 7], [4, 8],
    [5, 8],
    [6, 8],
    [7, 8],
    [8, 8],
    [9, 8],
    [10, 8],
    [11, 6], [11, 7], [11, 8], [11, 9],
  ];
  return one.some(([yr, yc]) => yr === r && yc === c);
}

// Helper function to check if position is part of numeral 1 (split 8x16)
function isNumeralOne_split(r, c) {
  const one = [
    [3, 2], [3, 3], [3, 4],
    [4, 3], [4, 4],
    [5, 4],
    [6, 4],
    [7, 4],
    [8, 4],
    [9, 4],
    [10, 4],
    [11, 2], [11, 3], [11, 4], [11, 5],
  ];
  return one.some(([yr, yc]) => yr === r && yc === c);
}

// Helper function to check if border position is lit for animated stripe (compact 16x16) - clockwise rotation
function isBorderAnimated_compact(r, c, animationOffset) {
  const borderDist = Math.min(r, c, 15 - r, 15 - c);
  if (borderDist !== 0) return false;
  
  // Calculate perimeter distance for clockwise rotation
  // Top: left to right (r=0, c=0-15) distances 0-15
  // Right: top to bottom (c=15, r=1-15) distances 16-30
  // Bottom: right to left (r=15, c=14-0) distances 31-45
  // Left: bottom to top (c=0, r=14-1) distances 46-59
  let perimeterDist = 0;
  if (r === 0) {
    perimeterDist = c;
  } else if (c === 15) {
    perimeterDist = 16 + (r - 1);
  } else if (r === 15) {
    perimeterDist = 31 + (14 - c);
  } else if (c === 0) {
    perimeterDist = 46 + (14 - r);
  }
  
  // 4px stripes: 2 on, 2 off (with proper modulo handling for negative numbers)
  const phase = ((perimeterDist - animationOffset) % 4 + 4) % 4;
  return phase < 2;
}

// Helper function to check if border position is lit for animated stripe (split 8x16) - clockwise rotation
function isBorderAnimated_split(r, c, animationOffset) {
  const borderDist = Math.min(r, c, 15 - r, 7 - c);
  if (borderDist !== 0) return false;
  
  // Calculate perimeter distance for clockwise rotation
  // Top: left to right (r=0, c=0-7) distances 0-7
  // Right: top to bottom (c=7, r=1-15) distances 8-22
  // Bottom: right to left (r=15, c=6-0) distances 23-29
  // Left: bottom to top (c=0, r=14-1) distances 30-43
  let perimeterDist = 0;
  if (r === 0) {
    perimeterDist = c;
  } else if (c === 7) {
    perimeterDist = 8 + (r - 1);
  } else if (r === 15) {
    perimeterDist = 23 + (6 - c);
  } else if (c === 0) {
    perimeterDist = 30 + (14 - r);
  }
  
  // 4px stripes: 2 on, 2 off (with proper modulo handling for negative numbers)
  const phase = ((perimeterDist - animationOffset) % 4 + 4) % 4;
  return phase < 2;
}

// Helper function to check if border position is lit for animated yellow stripe (compact 16x16) - clockwise rotation (for Safety Car variants)
function isBorderAnimated_compact_yellow(r, c, animationOffset) {
  const borderDist = Math.min(r, c, 15 - r, 15 - c);
  if (borderDist !== 0) return false;
  
  // Calculate perimeter distance for clockwise rotation (same as green version)
  let perimeterDist = 0;
  if (r === 0) {
    perimeterDist = c;
  } else if (c === 15) {
    perimeterDist = 16 + (r - 1);
  } else if (r === 15) {
    perimeterDist = 31 + (14 - c);
  } else if (c === 0) {
    perimeterDist = 46 + (14 - r);
  }
  
  // 4px stripes: 2 on, 2 off
  const phase = ((perimeterDist - animationOffset) % 4 + 4) % 4;
  return phase < 2;
}

// Helper function to check if border position is lit for animated yellow stripe (split 8x16) - clockwise rotation (for Safety Car variants)
function isBorderAnimated_split_yellow(r, c, animationOffset) {
  const borderDist = Math.min(r, c, 15 - r, 7 - c);
  if (borderDist !== 0) return false;
  
  // Calculate perimeter distance for clockwise rotation (same as green version)
  let perimeterDist = 0;
  if (r === 0) {
    perimeterDist = c;
  } else if (c === 7) {
    perimeterDist = 8 + (r - 1);
  } else if (r === 15) {
    perimeterDist = 23 + (6 - c);
  } else if (c === 0) {
    perimeterDist = 30 + (14 - r);
  }
  
  // 4px stripes: 2 on, 2 off
  const phase = ((perimeterDist - animationOffset) % 4 + 4) % 4;
  return phase < 2;
}

// One lap to green - animated green border stripes running around like a snake with numeral 1 in center (compact 16x16)
const oneLapToGreenFrames = [
  {
    pattern: (r, c) => {
      if (isNumeralOne_compact(r, c)) return 'green';
      if (isBorderAnimated_compact(r, c, 0)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  },
  {
    pattern: (r, c) => {
      if (isNumeralOne_compact(r, c)) return 'green';
      if (isBorderAnimated_compact(r, c, 1)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  },
  {
    pattern: (r, c) => {
      if (isNumeralOne_compact(r, c)) return 'green';
      if (isBorderAnimated_compact(r, c, 2)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  },
  {
    pattern: (r, c) => {
      if (isNumeralOne_compact(r, c)) return 'green';
      if (isBorderAnimated_compact(r, c, 3)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  }
];

// One lap to green - split mode (8x16 each)
const oneLapToGreenFrames_split = [
  {
    pattern: (r, c, side) => {
      if (isNumeralOne_split(r, c)) return 'green';
      if (isBorderAnimated_split(r, c, 0)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      if (isNumeralOne_split(r, c)) return 'green';
      if (isBorderAnimated_split(r, c, 1)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      if (isNumeralOne_split(r, c)) return 'green';
      if (isBorderAnimated_split(r, c, 2)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  },
  {
    pattern: (r, c, side) => {
      if (isNumeralOne_split(r, c)) return 'green';
      if (isBorderAnimated_split(r, c, 3)) return 'green';
      return 'black';
    },
    duration: ONELAPTOGREEN_FRAME_MS
  }
];

// Helper function to check if position is part of fat diagonal cross (compact 16x16)
function isFatCross_compact(r, c) {
  // Main diagonal: top-left to bottom-right (r == c)
  // Anti-diagonal: top-right to bottom-left (r + c == 15)
  // Make it fat by checking if within ±1 of the diagonals
  const mainDiagonal = Math.abs(r - c) <= 1;
  const antiDiagonal = Math.abs(r + c - 15) <= 1;
  return mainDiagonal || antiDiagonal;
}

// Helper function to check if position is part of fat diagonal cross (split 8x16)
function isFatCross_split(r, c) {
  // Main diagonal: top-left to bottom-right (r == 2*c approximately)
  // Anti-diagonal: top-right to bottom-left (r + 2*c == 15 approximately)
  // For 8x16 aspect ratio, scale the diagonals
  const mainDiagonal = Math.abs(r - c * 2) <= 2;
  const antiDiagonal = Math.abs(r + c * 2 - 15) <= 2;
  return mainDiagonal || antiDiagonal;
}

// Disqualify flag - fat cross on black background (compact 16x16)
const disqualifyFrames = [
  {
    pattern: (r, c) => {
      return isFatCross_compact(r, c) ? 'white' : 'black';
    },
    duration: DISQUALIFY_FRAME_MS
  },
  {
    pattern: () => 'black',
    duration: DISQUALIFY_FRAME_MS
  }
];

// Disqualify flag - split mode (8x16 each)
const disqualifyFrames_split = [
  {
    pattern: (r, c, side) => {
      return isFatCross_split(r, c) ? 'white' : 'black';
    },
    duration: DISQUALIFY_FRAME_MS
  },
  {
    pattern: () => 'black',
    duration: DISQUALIFY_FRAME_MS
  }
];

const testFlags = ['green', 'yellow', 'yellowWaving', 'blue', 'white', 'penalty', 'slowdown', 'meatball', 'checkered', 'safetycar', 'debris', 'oneLapToGreen', 'disqualify', 'off'];

// --- Matrix Building ---
function rebuildMatrix() {
  if (DISPLAY_MODE === 'split') {
    rebuildMatrixSplit();
  } else {
    rebuildMatrixCompact();
  }
}

function rebuildMatrixCompact() {
  const style = getComputedStyle(panel);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  const padTop = parseFloat(style.paddingTop) || 0;
  const padBottom = parseFloat(style.paddingBottom) || 0;

  const clientW = panel.clientWidth - padLeft - padRight - (TINY_MARGIN * 2);
  const clientH = panel.clientHeight - padTop - padBottom - (TINY_MARGIN * 2);

  MATRIX_COLS = MATRIX_COLS_FIXED;
  MATRIX_ROWS = MATRIX_ROWS_FIXED;

  const ledSize = Math.floor(Math.min(
    (clientW - (MATRIX_COLS - 1) * GAP) / MATRIX_COLS,
    (clientH - (MATRIX_ROWS - 1) * GAP) / MATRIX_ROWS
  ));

  matrix.innerHTML = '';
  leds = [];
  matrix.style.gridTemplateColumns = `repeat(${MATRIX_COLS}, ${ledSize}px)`;
  matrix.style.gridAutoRows = `${ledSize}px`;
  matrix.style.gap = `${GAP}px`;
  matrix.style.padding = `${TINY_MARGIN}px`;

  for (let r = 0; r < MATRIX_ROWS; r++) {
    for (let c = 0; c < MATRIX_COLS; c++) {
      const d = document.createElement('div');
      d.className = 'led';
      matrix.appendChild(d);
      leds.push(d);
    }
  }
}

function rebuildMatrixSplit() {
  // For split mode, we have two 16x8 matrices side by side with gap between them
  const panelSplit = document.getElementById('panel-split');
  const style = getComputedStyle(panelSplit);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  const padTop = parseFloat(style.paddingTop) || 0;
  const padBottom = parseFloat(style.paddingBottom) || 0;

  const clientW = panelSplit.clientWidth - padLeft - padRight - (TINY_MARGIN * 4);
  const clientH = panelSplit.clientHeight - padTop - padBottom - (TINY_MARGIN * 2);

  const SPLIT_GAP = 20; // Gap between left and right matrices
  
  MATRIX_COLS = 8;
  MATRIX_ROWS = 16;

  // Each matrix takes half the width minus the gap
  const matrixWidth = (clientW - SPLIT_GAP) / 2;
  const ledSize = Math.floor(Math.min(
    (matrixWidth - (MATRIX_COLS - 1) * GAP) / MATRIX_COLS,
    (clientH - (MATRIX_ROWS - 1) * GAP) / MATRIX_ROWS
  ));

  // Build left matrix (16 rows x 8 cols)
  matrixLeft.innerHTML = '';
  ledsLeft = [];
  matrixLeft.style.gridTemplateColumns = `repeat(${MATRIX_COLS}, ${ledSize}px)`;
  matrixLeft.style.gridAutoRows = `${ledSize}px`;
  matrixLeft.style.gap = `${GAP}px`;
  matrixLeft.style.padding = `${TINY_MARGIN}px`;

  for (let r = 0; r < MATRIX_ROWS; r++) {
    for (let c = 0; c < MATRIX_COLS; c++) {
      const d = document.createElement('div');
      d.className = 'led';
      matrixLeft.appendChild(d);
      ledsLeft.push(d);
    }
  }

  // Build right matrix (16 rows x 8 cols)
  matrixRight.innerHTML = '';
  ledsRight = [];
  matrixRight.style.gridTemplateColumns = `repeat(${MATRIX_COLS}, ${ledSize}px)`;
  matrixRight.style.gridAutoRows = `${ledSize}px`;
  matrixRight.style.gap = `${GAP}px`;
  matrixRight.style.padding = `${TINY_MARGIN}px`;

  for (let r = 0; r < MATRIX_ROWS; r++) {
    for (let c = 0; c < MATRIX_COLS; c++) {
      const d = document.createElement('div');
      d.className = 'led';
      matrixRight.appendChild(d);
      ledsRight.push(d);
    }
  }

  // Update leds reference to point to both
  leds = [...ledsLeft, ...ledsRight];
}

// --- Utilities ---
function setAllColor(color, flashType) {
  leds.forEach(ld => ld.className = `led ${color} on ${flashType || ''}`);
  messageEl.textContent = color ? color.toUpperCase() : '--';
}

function clearAll() {
  leds.forEach(ld => ld.className = 'led');
  messageEl.textContent = '--';
}

function fadeOutToBlack(duration, steps = 10, keepFaded = false, backgroundElements = []) {
  return new Promise(resolve => {
    let step = 0;
    const stepTime = duration / steps;

    const interval = setInterval(() => {
      step++;
      const t = step / steps;
      leds.forEach(ld => {
        ld.style.opacity = 1 - t;
      });
      
      // Fade background elements as well
      backgroundElements.forEach(el => {
        if (el) {
          // Check if this is the message element (it has text-shadow, not backgroundColor to fade)
          if (el === messageEl) {
            el.style.opacity = 1 - t;
          } else {
            // Fade backgroundColor for panel and wrappers
            const currentColor = window.getComputedStyle(el).backgroundColor;
            // Extract current alpha and fade it
            const match = currentColor.match(/[\d.]+/g);
            if (match && match.length >= 4) {
              const r = match[0];
              const g = match[1];
              const b = match[2];
              const newAlpha = parseFloat(match[3]) * (1 - t);
              el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${newAlpha})`;
              // Remove shadow during fade
              el.style.boxShadow = 'none';
            }
          }
        }
      });

      if (step >= steps) {
        clearInterval(interval);
        if (!keepFaded) {
          leds.forEach(ld => {
            ld.className = 'led';
            ld.style.opacity = 1;
          });
          backgroundElements.forEach(el => {
            if (el) {
              if (el === messageEl) {
                el.style.opacity = 1;
              } else {
                el.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
                el.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.09)';
              }
            }
          });
        }
        resolve();
      }
    }, stepTime);
  });
}

// Idle fade utilities
function resetIdleTimer() {
  lastFlagTime = Date.now();
  isFadedOut = false;
  
  // Reset opacity immediately when a flag starts playing
  leds.forEach(ld => {
    ld.style.opacity = 1;
  });
  
  // Reset message opacity in compact mode
  if (messageEl && DISPLAY_MODE !== 'split') {
    messageEl.style.opacity = 1;
  }
  
  // Restore background opacity to original PANEL_OPACITY
  if (DISPLAY_MODE === 'split') {
    const wrapperLeft = document.getElementById('matrix-wrapper-left');
    const wrapperRight = document.getElementById('matrix-wrapper-right');
    if (wrapperLeft) wrapperLeft.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
    if (wrapperRight) wrapperRight.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
  } else {
    if (panel) panel.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
  }
  
  // Clear any existing idle fade timer and restart the monitor
  if (idleFadeTimer) {
    clearInterval(idleFadeTimer);
    idleFadeTimer = null;
  }
  
  // Restart the idle monitor for the new flag
  startIdleMonitor();
}

function startIdleMonitor() {
  // Skip if idle fade is disabled
  if (IDLE_FADE_TIMEOUT_SECONDS === 0) {
    debugLog('Idle fade disabled');
    return;
  }
  
  // Check every second if idle time has exceeded the threshold
  idleFadeTimer = setInterval(() => {
    const timeSinceLastFlag = Date.now() - lastFlagTime;
    const IDLE_THRESHOLD_MS = IDLE_FADE_TIMEOUT_SECONDS * 1000;
    const FADE_DURATION_MS = 3000; // Fade over 3 seconds
    
    if (timeSinceLastFlag > IDLE_THRESHOLD_MS && !isFadedOut) {
      isFadedOut = true;
      
      // Collect background elements based on display mode
      let backgroundElements = [];
      if (DISPLAY_MODE === 'split') {
        const wrapperLeft = document.getElementById('matrix-wrapper-left');
        const wrapperRight = document.getElementById('matrix-wrapper-right');
        if (wrapperLeft) backgroundElements.push(wrapperLeft);
        if (wrapperRight) backgroundElements.push(wrapperRight);
      } else {
        if (panel) backgroundElements.push(panel);
        // Also fade message element in compact mode
        if (messageEl) backgroundElements.push(messageEl);
      }
      
      fadeOutToBlack(FADE_DURATION_MS, 60, true, backgroundElements); // 60 steps for smooth fade
    }
  }, 1000);
}

async function drawFrame(frame, isFirst = false) {
  if (DISPLAY_MODE === 'split') {
    // Split mode: draw left and right matrices with their own pattern functions
    ledsLeft.forEach((ld, i) => {
      const row = Math.floor(i / MATRIX_COLS);
      const col = i % MATRIX_COLS;
      const color = frame.pattern(row, col, 'left');
      ld.classList.add('no-transition');
      ld.className = `led ${color} on no-transition`;
      ld.style.opacity = 1;
    });
    
    ledsRight.forEach((ld, i) => {
      const row = Math.floor(i / MATRIX_COLS);
      const col = i % MATRIX_COLS;
      const color = frame.pattern(row, col, 'right');
      ld.classList.add('no-transition');
      ld.className = `led ${color} on no-transition`;
      ld.style.opacity = 1;
    });
  } else {
    // Compact mode: normal drawing
    leds.forEach((ld, i) => {
      const row = Math.floor(i / MATRIX_COLS);
      const col = i % MATRIX_COLS;
      const color = frame.pattern(row, col);
      ld.classList.add('no-transition');
      ld.className = `led ${color} on no-transition`;
      ld.style.opacity = 1;
    });
  }

  await sleep(frame.duration);

  if (frame.fade) {
    await fadeOutToBlack(frame.fadeDuration);
  }
}

// --- Flag Players ---
async function playSimpleFlag(color, loopCount = 1) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? createSimpleFlagFrames_split(color) : createSimpleFlagFrames(color);
  if (DEBUG_MODE) console.log(`[playSimpleFlag] color=${color}, loopCount=${loopCount}, frameMs=${SIMPLE_FLAG_FRAME_MS}, totalDuration=${SIMPLE_FLAG_FRAME_MS * 2 * loopCount}ms`);
  
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = color.toUpperCase();
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playPenalty(loopCount = FLAG_LOOP_COUNTS['penalty']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? penaltyFrames_split : penaltyFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'PENALTY';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playYellowWaving(loopCount = FLAG_LOOP_COUNTS['yellowWaving']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? yellowWavingFrames_split : yellowWavingFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'DOUBLE YELLOW';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playSlowDown(loopCount = FLAG_LOOP_COUNTS['slowdown']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? slowDownFrames_split : slowDownFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'SLOWDOWN';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playMeatball(loopCount = FLAG_LOOP_COUNTS['meatball']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? meatballFrames_split : meatballFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'MEATBALL';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playCheckered(loopCount = FLAG_LOOP_COUNTS['checkered']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? checkeredFrames_split : checkeredFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'CHECKERED';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playSafetyCar(loopCount = FLAG_LOOP_COUNTS['safetycar'], variant = SC_VARIANT) {
  resetIdleTimer();
  
  let frames;
  if (variant === 'simple1') {
    frames = DISPLAY_MODE === 'split' ? safetyCarFrames_simple_split : safetyCarFrames_simple;
  } else if (variant === 'simple2') {
    frames = DISPLAY_MODE === 'split' ? safetyCarFrames_simple2_split : safetyCarFrames_simple2;
  } else {
    // Default to complex variant
    frames = DISPLAY_MODE === 'split' ? safetyCarFrames_split : safetyCarFrames;
  }
  
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'SAFETY CAR';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playDebris(loopCount = FLAG_LOOP_COUNTS['debris']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? debrisFrames_split : debrisFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'DEBRIS';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playBlueFlag(loopCount = FLAG_LOOP_COUNTS['blue']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? blueFrames_split : blueFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'BLUE';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playOneLapToGreen(loopCount = FLAG_LOOP_COUNTS['oneLapToGreen']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? oneLapToGreenFrames_split : oneLapToGreenFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = '1 LAP TO GREEN';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playDisqualify(loopCount = FLAG_LOOP_COUNTS['disqualify']) {
  resetIdleTimer();
  const frames = DISPLAY_MODE === 'split' ? disqualifyFrames_split : disqualifyFrames;
  for (let loop = 0; loop < loopCount; loop++) {
    for (const frame of frames) {
      await drawFrame(frame);
      messageEl.textContent = 'DQ';
    }
  }
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playOff(duration = 500) {
  // Don't reset idle timer for the 'off' animation - this is called by clearDisplay()
  // and shouldn't interrupt the fade timeout
  // Also, if we're already faded out, don't update the display at all to preserve fade state
  if (!isFadedOut) {
    clearAll();
    messageEl.textContent = 'Ready';
  }
  await sleep(duration);
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playClear(duration = 0) {
  resetIdleTimer();
  clearAll();
  messageEl.textContent = '';
  await sleep(duration);
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

// Debug flag - shows 1 red pixel in top-left corner when unimplemented flag is encountered
async function playDebug(duration = 1500) {
  resetIdleTimer();
  clearAll();
  messageEl.textContent = 'DEBUG';
  
  // Light up the top-left LED in red
  if (leds && leds.length > 0) {
    leds[0].className = 'led red on';
    leds[0].style.opacity = 1;
  }
  
  await sleep(duration);
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

// --- Test Mode ---
async function runTestMode() {
  debugLog('Starting test mode...');
  
  // If a specific flag is requested, loop only that flag
  if (TEST_FLAG) {
    debugLog('Testing specific flag:', TEST_FLAG);
    while (TEST_MODE) {
      try {
        if (!isFlagEnabled(TEST_FLAG)) {
          console.warn(`Flag "${TEST_FLAG}" is disabled in config, skipping...`);
          await sleep(1000);
          continue;
        }
        debugLog('Playing flag:', TEST_FLAG);
        if (TEST_FLAG === 'green') await playSimpleFlag('green', FLAG_LOOP_COUNTS['green']);
        else if (TEST_FLAG === 'yellow') await playSimpleFlag('yellow', FLAG_LOOP_COUNTS['yellow']);
        else if (TEST_FLAG === 'yellowWaving') await playYellowWaving(FLAG_LOOP_COUNTS['yellowWaving']);
        else if (TEST_FLAG === 'blue') await playBlueFlag(FLAG_LOOP_COUNTS['blue']);
        else if (TEST_FLAG === 'white') await playSimpleFlag('white', FLAG_LOOP_COUNTS['white']);
        else if (TEST_FLAG === 'red') await playSimpleFlag('white', FLAG_LOOP_COUNTS['white']);
        else if (TEST_FLAG === 'penalty') await playPenalty(FLAG_LOOP_COUNTS['penalty']);
        else if (TEST_FLAG === 'slowdown') await playSlowDown(FLAG_LOOP_COUNTS['slowdown']);
        else if (TEST_FLAG === 'meatball') await playMeatball(FLAG_LOOP_COUNTS['meatball']);
        else if (TEST_FLAG === 'checkered') await playCheckered(FLAG_LOOP_COUNTS['checkered']);
        else if (TEST_FLAG === 'safetycar') await playSafetyCar(FLAG_LOOP_COUNTS['safetycar'], SC_VARIANT);
        else if (TEST_FLAG === 'debris') await playDebris(FLAG_LOOP_COUNTS['debris']);
        else if (TEST_FLAG === 'oneLapToGreen') await playOneLapToGreen(FLAG_LOOP_COUNTS['oneLapToGreen']);
        else if (TEST_FLAG === 'disqualify') await playDisqualify(FLAG_LOOP_COUNTS['disqualify']);
        else if (TEST_FLAG === 'off') await playOff();
        else {
          console.error('Unknown flag:', TEST_FLAG);
          break;
        }
      } catch (e) {
        debugLog('Flag playback error', e);
      }
    }
  } else {
    // Cycle through all flags
    while (TEST_MODE) {
      for (const flag of testFlags) {
        // Skip disabled flags
        if (!isFlagEnabled(flag)) {
          debugLog('Skipping disabled flag:', flag);
          continue;
        }
        try {
          debugLog('Playing flag:', flag);
          if (flag === 'green') await playSimpleFlag('green', FLAG_LOOP_COUNTS['green']);
          else if (flag === 'yellow') await playSimpleFlag('yellow', FLAG_LOOP_COUNTS['yellow']);
          else if (flag === 'yellowWaving') await playYellowWaving(FLAG_LOOP_COUNTS['yellowWaving']);
          else if (flag === 'blue') await playBlueFlag(FLAG_LOOP_COUNTS['blue']);
          else if (flag === 'white') await playSimpleFlag('white', FLAG_LOOP_COUNTS['white']);
          else if (flag === 'penalty') await playPenalty(FLAG_LOOP_COUNTS['penalty']);
          else if (flag === 'slowdown') await playSlowDown(FLAG_LOOP_COUNTS['slowdown']);
          else if (flag === 'meatball') await playMeatball(FLAG_LOOP_COUNTS['meatball']);
          else if (flag === 'checkered') await playCheckered(FLAG_LOOP_COUNTS['checkered']);
          else if (flag === 'safetycar') await playSafetyCar(FLAG_LOOP_COUNTS['safetycar'], SC_VARIANT);
          else if (flag === 'debris') await playDebris(FLAG_LOOP_COUNTS['debris']);
          else if (flag === 'oneLapToGreen') await playOneLapToGreen(FLAG_LOOP_COUNTS['oneLapToGreen']);
          else if (flag === 'disqualify') await playDisqualify(FLAG_LOOP_COUNTS['disqualify']);
          else if (flag === 'off') await playOff();
        } catch (e) {
          debugLog('Flag playback error', e);
        }
      }
      await playClear(2000);
    }
  }
}

if (TEST_MODE) {
  debugLog('TEST_MODE is enabled, waiting for DOM to be ready...');
  if (DEBUG_MODE) console.log('TEST_MODE: Waiting for config and DOM...');
  
  // Wait for DOM to be ready before starting test mode
  const startTestMode = async () => {
    debugLog('DOM is ready, initializing app and waiting for config...');
    if (DEBUG_MODE) console.log('TEST_MODE: Initializing...');
    await loadConfigFile();
    if (DEBUG_MODE) console.log('TEST_MODE: Config loaded, starting test sequence...');
    initializeApp();
    // Give initialization a moment to complete
    await sleep(500);
    runTestMode();
  };
  
  document.addEventListener('DOMContentLoaded', startTestMode);
  
  // Also try to start immediately in case DOM is already loaded
  if (document.readyState === 'loading') {
    debugLog('Document still loading...');
  } else {
    debugLog('Document already loaded, starting test mode immediately...');
    startTestMode();
  }
} else {
  debugLog('TEST_MODE is disabled');
  // Still initialize the app even if not in test mode
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
}

// Function to initialize DOM elements
function initializeApp() {
  debugLog('Initializing app in', DISPLAY_MODE, 'mode...');
  
  // Load configuration file first
  loadConfigFile().then(() => {
    continueInitialization();
  }).catch(() => {
    // Continue even if config load fails
    continueInitialization();
  });
}

function continueInitialization() {
  debugLog('Continuing initialization...');
  
  if (DISPLAY_MODE === 'split') {
    // Split mode
    const panelSplit = document.getElementById('panel-split');
    const wrapperLeft = document.getElementById('matrix-wrapper-left');
    const wrapperRight = document.getElementById('matrix-wrapper-right');
    matrixLeft = document.getElementById('matrix-left');
    matrixRight = document.getElementById('matrix-right');
    messageEl = document.createElement('div'); // dummy element for compatibility
    
    // Show split, hide compact
    document.querySelector('.panel.compact-mode').style.display = 'none';
    document.querySelector('.split-mode').style.display = 'flex';
    
    // Apply opacity to matrix wrappers
    if (wrapperLeft) {
      wrapperLeft.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
    }
    if (wrapperRight) {
      wrapperRight.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
    }
    
    if (panelSplit && matrixLeft && matrixRight) {
      debugLog('Split mode DOM elements found, building matrices...');
      rebuildMatrix();
      new ResizeObserver(rebuildMatrix).observe(panelSplit);
      startIdleMonitor();
    } else {
      console.error('Failed to find split mode DOM elements!');
    }
  } else {
    // Compact mode (default)
    panel = document.getElementById('panel');
    matrix = document.getElementById('matrix');
    messageEl = document.getElementById('message');
    
    // Show compact, hide split
    document.querySelector('.panel.compact-mode').style.display = 'flex';
    document.querySelector('.split-mode').style.display = 'none';
    
    // Apply opacity to compact panel
    if (panel) {
      panel.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
    }
    
    // Toggle message visibility
    if (messageEl && !SHOW_MESSAGE) {
      messageEl.style.display = 'none';
    }
    
    if (panel && matrix && messageEl) {
      debugLog('Compact mode DOM elements found, building matrix...');
      rebuildMatrix();
      new ResizeObserver(rebuildMatrix).observe(panel);
      startIdleMonitor();
    } else {
      console.error('Failed to find compact mode DOM elements!', { panel, matrix, messageEl });
    }
  }
  
  // Show startup message
  console.log('VFlag loaded, happy racing! ~Ash');
}

// Expose helper functions for CoffeeScript
window.getFlagDuration = getFlagDuration;
window.isFlagEnabled = isFlagEnabled;

// Expose test functions
window.flagTest = {
  green: () => {
    if (DEBUG_MODE) console.log(`[flagTest.green] called, FLAG_LOOP_COUNTS['green']=${FLAG_LOOP_COUNTS['green']}, enabled=${isFlagEnabled('green')}`);
    return isFlagEnabled('green') ? playSimpleFlag('green', FLAG_LOOP_COUNTS['green']) : null;
  },
  yellow: () => {
    if (DEBUG_MODE) console.log(`[flagTest.yellow] called, FLAG_LOOP_COUNTS['yellow']=${FLAG_LOOP_COUNTS['yellow']}, enabled=${isFlagEnabled('yellow')}`);
    return isFlagEnabled('yellow') ? playSimpleFlag('yellow', FLAG_LOOP_COUNTS['yellow']) : null;
  },
  yellowWaving: () => isFlagEnabled('yellowWaving') ? playYellowWaving(FLAG_LOOP_COUNTS['yellowWaving']) : null,
  blue: () => isFlagEnabled('blue') ? playBlueFlag(FLAG_LOOP_COUNTS['blue']) : null,
  white: () => isFlagEnabled('white') ? playSimpleFlag('white', FLAG_LOOP_COUNTS['white']) : null,
  red: () => isFlagEnabled('white') ? playSimpleFlag('white', FLAG_LOOP_COUNTS['white']) : null,
  penalty: () => isFlagEnabled('penalty') ? playPenalty(FLAG_LOOP_COUNTS['penalty']) : null,
  slowdown: () => isFlagEnabled('slowdown') ? playSlowDown(FLAG_LOOP_COUNTS['slowdown']) : null,
  meatball: () => isFlagEnabled('meatball') ? playMeatball(FLAG_LOOP_COUNTS['meatball']) : null,
  checkered: () => isFlagEnabled('checkered') ? playCheckered(FLAG_LOOP_COUNTS['checkered']) : null,
  safetycar: () => isFlagEnabled('safetycar') ? playSafetyCar(FLAG_LOOP_COUNTS['safetycar']) : null,
  debris: () => isFlagEnabled('debris') ? playDebris(FLAG_LOOP_COUNTS['debris']) : null,
  oneLapToGreen: () => isFlagEnabled('oneLapToGreen') ? playOneLapToGreen(FLAG_LOOP_COUNTS['oneLapToGreen']) : null,
  disqualify: () => isFlagEnabled('disqualify') ? playDisqualify(FLAG_LOOP_COUNTS['disqualify']) : null,
  debug: () => playDebug(),
  off: () => playOff()
};
