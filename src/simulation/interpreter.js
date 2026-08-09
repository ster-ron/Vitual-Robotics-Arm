// src/simulation/interpreter.js
import { VirtualArduino } from './virtualArduino';
import { useStore } from '../store/armStore';

let currentBoard = null;

// Safety cap so a loop() with no delay() in it can't freeze the tab forever.
// Sketches that call delay() (the normal case) will almost always hit the
// 30s timeout or a Stop click long before this.
const MAX_LOOP_ITERATIONS = 5000;

export function stopExecution() {
  if (currentBoard) {
    currentBoard.running = false;
  }
}

/**
 * Converts a (simplified) Arduino/C++ sketch into something the JS
 * Function constructor can actually run:
 *  - strips comments and preprocessor lines (#include, #define, etc.)
 *  - turns `Servo name;` declarations into `let name = new Servo();`
 *  - turns `void name(...)` (setup, loop, and any helper function) into
 *    `async function name(...)` so delay() can be awaited anywhere
 *  - strips C-style types from parameter lists and local variable
 *    declarations (int/float/long/etc. -> let)
 */
function prepareArduinoCode(code) {
  let cleaned = code;

  // Strip line and block comments
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip preprocessor directives (#include <Servo.h>, #define FOO 1, ...)
  cleaned = cleaned.replace(/^\s*#.*$/gm, '');

  // Servo variable declarations: "Servo base;" -> "let base = new Servo();"
  cleaned = cleaned.replace(/\bServo\s+(\w+)\s*;/g, 'let $1 = new Servo();');

  // Function declarations: "void name(...)" -> "async function name(...)"
  // Covers setup(), loop(), and any user-defined helper functions.
  cleaned = cleaned.replace(/\bvoid\s+(\w+)\s*\(([^)]*)\)/g, 'async function $1($2)');

  // Strip C-style types that are now sitting inside parameter lists,
  // e.g. "async function moveTo(int b, int s)" -> "async function moveTo(b, s)"
  cleaned = cleaned.replace(
    /\b(int|float|double|long|unsigned long|unsigned int|char|bool|byte)\s+(\w+)/g,
    '$2'
  );

  // Local variable declarations with an initializer:
  // "int angle = 0;" / "for (int angle = 0; ...)" -> "let angle = 0;"
  cleaned = cleaned.replace(
    /\b(int|float|double|long|unsigned long|unsigned int|char|bool|byte)\s+(\w+)\s*=/g,
    'let $2 ='
  );

  // Local variable declarations without an initializer: "int angle;" -> "let angle;"
  cleaned = cleaned.replace(
    /\b(int|float|double|long|unsigned long|unsigned int|char|bool|byte)\s+(\w+)\s*;/g,
    'let $2;'
  );

  return cleaned;
}

export async function runArduinoCode(code, logCallback) {
  const board = new VirtualArduino(logCallback);
  currentBoard = board;
  const store = useStore.getState();

  const context = {
    board,
    Serial: board.Serial,
    Servo: board.Servo,
    delay: board.delay.bind(board),
    delayMicroseconds: board.delayMicroseconds.bind(board),
    pinMode: board.pinMode.bind(board),
    digitalWrite: board.digitalWrite.bind(board),
    digitalRead: board.digitalRead.bind(board),
    analogWrite: board.analogWrite.bind(board),
    analogRead: board.analogRead.bind(board),

    // Constants
    INPUT: 'INPUT',
    OUTPUT: 'OUTPUT',
    INPUT_PULLUP: 'INPUT_PULLUP',
    HIGH: 1,
    LOW: 0,
    PI: Math.PI,

    // Store access for arm control
    __store: store,
    __setAngle: (joint, angle) => store.setAngle(joint, angle),
  };

  const preparedCode = prepareArduinoCode(code);

  try {
    const asyncWrapper = new Function(
      ...Object.keys(context),
      `
        return (async function() {
          ${preparedCode}

          if (typeof setup === 'function') {
            await setup();
          }
          if (typeof loop === 'function') {
            let __iterations = 0;
            while (board.running && __iterations < ${MAX_LOOP_ITERATIONS}) {
              await loop();
              __iterations++;
            }
          }
          return { success: true };
        })();
      `
    );

    const result = await Promise.race([
      asyncWrapper(...Object.values(context)),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout (30s)')), 30000);
      }),
    ]);

    return result;
  } catch (error) {
    // A Stop click makes delay() throw "Execution stopped" - that's an
    // expected, user-initiated exit, not a real error.
    if (error.message === 'Execution stopped') {
      logCallback('⏹️ Execution stopped', 'info');
      return { success: true, stopped: true };
    }
    logCallback(`❌ ${error.message}`, 'error');
    throw error;
  } finally {
    board.destroy();
    if (currentBoard === board) {
      currentBoard = null;
    }
  }
}
