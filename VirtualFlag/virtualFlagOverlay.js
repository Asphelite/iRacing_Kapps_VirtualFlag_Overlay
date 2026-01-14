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

const DEFAULT_FLAG_DURATION_MS = 1500;
const GAP = 3;
const TINY_MARGIN = 4;
const BLUEFLAG_LOOP_COUNT = 4;
const CHECKERED_LOOP_COUNT = 4;
const PENALTY_LOOP_COUNT = 4;
const SLOWDOWN_LOOP_COUNT = 2;
const MEATBALL_LOOP_COUNT = 4;
const SAFETYCAR_LOOP_COUNT = 2;

const simpleFlagDuration = DEFAULT_FLAG_DURATION_MS;

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
    duration: 150
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
    duration: 150
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
    duration: 150
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
    duration: 150
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
    duration: 150
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
    duration: 150
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
    duration: 150
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
    duration: 150
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
    duration: 1000
  },
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      if (isBorder) return 'yellow';
      return 'black';
    },
    duration: 1000
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
    duration: 1000
  },
  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (isBorder) return 'yellow';
      return 'black';
    },
    duration: 1000
  }
];

const penaltyFrames = [
  {
    pattern: (r, c) => {
      // True 45° diagonal split for square 16x16 matrix
      return r > c ? 'white' : 'black';
    }, duration: 500
  },
  {
    pattern: (r, c) => {
      // True 45° diagonal split (inverted)
      return r > c ? 'black' : 'white';
    }, duration: 500
  }
];

// Split mode penalty frames - adjusted for 8x16 rectangular aspect ratio
const penaltyFrames_split = [
  {
    pattern: (r, c, side) => {
      // 45° diagonal split accounting for rectangular aspect ratio (2:1)
      return r > c * 2 ? 'white' : 'black';
    }, duration: 500
  },
  {
    pattern: (r, c, side) => {
      // 45° diagonal split (inverted)
      return r > c * 2 ? 'black' : 'white';
    }, duration: 500
  }
];

// Yellow waving flag (flashing local yellow) - compact 16x16
const yellowWavingFrames = [
  {
    pattern: (r, c) => {
      // 45° diagonal split for square 16x16 matrix
      return r > c ? 'yellow' : 'black';
    }, duration: 250
  },
  {
    pattern: (r, c) => {
      // 45° diagonal split (inverted)
      return r > c ? 'black' : 'yellow';
    }, duration: 250
  }
];

// Split mode yellow waving frames - adjusted for 8x16 rectangular aspect ratio
const yellowWavingFrames_split = [
  {
    pattern: (r, c, side) => {
      // 45° diagonal split accounting for rectangular aspect ratio (2:1)
      return r > c * 2 ? 'yellow' : 'black';
    }, duration: 250
  },
  {
    pattern: (r, c, side) => {
      // 45° diagonal split (inverted)
      return r > c * 2 ? 'black' : 'yellow';
    }, duration: 250
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
    duration: 500
  },
  {
    pattern: (r, c) => {
      if (Math.floor(r / 2) % 2 !== Math.floor(c / 2) % 2) {
        return 'white';
      } else {
        return 'black';
      }
    },
    duration: 500
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
    duration: 500
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
    duration: 500
  }
];

// Split mode slowdown frames (16x8 each) - inverted left and right
const slowDownFrames_split = [
  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (side === 'left') {
        // Left: orange border, black inside
        if (isBorder) return 'orange';
        return 'black';
      } else {
        // Right: black border, orange inside (inverted)
        if (isBorder) return 'black';
        return 'orange';
      }
    },
    duration: 500
  },
  {
    pattern: (r, c, side) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (side === 'left') {
        // Left: black border, orange inside
        if (isBorder) return 'black';
        return 'orange';
      } else {
        // Right: orange border, black inside (inverted)
        if (isBorder) return 'orange';
        return 'black';
      }
    },
    duration: 500
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
    duration: 500
  },
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 16 - border;
      if (isBorder) return 'orange';
      return 'black';
    },
    duration: 500
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
    duration: 500
  },
  {
    pattern: (r, c) => {
      const border = 1;
      const isBorder = r < border || r >= 16 - border || c < border || c >= 8 - border;
      if (isBorder) return 'orange';
      return 'black';
    },
    duration: 500
  },
];

// Debris flag - yellow and red vertical stripes (compact 16x16)
const debrisFrames = [
  {
    pattern: (r, c) => {
      return Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'red';
    },
    duration: 500
  },
  {
    pattern: (r, c) => {
      return Math.floor(c / 2) % 2 === 0 ? 'red' : 'yellow';
    },
    duration: 500
  }
];

// Debris flag split mode (8x16 each)
const debrisFrames_split = [
  {
    pattern: (r, c, side) => {
      return Math.floor(c / 2) % 2 === 0 ? 'yellow' : 'red';
    },
    duration: 500
  },
  {
    pattern: (r, c, side) => {
      return Math.floor(c / 2) % 2 === 0 ? 'red' : 'yellow';
    },
    duration: 500
  }
];

// Blue flag with yellow diagonal stripe at 45° (compact 16x16)
const blueFrames = [
  {
    pattern: (r, c) => {
      // Diagonal stripe at 45° from bottom-left to top-right
      // The stripe follows the diagonal where r + c is constant
      const diagonal = r + c;
      // Create a diagonal band (2px thick)
      if (Math.abs(diagonal - 15) <= 1) {
        return 'yellow';
      }
      return 'blue';
    },
    duration: 500
  },
  {
    pattern: (r, c) => {
      // Complete off for flashing effect
      return 'black';
    },
    duration: 500
  }
];

// Blue flag split mode (8x16 each) with yellow diagonal stripe at 45°
const blueFrames_split = [
  {
    pattern: (r, c, side) => {
      // Diagonal stripe at 45° from bottom-left to top-right
      // The stripe follows the diagonal where r + c is constant
      const diagonal = r + c;
      // Create a diagonal band (2px thick)
      if (Math.abs(diagonal - 11) <= 1) {
        return 'yellow';
      }
      return 'blue';
    },
    duration: 500
  },
  {
    pattern: (r, c, side) => {
      // Complete off for flashing effect
      return 'black';
    },
    duration: 500
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
    duration: 150
  },
  {
    pattern: (r, c) => {
      if (isNumeralOne_compact(r, c)) return 'green';
      if (isBorderAnimated_compact(r, c, 1)) return 'green';
      return 'black';
    },
    duration: 150
  },
  {
    pattern: (r, c) => {
      if (isNumeralOne_compact(r, c)) return 'green';
      if (isBorderAnimated_compact(r, c, 2)) return 'green';
      return 'black';
    },
    duration: 150
  },
  {
    pattern: (r, c) => {
      if (isNumeralOne_compact(r, c)) return 'green';
      if (isBorderAnimated_compact(r, c, 3)) return 'green';
      return 'black';
    },
    duration: 150
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
    duration: 150
  },
  {
    pattern: (r, c, side) => {
      if (isNumeralOne_split(r, c)) return 'green';
      if (isBorderAnimated_split(r, c, 1)) return 'green';
      return 'black';
    },
    duration: 150
  },
  {
    pattern: (r, c, side) => {
      if (isNumeralOne_split(r, c)) return 'green';
      if (isBorderAnimated_split(r, c, 2)) return 'green';
      return 'black';
    },
    duration: 150
  },
  {
    pattern: (r, c, side) => {
      if (isNumeralOne_split(r, c)) return 'green';
      if (isBorderAnimated_split(r, c, 3)) return 'green';
      return 'black';
    },
    duration: 150
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
    duration: 1000
  },
  {
    pattern: () => 'black',
    duration: 1000
  }
];

// Disqualify flag - split mode (8x16 each)
const disqualifyFrames_split = [
  {
    pattern: (r, c, side) => {
      return isFatCross_split(r, c) ? 'white' : 'black';
    },
    duration: 1000
  },
  {
    pattern: () => 'black',
    duration: 1000
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
          const currentColor = window.getComputedStyle(el).backgroundColor;
          // Extract current alpha and fade it
          const match = currentColor.match(/[\d.]+/g);
          if (match && match.length >= 4) {
            const r = match[0];
            const g = match[1];
            const b = match[2];
            const newAlpha = parseFloat(match[3]) * (1 - t);
            el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${newAlpha})`;
            // Also fade the shadow
            el.style.boxShadow = `0 0 10px rgba(255, 255, 255, ${0.09 * (1 - t)})`;
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
              el.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
              el.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.09)';
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
  
  // Restore background opacity to original PANEL_OPACITY
  if (DISPLAY_MODE === 'split') {
    const wrapperLeft = document.getElementById('matrix-wrapper-left');
    const wrapperRight = document.getElementById('matrix-wrapper-right');
    if (wrapperLeft) wrapperLeft.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
    if (wrapperRight) wrapperRight.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
  } else {
    if (panel) panel.style.backgroundColor = `rgba(0, 0, 0, ${PANEL_OPACITY})`;
  }
  
  // Clear any existing idle fade timer
  if (idleFadeTimer) {
    clearInterval(idleFadeTimer);
    idleFadeTimer = null;
  }
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
      ld.className = `led ${color} on`;
      ld.style.opacity = 1;
    });
    
    ledsRight.forEach((ld, i) => {
      const row = Math.floor(i / MATRIX_COLS);
      const col = i % MATRIX_COLS;
      const color = frame.pattern(row, col, 'right');
      ld.className = `led ${color} on`;
      ld.style.opacity = 1;
    });
  } else {
    // Compact mode: normal drawing
    leds.forEach((ld, i) => {
      const row = Math.floor(i / MATRIX_COLS);
      const col = i % MATRIX_COLS;
      const color = frame.pattern(row, col);
      ld.className = `led ${color} on`;
      ld.style.opacity = 1;
    });
  }

  await sleep(frame.duration);

  if (frame.fade) {
    await fadeOutToBlack(frame.fadeDuration);
  }
}

// --- Flag Players ---
async function playSimpleFlag(color, duration = simpleFlagDuration) {
  resetIdleTimer();
  setAllColor(color, color === 'green' || color === 'yellow' || color === 'blue' || color === 'white' ? 'flash-fast' : '');
  await sleep(duration);
  if (window.onFlagAnimationComplete) window.onFlagAnimationComplete();
}

async function playPenalty(loopCount = PENALTY_LOOP_COUNT) {
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

async function playYellowWaving(loopCount = PENALTY_LOOP_COUNT) {
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

async function playSlowDown(loopCount = SLOWDOWN_LOOP_COUNT) {
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

async function playMeatball(loopCount = MEATBALL_LOOP_COUNT) {
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

async function playCheckered(loopCount = CHECKERED_LOOP_COUNT) {
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

async function playSafetyCar(loopCount = SAFETYCAR_LOOP_COUNT, variant = SC_VARIANT) {
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

async function playDebris(loopCount = DEFAULT_FLAG_DURATION_MS / 500) {
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

async function playBlueFlag(loopCount = BLUEFLAG_LOOP_COUNT) {
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

async function playOneLapToGreen(loopCount = PENALTY_LOOP_COUNT) {
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

async function playDisqualify(loopCount = PENALTY_LOOP_COUNT) {
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
  resetIdleTimer();
  clearAll();
  messageEl.textContent = 'Ready';
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
        debugLog('Playing flag:', TEST_FLAG);
        if (TEST_FLAG === 'green') await playSimpleFlag('green');
        else if (TEST_FLAG === 'yellow') await playSimpleFlag('yellow');
        else if (TEST_FLAG === 'yellowWaving') await playYellowWaving();
        else if (TEST_FLAG === 'blue') await playBlueFlag();
        else if (TEST_FLAG === 'white') await playSimpleFlag('white');
        else if (TEST_FLAG === 'red') await playSimpleFlag('white');
        else if (TEST_FLAG === 'penalty') await playPenalty();
        else if (TEST_FLAG === 'slowdown') await playSlowDown();
        else if (TEST_FLAG === 'meatball') await playMeatball();
        else if (TEST_FLAG === 'checkered') await playCheckered();
        else if (TEST_FLAG === 'safetycar') await playSafetyCar(SAFETYCAR_LOOP_COUNT, SC_VARIANT);
        else if (TEST_FLAG === 'debris') await playDebris();
        else if (TEST_FLAG === 'oneLapToGreen') await playOneLapToGreen();
        else if (TEST_FLAG === 'disqualify') await playDisqualify();
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
        try {
          debugLog('Playing flag:', flag);
          if (flag === 'green') await playSimpleFlag('green');
          else if (flag === 'yellow') await playSimpleFlag('yellow');
          else if (flag === 'yellowWaving') await playYellowWaving();
          else if (flag === 'blue') await playBlueFlag();
          else if (flag === 'white') await playSimpleFlag('white');
          else if (flag === 'penalty') await playPenalty();
          else if (flag === 'slowdown') await playSlowDown();
          else if (flag === 'meatball') await playMeatball();
          else if (flag === 'checkered') await playCheckered();
          else if (flag === 'safetycar') await playSafetyCar(SAFETYCAR_LOOP_COUNT, SC_VARIANT);
          else if (flag === 'debris') await playDebris();
          else if (flag === 'oneLapToGreen') await playOneLapToGreen();
          else if (flag === 'disqualify') await playDisqualify();
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
  // Wait for DOM to be ready before starting test mode
  document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM is ready, initializing app and starting test mode...');
    initializeApp();
    runTestMode();
  });
  
  // Also try to start immediately in case DOM is already loaded
  if (document.readyState === 'loading') {
    debugLog('Document still loading...');
  } else {
    debugLog('Document already loaded, initializing immediately...');
    initializeApp();
    runTestMode();
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

// Expose test functions
window.flagTest = {
  green: () => playSimpleFlag('green'),
  yellow: () => playSimpleFlag('yellow'),
  yellowWaving: () => playYellowWaving(),
  blue: () => playBlueFlag(),
  white: () => playSimpleFlag('white'),
  red: () => playSimpleFlag('white'),
  penalty: () => playPenalty(),
  slowdown: () => playSlowDown(),
  meatball: () => playMeatball(),
  checkered: () => playCheckered(),
  safetycar: () => playSafetyCar(),
  debris: () => playDebris(),
  oneLapToGreen: () => playOneLapToGreen(),
  disqualify: () => playDisqualify(),
  debug: () => playDebug(),
  off: () => playOff()
};
