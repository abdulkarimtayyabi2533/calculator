// Scientific Calculator — recursive-descent parser, no eval().
// Supports: + − × ÷ % ^ ! parentheses, sin cos tan (and inverses),
// ln log √, constants π e, DEG/RAD mode, and Ans.

const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const historyList = document.getElementById("historyList");
const angleBtn = document.getElementById("angleToggle");

let expr = "";
let lastAnswer = 0;
let justEvaluated = false;
let useDegrees = true;

const DISPLAY_MAP = { "×": "*", "÷": "/", "−": "-", "π": "π", "e": "e" };

function render() {
  expressionEl.textContent = expr || "";
  resultEl.classList.remove("error");
}

function showResult(value) {
  const rounded = Math.round(value * 1e12) / 1e12;
  resultEl.textContent = String(rounded);
  resultEl.classList.remove("error");
}

function showError() {
  resultEl.textContent = "Error";
  resultEl.classList.add("error");
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error("Bad factorial");
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ---------- Tokenizer ----------
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < input.length && /[0-9.]/.test(input[i])) num += input[i++];
      if ((num.match(/\./g) || []).length > 1) throw new Error("Bad number");
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if (ch === "π") { tokens.push({ type: "num", value: Math.PI }); i++; continue; }
    if (ch === "e") { tokens.push({ type: "num", value: Math.E }); i++; continue; }
    if ("+-*/%^!()".includes(ch)) { tokens.push({ type: "op", value: ch }); i++; continue; }
    if (/[a-zA-Z⁻¹²√]/.test(ch)) {
      let name = "";
      while (i < input.length && /[a-zA-Z⁻¹²√]/.test(input[i])) name += input[i++];
      tokens.push({ type: "fn", value: name });
      continue;
    }
    throw new Error("Unknown character: " + ch);
  }
  return tokens;
}

// ---------- Parser ----------
function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let value = parseTerm();
    while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = next().value;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm() {
    let value = parsePower();
    while (peek() && peek().type === "op" && ["*", "/", "%"].includes(peek().value)) {
      const op = next().value;
      const rhs = parsePower();
      if (op === "*") value *= rhs;
      else if (op === "/") {
        if (rhs === 0) throw new Error("Division by zero");
        value /= rhs;
      } else value %= rhs;
    }
    return value;
  }

  function parsePower() {
    let base = parseUnary();
    if (peek() && peek().type === "op" && peek().value === "^") {
      next();
      const exponent = parsePower(); // right-associative
      base = Math.pow(base, exponent);
    }
    return base;
  }

  function parseUnary() {
    if (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = next().value;
      const value = parseUnary();
      return op === "-" ? -value : value;
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (peek() && peek().type === "op" && peek().value === "!") {
      next();
      value = factorial(value);
    }
    return value;
  }

  const toRad = (x) => (useDegrees ? (x * Math.PI) / 180 : x);
  const fromRad = (x) => (useDegrees ? (x * 180) / Math.PI : x);

  function applyFn(name, arg) {
    switch (name) {
      case "sin": return Math.sin(toRad(arg));
      case "cos": return Math.cos(toRad(arg));
      case "tan": return Math.tan(toRad(arg));
      case "sin⁻¹": case "asin": return fromRad(Math.asin(arg));
      case "cos⁻¹": case "acos": return fromRad(Math.acos(arg));
      case "tan⁻¹": case "atan": return fromRad(Math.atan(arg));
      case "ln": return Math.log(arg);
      case "log": return Math.log10(arg);
      case "√": case "sqrt": return Math.sqrt(arg);
      default: throw new Error("Unknown function: " + name);
    }
  }

  function parsePrimary() {
    const token = next();
    if (!token) throw new Error("Unexpected end");
    if (token.type === "num") return token.value;
    if (token.type === "op" && token.value === "(") {
      const value = parseExpr();
      const closing = next();
      if (!closing || closing.value !== ")") throw new Error("Missing )");
      return value;
    }
    if (token.type === "fn") {
      const arg = parsePrimary();
      if (token.value === "1/") {
        if (arg === 0) throw new Error("Division by zero");
        return 1 / arg;
      }
      return applyFn(token.value, arg);
    }
    throw new Error("Unexpected token");
  }

  const value = parseExpr();
  if (pos < tokens.length) throw new Error("Unexpected input");
  if (typeof value !== "number" || !isFinite(value)) throw new Error("Invalid result");
  return value;
}

// ---------- UI wiring ----------
function insert(text) {
  if (justEvaluated && /[0-9.πe)]/.test(text[0])) {
    expr = "";
  }
  justEvaluated = false;
  expr += text;
  render();
}

function evaluate() {
  if (!expr.trim()) return;
  try {
    const jsExpr = [...expr].map((c) => DISPLAY_MAP[c] || c).join("");
    const value = parse(jsExpr);
    addHistory(expr, value);
    lastAnswer = value;
    expr = String(Math.round(value * 1e12) / 1e12);
    showResult(value);
    justEvaluated = true;
  } catch {
    showError();
  }
}

function addHistory(expression, value) {
  const li = document.createElement("li");
  const rounded = Math.round(value * 1e12) / 1e12;
  li.textContent = `${expression} = ${rounded}`;
  li.addEventListener("click", () => {
    expr = String(rounded);
    render();
    showResult(rounded);
    justEvaluated = true;
  });
  historyList.prepend(li);
  while (historyList.children.length > 20) historyList.lastChild.remove();
}

document.querySelectorAll("[data-insert]").forEach((btn) => {
  btn.addEventListener("click", () => insert(btn.dataset.insert));
});

document.getElementById("clear").addEventListener("click", () => {
  expr = "";
  resultEl.textContent = "0";
  render();
});

document.getElementById("backspace").addEventListener("click", () => {
  expr = expr.slice(0, -1);
  justEvaluated = false;
  render();
});

document.getElementById("equals").addEventListener("click", evaluate);

document.getElementById("ans").addEventListener("click", () => {
  if (justEvaluated) expr = "";
  justEvaluated = false;
  expr += String(lastAnswer);
  render();
});

document.getElementById("clearHistory").addEventListener("click", () => {
  historyList.innerHTML = "";
});

angleBtn.addEventListener("click", () => {
  useDegrees = !useDegrees;
  angleBtn.textContent = useDegrees ? "DEG" : "RAD";
});

document.addEventListener("keydown", (e) => {
  if (/^[0-9+\-*/.%^!()]$/.test(e.key)) insert(e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key);
  else if (e.key === "Enter" || e.key === "=") evaluate();
  else if (e.key === "Backspace") document.getElementById("backspace").click();
  else if (e.key === "Escape") document.getElementById("clear").click();
});

render();
