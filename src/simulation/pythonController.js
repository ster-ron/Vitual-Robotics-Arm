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
// Returns { code, lineMap } where lineMap[generatedLine] = originalLine.
// The brace-insertion process adds/removes lines relative to the source,
// so generated line numbers (which is what the tokenizer/parser see)
// don't line up with what the user actually wrote — lineMap undoes that
// for error reporting and the execution-pointer highlight.
function pythonToPseudoC(src) {
  const rawLines = src.replace(/\t/g, '    ').split('\n');
  const lines = [];
  rawLines.forEach((raw, idx) => {
    let line = raw.replace(/#.*/, '');
    if (line.trim() === '') return;
    if (/^\s*(import|from)\s/.test(line)) return;
    const indent = line.match(/^ */)[0].length;
    lines.push({ indent, content: line.trim(), origLine: idx + 1 });
  });
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
  const lineMap = [undefined]; // index 0 unused, lines are 1-indexed
  const stack = [0];
  for (const { indent, content, origLine } of lines) {
    while (indent < stack[stack.length - 1]) { stack.pop(); out.push('}'); lineMap.push(origLine); }
    if (indent > stack[stack.length - 1]) { stack.push(indent); out.push('{'); lineMap.push(origLine); }
    const opensBlock = /:\s*$/.test(content);
    let body = opensBlock ? content.replace(/:\s*$/, '') : content;
    body = translate(body, opensBlock);
    if (opensBlock) out.push(body);
    else out.push(/[;{}]\s*$/.test(body) ? body : body + ';');
    lineMap.push(origLine);
  }
  while (stack.length > 1) { stack.pop(); out.push('}'); lineMap.push(lines.length ? lines[lines.length - 1].origLine : 1); }
  return { code: out.join('\n'), lineMap };
}

function remapAstLines(node, lineMap, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (typeof node.line === 'number') node.line = lineMap[node.line] || node.line;
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (Array.isArray(val)) val.forEach((v) => remapAstLines(v, lineMap, seen));
    else if (val && typeof val === 'object') remapAstLines(val, lineMap, seen);
  }
}

function parsePython(src) {
  const { code, lineMap } = pythonToPseudoC(src);
  let ast;
  try {
    ast = new Parser(tokenize(code)).parseProgram();
  } catch (e) {
    const m = /^Line (\d+): (.*)$/.exec(e.message);
    if (m) {
      const genLine = parseInt(m[1], 10);
      const origLine = lineMap[genLine] || genLine;
      const err = new Error(`Line ${origLine}: ${m[2]}`);
      err.__lined = true;
      throw err;
    }
    throw e;
  }
  remapAstLines(ast, lineMap);
  return ast;
}

// Parses without running, for live-as-you-type error checking.
export function checkPythonSyntax(code) {
  try {
    parsePython(code);
    return { ok: true };
  } catch (e) {
    const m = /^Line (\d+): (.*)$/.exec(e.message);
    // Generated-line errors (e.g. from the tokenizer itself, before any
    // remap has happened) fall back to line 1 rather than showing a
    // confusing generated-code line number to the user.
    return { ok: false, line: m ? parseInt(m[1], 10) : 1, message: m ? m[2] : e.message };
  }
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
 * @param {(line: number) => void} [onLine] called with the source line about to execute
 */
export function runPythonCode(code, logCallback, onFinish, onLine) {
  stopPythonExecution();
  const ctx = { stepBudget: { n: 0 }, startTime: performance.now(), log: logCallback, onLine };

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