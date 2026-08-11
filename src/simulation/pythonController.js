// src/simulation/pythonController.js
//
// A Python front end for the same engine that runs the C++ sketches.
// Indentation-based Python is rewritten into the brace/semicolon grammar
// engine.js already understands (def -> function, `:` -> `{`, True/False
// -> true/false, etc.), then runs on the identical tokenizer/parser/
// evaluator — so this file stays small; all the real interpreter logic
// lives in engine.js and is shared, not duplicated.
//
// Two ways to control the arm from Python:
//   arm.send("BASE:90")   — sends a real command over the virtual serial
//                             link to whatever C++ firmware is currently
//                             running (getActiveBoard()). This is the
//                             "PC talks to a microcontroller" pattern.
//   arm.move("base", 90)  — drives the joint directly, no firmware needed.
//                             Handy for quick testing without a sketch.

import { useStore } from '../store/armStore';
import { ARM_CONFIG } from './armConfig';
import { Scope, parseTokens, tokenize, Parser, callFunction, runProgramBody, runGenerator } from './engine';
import { getActiveBoard } from './interpreter';

/* ---------------- Python -> brace/semicolon preprocessor ---------------- */
function pythonToPseudoC(src) {
  const rawLines = src.replace(/\t/g, '    ').split('\n');
  const lines = [];
  for (let raw of rawLines) {
    let line = raw.replace(/#.*/, '');
    if (line.trim() === '') continue;
    if (/^\s*(import|from)\s/.test(line)) continue;
    const indent = line.match(/^ */)[0].length;
    lines.push({ indent, content: line.trim() });
  }
  const splitStrings = (s) => s.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);
  const translate = (s, opensBlock) => {
    s = s.replace(/^def\s+/, 'function ');
    s = s.replace(/^elif\b/, 'else if');
    if (opensBlock) {
      const forIn = s.match(/^for\s+(\w+)\s+in\s+(.+)$/);
      if (forIn) s = `for (${forIn[1]} in ${forIn[2]})`;
    }
    // Rewrite Python keywords only in the parts outside string literals,
    // so e.g. print("pick-and-place") doesn't get its string mangled.
    const parts = splitStrings(s);
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = parts[i]
        .replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
        .replace(/\band\b/g, '&&').replace(/\bor\b/g, '||')
        .replace(/\bnot\s+/g, '!');
    }
    return parts.join('');
  };
  const out = [];
  const stack = [0];
  for (const { indent, content } of lines) {
    while (indent < stack[stack.length - 1]) { stack.pop(); out.push('}'); }
    if (indent > stack[stack.length - 1]) { stack.push(indent); out.push('{'); }
    const opensBlock = /:\s*$/.test(content);
    let body = opensBlock ? content.replace(/:\s*$/, '') : content;
    body = translate(body, opensBlock);
    if (opensBlock) out.push(body);
    else out.push(/[;{}]\s*$/.test(body) ? body : body + ';');
  }
  while (stack.length > 1) { stack.pop(); out.push('}'); }
  return out.join('\n');
}

function parsePython(src) {
  const pre = pythonToPseudoC(src);
  return new Parser(tokenize(pre)).parseProgram();
}

/* ---------------- Builtins for the Python side ---------------- */
function resolveJoint(name) {
  const k = String(name).toLowerCase().replace(/[^a-z]/g, '');
  const table = { base: 'base', turret: 'base', shoulder: 'shoulder', elbow: 'elbow', wrist: 'wrist', gripper: 'gripper', claw: 'gripper', hand: 'gripper' };
  return table[k] || null;
}

function buildPythonScope(ctx) {
  const scope = new Scope(null);
  scope.define('PI', Math.PI);
  scope.define('print', (...a) => ctx.log(a.map(String).join(' ')));
  scope.define('abs', Math.abs);
  scope.define('min', Math.min);
  scope.define('max', Math.max);
  scope.define('str', (v) => String(v));
  scope.define('int', (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 0 : n; });
  scope.define('float', (v) => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; });
  scope.define('bool', (v) => !!v);
  scope.define('len', (v) => (v && v.length !== undefined ? v.length : 0));
  scope.define('map', (x, a, b, c, d) => ((x - a) * (d - c)) / (b - a) + c);
  scope.define('constrain', (x, lo, hi) => Math.max(lo, Math.min(hi, x)));
  scope.define('range', (a, b, step) => {
    if (b === undefined) { b = a; a = 0; }
    if (step === undefined) step = 1;
    const arr = [];
    if (step > 0) for (let i = a; i < b; i += step) arr.push(i);
    else for (let i = a; i > b; i += step) arr.push(i);
    return arr;
  });

  scope.define('sleep', { __gen: function* (args) {
    const ms = Math.min(4000, Math.max(0, (Number(args[0]) || 0) * 1000));
    yield { type: 'wait', ms };
  } });
  scope.define('time', { sleep: scope.get('sleep') });

  scope.define('arm', {
    // Sends a real command over virtual serial to the currently-running
    // C++ firmware (if any). Mirrors PySerial's `ser.write(...)`.
    send: (cmd) => {
      const board = getActiveBoard();
      const line = String(cmd);
      if (!board) {
        ctx.log(`\u2192 TX: ${line}  (no firmware running \u2014 start the C++ sketch first, or use arm.move() for direct control)`, 'warning');
        return;
      }
      board.receive(line + '\n');
      ctx.log(`\u2192 TX: ${line}`);
    },
    // Direct control, bypassing serial/firmware entirely.
    move: (joint, angle) => {
      const j = resolveJoint(joint);
      if (!j) { ctx.log(`warn: unknown joint '${joint}'`, 'warning'); return; }
      const lim = ARM_CONFIG.limits[j];
      const clamped = lim ? Math.max(lim.min, Math.min(lim.max, Number(angle))) : Number(angle);
      useStore.getState().setAngle(j, clamped);
      ctx.log(`${j} -> ${Math.round(clamped)}\u00b0 (direct)`, 'debug');
    },
    home: () => { useStore.getState().resetAngles(); ctx.log('arm homed', 'info'); },
  });

  return scope;
}

let activeHandle = null;

export function stopPythonExecution() {
  if (activeHandle) { activeHandle.stop(); activeHandle = null; }
}

/**
 * Parses and runs a Python controller script once, top to bottom.
 * @param {string} code
 * @param {(message: string, type?: string) => void} logCallback
 * @param {(err: Error|null) => void} [onFinish]
 */
export function runPythonCode(code, logCallback, onFinish) {
  stopPythonExecution();
  const ctx = { stepBudget: { n: 0 }, startTime: performance.now(), log: logCallback };

  let ast;
  try {
    ast = parsePython(code);
  } catch (e) {
    logCallback(`Compile error: ${e.message}`, 'error');
    if (onFinish) onFinish(e);
    return;
  }

  const scope = buildPythonScope(ctx);

  logCallback('Python controller started', 'success');
  activeHandle = runGenerator(runProgramBody(ast, scope, ctx), {
    onDone: (err) => {
      activeHandle = null;
      if (err) logCallback(`Runtime error: ${err.message}`, 'error');
      else logCallback('Python controller finished', 'success');
      if (onFinish) onFinish(err || null);
    },
  });
}

export { pythonToPseudoC };