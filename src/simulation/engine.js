// src/simulation/engine.js
//
// A small, language-agnostic tokenizer / recursive-descent parser /
// generator-based tree-walking evaluator. Both the C++ (Arduino-style)
// front end and the Python front end compile down to the same brace +
// semicolon grammar and run on this one engine — Python source is first
// rewritten (indentation -> braces, `def` -> `function`, etc.) by
// pythonController.js before it ever reaches this file.
//
// Using generators for evalExpr/evalStmt is what lets delay()/sleep()
// pause a running program (via a real timer) without blocking the
// browser's UI thread — the classic failure mode of trying to fake
// Arduino's loop()/delay() model with synchronous JS.

export const TYPE_KEYWORDS = new Set([
  'int', 'float', 'double', 'bool', 'boolean', 'char', 'long', 'byte',
  'String', 'Servo', 'void', 'function', 'var', 'let', 'auto',
]);

export class ReturnSignal { constructor(value) { this.value = value; } }
export class BreakSignal {}
export class ContinueSignal {}
const BREAK = new BreakSignal();
const CONTINUE = new ContinueSignal();

/* ---------------- Tokenizer ---------------- */
export function tokenize(src) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isIdStart = (c) => /[A-Za-z_]/.test(c);
  const isIdChar = (c) => /[A-Za-z0-9_]/.test(c);
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2; continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let start = i;
      while (i < n && isDigit(src[i])) i++;
      if (src[i] === '.') { i++; while (i < n && isDigit(src[i])) i++; }
      tokens.push({ type: 'NUM', value: parseFloat(src.slice(start, i)), line });
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c; const startLine = line; i++; let s = '';
      const escapes = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0' };
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') {
          const esc = src[i + 1];
          s += (esc in escapes) ? escapes[esc] : esc;
          i += 2;
        } else { if (src[i] === '\n') line++; s += src[i]; i++; }
      }
      i++;
      tokens.push({ type: 'STR', value: s, line: startLine });
      continue;
    }
    if (isIdStart(c)) {
      let start = i;
      while (i < n && isIdChar(src[i])) i++;
      tokens.push({ type: 'ID', value: src.slice(start, i), line });
      continue;
    }
    const three = src.slice(i, i + 3);
    if (three === '===' || three === '!==') { tokens.push({ type: three.slice(0, 2), line }); i += 3; continue; }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '++', '--'].includes(two)) {
      tokens.push({ type: two, line }); i += 2; continue;
    }
    tokens.push({ type: c, line }); i++;
  }
  tokens.push({ type: 'EOF', line });
  return tokens;
}

// Strip preprocessor directives (#include, #define, ...) — not valid tokens
// in our grammar and not needed by the simulator.
export function stripDirectives(src) {
  return src.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
}

/* ---------------- Parser ---------------- */
export class Parser {
  constructor(tokens) { this.t = tokens; this.p = 0; }
  peek(o = 0) { return this.t[this.p + o]; }
  next() { return this.t[this.p++]; }
  is(type) { return this.peek().type === type; }
  isVal(val) { const tk = this.peek(); return tk.type === 'ID' && tk.value === val; }
  expect(type) {
    if (!this.is(type)) throw new Error(`Line ${this.peek().line}: expected '${type}' but found '${this.peek().type === 'ID' ? this.peek().value : this.peek().type}'`);
    return this.next();
  }

  parseProgram() {
    const body = [];
    while (!this.is('EOF')) body.push(this.parseStatement());
    return { type: 'Program', body };
  }

  parseBlock() {
    this.expect('{');
    const body = [];
    while (!this.is('}') && !this.is('EOF')) body.push(this.parseStatement());
    this.expect('}');
    return { type: 'Block', body };
  }

  parseStatement() {
    const startLine = this.peek().line;
    const node = this.parseStatementInner();
    if (node && node.line === undefined) node.line = startLine;
    return node;
  }

  parseStatementInner() {
    const tk = this.peek();
    if (tk.type === '{') return this.parseBlock();
    if (tk.type === 'ID' && TYPE_KEYWORDS.has(tk.value)) return this.parseTypeLed();
    if (this.isVal('if')) return this.parseIf();
    if (this.isVal('while')) return this.parseWhile();
    if (this.isVal('for')) return this.parseFor();
    if (this.isVal('return')) {
      this.next();
      let arg = null;
      if (!this.is(';')) arg = this.parseExpression();
      if (this.is(';')) this.next();
      return { type: 'Return', argument: arg };
    }
    if (this.isVal('break')) { this.next(); if (this.is(';')) this.next(); return { type: 'Break' }; }
    if (this.isVal('continue')) { this.next(); if (this.is(';')) this.next(); return { type: 'Continue' }; }
    const expr = this.parseExpression();
    if (this.is(';')) this.next();
    return { type: 'ExprStmt', expr };
  }

  parseTypeLed() {
    const typeName = this.next().value;
    const name = this.expect('ID').value;
    if (this.is('(')) {
      const params = this.parseParams();
      const body = this.parseBlock();
      return { type: 'FunctionDecl', name, params, body };
    }
    const decls = [];
    let initExpr = null;
    if (this.is('=')) { this.next(); initExpr = this.parseAssign(); }
    decls.push({ name, init: initExpr });
    while (this.is(',')) {
      this.next();
      const n2 = this.expect('ID').value;
      let i2 = null;
      if (this.is('=')) { this.next(); i2 = this.parseAssign(); }
      decls.push({ name: n2, init: i2 });
    }
    if (this.is(';')) this.next();
    return { type: 'DeclStmt', typeName, decls };
  }

  parseParams() {
    this.expect('(');
    const params = [];
    while (!this.is(')')) {
      if (this.peek().type === 'ID' && TYPE_KEYWORDS.has(this.peek().value) && this.peek(1).type === 'ID') this.next();
      params.push(this.expect('ID').value);
      if (this.is(',')) this.next();
    }
    this.expect(')');
    return params;
  }

  parseIf() {
    this.next(); this.expect('(');
    const test = this.parseExpression();
    this.expect(')');
    const consequent = this.parseStatement();
    let alternate = null;
    if (this.isVal('else')) { this.next(); alternate = this.parseStatement(); }
    return { type: 'If', test, consequent, alternate };
  }

  parseWhile() {
    this.next(); this.expect('(');
    const test = this.parseExpression();
    this.expect(')');
    const body = this.parseStatement();
    return { type: 'While', test, body };
  }

  parseFor() {
    const forLine = this.peek().line;
    this.next(); this.expect('(');
    // Python-style `for x in iterable:` (already brace-converted to `for (x in iterable)`)
    if (this.peek().type === 'ID' && this.peek(1).type === 'ID' && this.peek(1).value === 'in') {
      const varName = this.next().value;
      this.next(); // 'in'
      const iterable = this.parseExpression();
      this.expect(')');
      const body = this.parseStatement();
      return { type: 'ForIn', varName, iterable, body };
    }
    // C-style `for (int i = 0; i < n; i++)`
    let init = null;
    if (!this.is(';')) {
      if (this.peek().type === 'ID' && TYPE_KEYWORDS.has(this.peek().value)) {
        const typeName = this.next().value;
        const name = this.expect('ID').value;
        let ie = null;
        if (this.is('=')) { this.next(); ie = this.parseAssign(); }
        init = { type: 'DeclStmt', typeName, decls: [{ name, init: ie }], line: forLine };
      } else {
        init = { type: 'ExprStmt', expr: this.parseExpression(), line: forLine };
      }
    }
    this.expect(';');
    let test = null;
    if (!this.is(';')) test = this.parseExpression();
    this.expect(';');
    let update = null;
    if (!this.is(')')) update = this.parseExpression();
    this.expect(')');
    const body = this.parseStatement();
    return { type: 'For', init, test, update, body };
  }

  parseExpression() { return this.parseAssign(); }

  parseAssign() {
    const left = this.parseLogicalOr();
    if (['=', '+=', '-=', '*=', '/='].includes(this.peek().type)) {
      const op = this.next().type;
      const right = this.parseAssign();
      return { type: 'Assign', op, target: left, value: right };
    }
    return left;
  }
  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.is('||')) { this.next(); left = { type: 'Logical', op: '||', left, right: this.parseLogicalAnd() }; }
    return left;
  }
  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.is('&&')) { this.next(); left = { type: 'Logical', op: '&&', left, right: this.parseEquality() }; }
    return left;
  }
  parseEquality() {
    let left = this.parseRelational();
    while (this.is('==') || this.is('!=')) {
      const op = this.next().type;
      left = { type: 'Binary', op, left, right: this.parseRelational() };
    }
    return left;
  }
  parseRelational() {
    let left = this.parseAdditive();
    while (['<', '>', '<=', '>='].includes(this.peek().type)) {
      const op = this.next().type;
      left = { type: 'Binary', op, left, right: this.parseAdditive() };
    }
    return left;
  }
  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.is('+') || this.is('-')) {
      const op = this.next().type;
      left = { type: 'Binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }
  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const op = this.next().type;
      left = { type: 'Binary', op, left, right: this.parseUnary() };
    }
    return left;
  }
  parseUnary() {
    if (this.is('!') || this.is('-')) {
      const op = this.next().type;
      return { type: 'Unary', op, argument: this.parseUnary() };
    }
    if (this.is('++') || this.is('--')) {
      const op = this.next().type;
      return { type: 'Update', op, argument: this.parseUnary(), prefix: true };
    }
    return this.parsePostfix();
  }
  parsePostfix() {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.is('.')) {
        this.next();
        const prop = this.expect('ID').value;
        expr = { type: 'Member', object: expr, property: prop };
      } else if (this.is('(')) {
        this.next();
        const args = [];
        while (!this.is(')')) { args.push(this.parseAssign()); if (this.is(',')) this.next(); }
        this.expect(')');
        expr = { type: 'Call', callee: expr, args };
      } else if (this.is('++') || this.is('--')) {
        const op = this.next().type;
        expr = { type: 'Update', op, argument: expr, prefix: false };
      } else break;
    }
    return expr;
  }
  parsePrimary() {
    const tk = this.peek();
    if (tk.type === 'NUM') { this.next(); return { type: 'Num', value: tk.value }; }
    if (tk.type === 'STR') { this.next(); return { type: 'Str', value: tk.value }; }
    if (tk.type === '(') { this.next(); const e = this.parseExpression(); this.expect(')'); return e; }
    if (tk.type === 'ID') {
      if (tk.value === 'true') { this.next(); return { type: 'Bool', value: true }; }
      if (tk.value === 'false') { this.next(); return { type: 'Bool', value: false }; }
      if (tk.value === 'null' || tk.value === 'NULL') { this.next(); return { type: 'Null' }; }
      this.next();
      return { type: 'Ident', name: tk.value };
    }
    throw new Error(`Unexpected token '${tk.type}'`);
  }
}

export function parseTokens(src) {
  return new Parser(tokenize(stripDirectives(src))).parseProgram();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i - 1] === b[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return d[m][n];
}

function suggestClosest(name, candidates) {
  let best = null, bestDist = Infinity;
  for (const c of candidates) {
    if (c === name) continue;
    const dist = levenshtein(name, c);
    if (dist < bestDist && dist <= Math.max(2, Math.ceil(c.length * 0.4))) { bestDist = dist; best = c; }
  }
  return best;
}

/* ---------------- Scope ---------------- */
export class Scope {
  constructor(parent) { this.vars = new Map(); this.parent = parent; }
  define(name, value) { this.vars.set(name, value); }
  has(name) { return this.vars.has(name) || (!!this.parent && this.parent.has(name)); }
  allNames() {
    const names = new Set(this.vars.keys());
    if (this.parent) this.parent.allNames().forEach((n) => names.add(n));
    return names;
  }
  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    const suggestion = suggestClosest(name, this.allNames());
    throw new Error(`Unknown identifier '${name}'${suggestion ? ` — did you mean '${suggestion}'?` : ''}`);
  }
  set(name, value) {
    let s = this;
    while (s) { if (s.vars.has(name)) { s.vars.set(name, value); return; } s = s.parent; }
    this.vars.set(name, value);
  }
}

/* ---------------- Evaluator ---------------- */
export function* evalExpr(node, scope, ctx) {
  switch (node.type) {
    case 'Num': return node.value;
    case 'Str': return node.value;
    case 'Bool': return node.value;
    case 'Null': return null;
    case 'Ident': return scope.get(node.name);
    case 'Logical': {
      const l = yield* evalExpr(node.left, scope, ctx);
      if (node.op === '&&') return l ? yield* evalExpr(node.right, scope, ctx) : l;
      return l ? l : yield* evalExpr(node.right, scope, ctx);
    }
    case 'Binary': {
      const l = yield* evalExpr(node.left, scope, ctx);
      const r = yield* evalExpr(node.right, scope, ctx);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '%': return l % r;
        case '<': return l < r;
        case '>': return l > r;
        case '<=': return l <= r;
        case '>=': return l >= r;
        case '==': return l === r;
        case '!=': return l !== r;
        default: throw new Error('Unknown operator ' + node.op);
      }
    }
    case 'Unary': {
      const v = yield* evalExpr(node.argument, scope, ctx);
      return node.op === '!' ? !v : -v;
    }
    case 'Update': {
      const delta = node.op === '++' ? 1 : -1;
      const cur = yield* evalExpr(node.argument, scope, ctx);
      const nv = cur + delta;
      yield* assignTo(node.argument, nv, scope, ctx);
      return node.prefix ? nv : cur;
    }
    case 'Assign': {
      let value;
      if (node.op === '=') {
        value = yield* evalExpr(node.value, scope, ctx);
      } else {
        const cur = yield* evalExpr(node.target, scope, ctx);
        const rhs = yield* evalExpr(node.value, scope, ctx);
        const op = node.op[0];
        value = op === '+' ? cur + rhs : op === '-' ? cur - rhs : op === '*' ? cur * rhs : cur / rhs;
      }
      yield* assignTo(node.target, value, scope, ctx);
      return value;
    }
    case 'Member': {
      const obj = yield* evalExpr(node.object, scope, ctx);
      if (obj === null || obj === undefined) throw new Error(`Cannot read '${node.property}' of ${obj}`);
      return obj[node.property];
    }
    case 'Call': {
      let thisArg = null, fn;
      if (node.callee.type === 'Member') {
        thisArg = yield* evalExpr(node.callee.object, scope, ctx);
        const prop = node.callee.property;
        fn = (thisArg !== null && thisArg !== undefined) ? thisArg[prop] : undefined;
        if (typeof fn !== 'function' && !(fn && (fn.__gen || fn.__userFn))) {
          const objName = node.callee.object.type === 'Ident' ? node.callee.object.name : 'object';
          const candidates = (thisArg && typeof thisArg === 'object') ? Object.keys(thisArg) : [];
          const suggestion = suggestClosest(prop, candidates);
          throw new Error(`'${objName}' has no method '${prop}'${suggestion ? ` — did you mean '${suggestion}'?` : ''}`);
        }
      } else {
        fn = yield* evalExpr(node.callee, scope, ctx);
      }
      const args = [];
      for (const a of node.args) args.push(yield* evalExpr(a, scope, ctx));
      return yield* callFunction(fn, args, ctx, thisArg);
    }
    default: throw new Error('Unknown expression node ' + node.type);
  }
}

function* assignTo(target, value, scope, ctx) {
  if (target.type === 'Ident') { scope.set(target.name, value); return; }
  if (target.type === 'Member') {
    const obj = yield* evalExpr(target.object, scope, ctx);
    obj[target.property] = value;
    return;
  }
  throw new Error('Invalid assignment target');
}

export function* callFunction(fnVal, args, ctx, thisArg) {
  if (typeof fnVal === 'function') return fnVal.apply(thisArg, args);
  if (fnVal && fnVal.__gen) return yield* fnVal.__gen(args, ctx);
  if (fnVal && fnVal.__userFn) {
    const scope = new Scope(fnVal.closureEnv);
    fnVal.node.params.forEach((p, i) => scope.define(p, args[i]));
    try {
      yield* execBlock(fnVal.node.body, scope, ctx);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
    return undefined;
  }
  throw new Error('Value is not callable');
}

function* execBlock(block, scope, ctx) {
  const s = new Scope(scope);
  for (const stmt of block.body) yield* evalStmt(stmt, s, ctx);
}

export function* evalStmt(node, scope, ctx) {
  ctx.stepBudget.n++;
  if (ctx.stepBudget.n % 300 === 0) yield { type: 'tick' };
  if (node.line !== undefined) {
    ctx.currentLine = node.line;
    if (ctx.onLine) ctx.onLine(node.line);
  }
  try {
    yield* evalStmtInner(node, scope, ctx);
  } catch (e) {
    if (e instanceof ReturnSignal || e instanceof BreakSignal || e instanceof ContinueSignal) throw e;
    if (!e.__lined) {
      e.line = node.line !== undefined ? node.line : ctx.currentLine;
      e.message = e.line !== undefined ? `Line ${e.line}: ${e.message}` : e.message;
      e.__lined = true;
    }
    throw e;
  }
}

function* evalStmtInner(node, scope, ctx) {
  switch (node.type) {
    case 'FunctionDecl':
      scope.define(node.name, { __userFn: true, node, closureEnv: scope });
      return;
    case 'DeclStmt':
      for (const d of node.decls) {
        let value;
        if (d.init) value = yield* evalExpr(d.init, scope, ctx);
        else if (node.typeName === 'Servo' && scope.has('Servo')) value = yield* callFunction(scope.get('Servo'), [], ctx);
        else if (node.typeName === 'String') value = '';
        else if (node.typeName === 'bool' || node.typeName === 'boolean') value = false;
        else value = 0;
        scope.define(d.name, value);
      }
      return;
    case 'ExprStmt':
      yield* evalExpr(node.expr, scope, ctx);
      return;
    case 'Block':
      yield* execBlock(node, scope, ctx);
      return;
    case 'If': {
      const t = yield* evalExpr(node.test, scope, ctx);
      if (t) yield* evalStmt(node.consequent, scope, ctx);
      else if (node.alternate) yield* evalStmt(node.alternate, scope, ctx);
      return;
    }
    case 'While': {
      while (yield* evalExpr(node.test, scope, ctx)) {
        yield { type: 'tick' };
        try { yield* evalStmt(node.body, scope, ctx); }
        catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
      }
      return;
    }
    case 'For': {
      const s = new Scope(scope);
      if (node.init) yield* evalStmt(node.init, s, ctx);
      while (node.test ? (yield* evalExpr(node.test, s, ctx)) : true) {
        yield { type: 'tick' };
        try { yield* evalStmt(node.body, s, ctx); }
        catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
        if (node.update) yield* evalExpr(node.update, s, ctx);
      }
      return;
    }
    case 'ForIn': {
      const iterable = yield* evalExpr(node.iterable, scope, ctx);
      const arr = Array.isArray(iterable) ? iterable : [];
      for (const item of arr) {
        const s = new Scope(scope);
        s.define(node.varName, item);
        yield { type: 'tick' };
        try { yield* evalStmt(node.body, s, ctx); }
        catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
      }
      return;
    }
    case 'Return': {
      const v = node.argument ? yield* evalExpr(node.argument, scope, ctx) : undefined;
      throw new ReturnSignal(v);
    }
    case 'Break': throw BREAK;
    case 'Continue': throw CONTINUE;
    default: throw new Error('Unknown statement node ' + node.type);
  }
}

export function* runProgramBody(ast, scope, ctx) {
  for (const stmt of ast.body) yield* evalStmt(stmt, scope, ctx);
}

/* ---------------- Driver: pumps the generator, honoring delay() with real timers ---------------- */
export function runGenerator(gen, { onDone, budgetPerFrame = 4000 }) {
  let stopped = false;
  function pump() {
    if (stopped) return;
    let budget = budgetPerFrame;
    let result;
    while (budget-- > 0) {
      try { result = gen.next(); }
      catch (e) { onDone(e); return; }
      if (result.done) { onDone(null, result.value); return; }
      const eff = result.value;
      if (eff && eff.type === 'wait') { setTimeout(pump, eff.ms); return; }
    }
    requestAnimationFrame(pump);
  }
  pump();
  return { stop: () => { stopped = true; } };
}