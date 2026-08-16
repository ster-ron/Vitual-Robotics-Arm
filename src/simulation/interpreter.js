// src/simulation/interpreter.js
//
// Runs an Arduino-style C++ sketch against a VirtualArduino board, using
// the shared parser/evaluator in engine.js. See engine.js for why this is
// a real parser instead of `new Function()` on raw C++.

import { VirtualArduino } from './virtualArduino';
import { Scope, parseTokens, callFunction, runProgramBody, runGenerator } from './engine';

let activeHandle = null;
let activeBoard = null;

export function stopExecution() {
  if (activeHandle) { activeHandle.stop(); activeHandle = null; }
  activeBoard = null;
}

// Exposed so the Python runtime can push bytes onto this sketch's
// incoming serial buffer (board.receive) — the two runtimes talk to each
// other exactly the way a PC and a microcontroller would over a real
// serial cable.
export function getActiveBoard() {
  return activeBoard;
}

// Parses without running — lets the editor show syntax errors as the
// user types, before they even hit Run.
export function checkSyntax(code) {
  try {
    parseTokens(code);
    return { ok: true };
  } catch (e) {
    const m = /^Line (\d+): (.*)$/.exec(e.message);
    return { ok: false, line: m ? parseInt(m[1], 10) : 1, message: m ? m[2] : e.message };
  }
}

function buildGlobalScope(board, ctx) {
  const scope = new Scope(null);
  scope.define('HIGH', 1);
  scope.define('LOW', 0);
  scope.define('INPUT', 'INPUT');
  scope.define('OUTPUT', 'OUTPUT');
  scope.define('INPUT_PULLUP', 'INPUT_PULLUP');
  scope.define('PI', Math.PI);
  scope.define('pinMode', board.pinMode.bind(board));
  scope.define('digitalWrite', board.digitalWrite.bind(board));
  scope.define('digitalRead', board.digitalRead.bind(board));
  scope.define('analogWrite', board.analogWrite.bind(board));
  scope.define('analogRead', board.analogRead.bind(board));
  scope.define('map', (x, a, b, c, d) => ((x - a) * (d - c)) / (b - a) + c);
  scope.define('constrain', (x, lo, hi) => Math.max(lo, Math.min(hi, x)));
  scope.define('random', (a, b) => (b === undefined ? Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a))));
  scope.define('millis', () => Math.floor(performance.now() - ctx.startTime));
  scope.define('abs', Math.abs);
  scope.define('min', Math.min);
  scope.define('max', Math.max);
  scope.define('parseInt', (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 0 : n; });
  scope.define('parseFloat', (v) => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; });
  scope.define('String', (v) => String(v));
  scope.define('Number', (v) => Number(v));
  scope.define('Serial', board.Serial);
  scope.define('Servo', () => new board.Servo());

  // delay() must pause the generator without blocking the browser thread —
  // capped at 3s per call so a runaway sketch can't hang the simulator.
  scope.define('delay', { __gen: function* (args) {
    const ms = Math.min(3000, Math.max(0, Number(args[0]) || 0));
    yield { type: 'wait', ms };
  } });
  scope.define('delayMicroseconds', { __gen: function* (args) {
    const ms = Math.min(3000, Math.max(0, (Number(args[0]) || 0) / 1000));
    yield { type: 'wait', ms };
  } });

  return scope;
}

/**
 * Parses and runs an Arduino-style sketch.
 * @param {string} code
 * @param {(message: string, type?: string) => void} logCallback
 * @param {(err: Error|null) => void} [onFinish] called when the program stops (error, or loop ended)
 * @param {(line: number) => void} [onLine] called with the source line about to execute
 */
export function runArduinoCode(code, logCallback, onFinish, onLine) {
  stopExecution();
  const board = new VirtualArduino(logCallback);
  activeBoard = board;
  const ctx = { stepBudget: { n: 0 }, startTime: performance.now(), onLine };

  let ast;
  try {
    ast = parseTokens(code);
  } catch (e) {
    logCallback(`Compile error: ${e.message}`, 'error');
    if (onFinish) onFinish(e);
    return;
  }

  const scope = buildGlobalScope(board, ctx);

  function* main() {
    yield* runProgramBody(ast, scope, ctx);
    if (scope.has('setup')) yield* callFunction(scope.get('setup'), [], ctx);
    if (scope.has('loop')) {
      const loopFn = scope.get('loop');
      while (true) {
        yield { type: 'tick' };
        yield* callFunction(loopFn, [], ctx);
      }
    }
  }

  logCallback('Program started', 'success');
  activeHandle = runGenerator(main(), {
    onDone: (err) => {
      activeHandle = null;
      board.destroy();
      if (activeBoard === board) activeBoard = null;
      if (err) logCallback(`Runtime error: ${err.message}`, 'error');
      else logCallback('Program finished', 'success');
      if (onFinish) onFinish(err || null);
    },
  });
}