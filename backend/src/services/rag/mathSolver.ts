export interface MathSolverResult {
  isMatch: boolean;
  equationStr?: string;
  variable?: string;
  coefficient?: number;
  constant?: number;
  rhs?: number;
  solutionValue?: number;
  steps?: string[];
  answerText?: string;
  spokenText?: string;
}

export interface ArithmeticResult {
  isMatch: boolean;
  expression?: string;
  result?: number;
  answerText?: string;
  spokenText?: string;
}

export interface ArithmeticExplanationResult {
  isMatch: boolean;
  operand1?: number;
  operand2?: number;
  operator?: '+' | '-' | '*' | '/';
  result?: number;
  answerText?: string;
  spokenText?: string;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

/**
 * Explains how an arithmetic operation produces its result dynamically
 * (e.g. "how 2+5 is 7", "why is 2+5 equal to 7", "how do you get 7 from 2+5", "why 10-3 is 7").
 */
export function explainArithmeticOperation(input: string): ArithmeticExplanationResult {
  if (!input) return { isMatch: false };

  let text = input.toLowerCase().trim();

  // Normalize operator words
  text = text
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bmultiplied\s+by\b/g, '*')
    .replace(/\btimes\b/g, '*')
    .replace(/\binto\b/g, '*')
    .replace(/\bdivided\s+by\b/g, '/')
    .replace(/\bover\b/g, '/');

  // Convert word numbers
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    text = text.replace(regex, num.toString());
  }

  // Pattern 1: "how do you get 7 from 2+5" or "how we get 7 from 2+5"
  const getFromMatch = text.match(/how\s+(do\s+you|do\s+we|to|can\s+we)\s+get\s+(\d+\.?\d*)\s+from\s+(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)/i);
  if (getFromMatch) {
    const expected = parseFloat(getFromMatch[2]);
    const a = parseFloat(getFromMatch[3]);
    const op = getFromMatch[4] as '+' | '-' | '*' | '/';
    const b = parseFloat(getFromMatch[5]);
    return buildArithmeticExplanation(a, b, op);
  }

  // Pattern 2: "how 2+5 is 7", "why 2+5 is 7", "why is 2+5 equal to 7", "how does 2+5 equal 7", "how 2+5 = 7"
  const howIsMatch = text.match(/(?:how|why)\s+(?:is\s+|does\s+)?(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)\s*(?:is|equals?|equal\s+to|=|gives?|makes?)\s*(\d+\.?\d*)?/i);
  if (howIsMatch) {
    const a = parseFloat(howIsMatch[1]);
    const op = howIsMatch[2] as '+' | '-' | '*' | '/';
    const b = parseFloat(howIsMatch[3]);
    return buildArithmeticExplanation(a, b, op);
  }

  // Pattern 3: "what happens when I add 2 and 5"
  const whatHappensMatch = text.match(/what\s+happens\s+when\s+(?:i|we)\s+(add|subtract|multiply|divide)\s+(\d+\.?\d*)\s+(?:and|from|by|with)\s+(\d+\.?\d*)/i);
  if (whatHappensMatch) {
    const verb = whatHappensMatch[1];
    const n1 = parseFloat(whatHappensMatch[2]);
    const n2 = parseFloat(whatHappensMatch[3]);
    let op: '+' | '-' | '*' | '/' = '+';
    if (verb === 'subtract') op = '-';
    if (verb === 'multiply') op = '*';
    if (verb === 'divide') op = '/';
    return buildArithmeticExplanation(n1, n2, op);
  }

  return { isMatch: false };
}

export function buildArithmeticExplanation(a: number, b: number, op: '+' | '-' | '*' | '/'): ArithmeticExplanationResult {
  if (isNaN(a) || isNaN(b)) return { isMatch: false };

  let result = 0;
  let answerText = '';
  let spokenText = '';

  if (op === '+') {
    result = a + b;
    let progressionStr = '';
    if (b > 0 && b <= 12 && Number.isInteger(a) && Number.isInteger(b)) {
      const steps: number[] = [a];
      for (let s = 1; s <= b; s++) {
        steps.push(a + s);
      }
      progressionStr = steps.join(' → ');
    }

    answerText = `Because ${a} + ${b} means combining ${a} and ${b}.\n\n` +
      (progressionStr ? `Start with ${a} and add ${b} more:\n${progressionStr}\n\n` : '') +
      `So:\n\n**${a} + ${b} = ${result}**.`;

    spokenText = `Because ${a} plus ${b} means combining ${a} and ${b}. Starting with ${a} and adding ${b} gives ${result}.`;
  } else if (op === '-') {
    result = a - b;
    let progressionStr = '';
    if (b > 0 && b <= 12 && Number.isInteger(a) && Number.isInteger(b)) {
      const steps: number[] = [a];
      for (let s = 1; s <= b; s++) {
        steps.push(a - s);
      }
      progressionStr = steps.join(' → ');
    }

    answerText = `Because ${a} - ${b} means taking away ${b} from ${a}.\n\n` +
      (progressionStr ? `Start with ${a} and count down ${b}:\n${progressionStr}\n\n` : '') +
      `So:\n\n**${a} - ${b} = ${result}**.`;

    spokenText = `Because ${a} minus ${b} means taking away ${b} from ${a}, which leaves ${result}.`;
  } else if (op === '*') {
    result = a * b;
    let repeated = '';
    if (b > 0 && b <= 8 && Number.isInteger(b)) {
      repeated = Array(b).fill(a).join(' + ') + ` = ${result}`;
    }

    answerText = `Because ${a} × ${b} means adding ${a} a total of ${b} times:\n` +
      (repeated ? `${repeated}\n\n` : '') +
      `So:\n\n**${a} × ${b} = ${result}**.`;

    spokenText = `Because ${a} times ${b} means adding ${a}, ${b} times, which equals ${result}.`;
  } else if (op === '/') {
    if (b === 0) {
      return { isMatch: false };
    }
    result = a / b;
    const formattedResult = Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(4)).toString();

    answerText = `Because ${a} / ${b} means dividing ${a} into ${b} equal parts (or finding how many ${b}s make ${a}):\n\n` +
      `So:\n\n**${a} / ${b} = ${formattedResult}**.`;

    spokenText = `Because ${a} divided by ${b} equals ${formattedResult}.`;
  }

  return {
    isMatch: true,
    operand1: a,
    operand2: b,
    operator: op,
    result,
    answerText,
    spokenText,
  };
}

/**
 * Evaluates simple arithmetic expressions dynamically (e.g. "What is 2+5?", "10-3", "4*6", "20/5", "10+20", "10-4").
 */
export function evaluateSimpleArithmetic(input: string): ArithmeticResult {
  if (!input) return { isMatch: false };

  let text = input.toLowerCase().trim();

  // Strip common question wrappers
  text = text
    .replace(/[?!=]/g, ' ')
    .replace(/^what\s+(is|are)\s+/i, '')
    .replace(/^what's\s+/i, '')
    .replace(/^whats\s+/i, '')
    .replace(/^calculate\s+/i, '')
    .replace(/^evaluate\s+/i, '')
    .replace(/^compute\s+/i, '')
    .replace(/^how\s+much\s+is\s+/i, '')
    .replace(/^find\s+the\s+value\s+of\s+/i, '')
    .replace(/^value\s+of\s+/i, '')
    .replace(/^solve\s+/i, '')
    .trim();

  // Replace operator words
  text = text
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bmultiplied\s+by\b/g, '*')
    .replace(/\btimes\b/g, '*')
    .replace(/\binto\b/g, '*')
    .replace(/\bx\b/g, '*')
    .replace(/\bdivided\s+by\b/g, '/')
    .replace(/\bover\b/g, '/')
    .replace(/\bmodulo\b/g, '%')
    .replace(/\bmod\b/g, '%');

  // Replace word numbers (e.g., "two + five" -> "2 + 5")
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    text = text.replace(regex, num.toString());
  }

  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Must only contain digits, operators, parentheses, and spaces
  // And must contain at least one operator (+, -, *, /, %, ^)
  if (!/^[\d\s+\-*/().%^]+$/.test(text)) {
    return { isMatch: false };
  }

  // Ensure there is at least one operator or two numbers
  if (!/[+\-*/%^]/.test(text)) {
    return { isMatch: false };
  }

  try {
    const val = safeEvaluateExpression(text);
    if (val === null || isNaN(val) || !isFinite(val)) {
      return { isMatch: false };
    }

    const formattedResult = Number.isInteger(val) ? val.toString() : parseFloat(val.toFixed(4)).toString();

    return {
      isMatch: true,
      expression: text,
      result: val,
      answerText: formattedResult,
      spokenText: formattedResult,
    };
  } catch (err) {
    return { isMatch: false };
  }
}

/**
 * Safe Recursive Descent Parser / Evaluator for arithmetic expressions.
 */
function safeEvaluateExpression(expr: string): number | null {
  const tokens: string[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, '');

  while (i < s.length) {
    const ch = s[i];
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(s[i + 1] || ''))) {
      let numStr = '';
      while (i < s.length && (/[\d.]/.test(s[i]))) {
        numStr += s[i];
        i++;
      }
      tokens.push(numStr);
    } else if ('+-*/%^()'.includes(ch)) {
      tokens.push(ch);
      i++;
    } else {
      return null;
    }
  }

  if (tokens.length === 0) return null;

  let pos = 0;

  function parseExpression(): number {
    let result = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const nextTerm = parseTerm();
      if (op === '+') result += nextTerm;
      else result -= nextTerm;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%')) {
      const op = tokens[pos++];
      const nextPower = parsePower();
      if (op === '*') result *= nextPower;
      else if (op === '/') {
        if (nextPower === 0) throw new Error('Division by zero');
        result /= nextPower;
      } else if (op === '%') {
        result %= nextPower;
      }
    }
    return result;
  }

  function parsePower(): number {
    const base = parseFactor();
    if (pos < tokens.length && tokens[pos] === '^') {
      pos++;
      const exponent = parsePower();
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parseFactor(): number {
    if (pos >= tokens.length) throw new Error('Unexpected end of expression');

    const token = tokens[pos++];

    if (token === '+') {
      return parseFactor();
    }
    if (token === '-') {
      return -parseFactor();
    }
    if (token === '(') {
      const val = parseExpression();
      if (pos >= tokens.length || tokens[pos++] !== ')') {
        throw new Error('Mismatched parentheses');
      }
      return val;
    }

    const num = parseFloat(token);
    if (isNaN(num)) throw new Error(`Invalid number: ${token}`);
    return num;
  }

  const result = parseExpression();
  if (pos !== tokens.length) {
    return null;
  }
  return result;
}

/**
 * Deterministic, step-by-step linear equation solver.
 */
export function solveLinearEquation(input: string): MathSolverResult {
  if (!input) return { isMatch: false };

  // Remove question words
  const cleaned = input
    .replace(/[?.,!]/g, ' ')
    .replace(/how\s+(do\s+i|to)\s+solve/gi, '')
    .replace(/what\s+is\s+([a-z])\s+in/gi, '')
    .replace(/find\s+([a-z])\s+in/gi, '')
    .replace(/solve\s+for\s+[a-z]/gi, '')
    .replace(/solve\s+/gi, '')
    .trim();

  const normalized = cleaned.replace(/\s+/g, ' ');

  // Match: ax + b = c, ax - b = c, ax = c, x + b = c, x - b = c, x = c
  const linearRegex = /([+-]?\s*\d*\.?\d*)\s*([a-zA-Z])\s*([+-]\s*\d+\.?\d*)?\s*=\s*([+-]?\s*\d+\.?\d*)/;

  const match = normalized.match(linearRegex);
  if (!match) {
    // Try reversed order: b + ax = c or b - ax = c
    const reversedRegex = /([+-]?\s*\d+\.?\d*)\s*([+-])\s*(\d*\.?\d*)\s*([a-zA-Z])\s*=\s*([+-]?\s*\d+\.?\d*)/;
    const revMatch = normalized.match(reversedRegex);
    if (revMatch) {
      const constStr = revMatch[1].replace(/\s+/g, '');
      const signStr = revMatch[2].replace(/\s+/g, '');
      const coeffStr = revMatch[3].replace(/\s+/g, '');
      const variable = revMatch[4];
      const rhsStr = revMatch[5].replace(/\s+/g, '');

      let coeff = coeffStr === '' ? 1 : parseFloat(coeffStr);
      if (signStr === '-') coeff = -coeff;
      const constant = parseFloat(constStr);
      const rhs = parseFloat(rhsStr);

      return buildSolution(variable, coeff, constant, rhs);
    }

    return { isMatch: false };
  }

  const rawCoeff = match[1].replace(/\s+/g, '');
  const variable = match[2];
  const rawConst = match[3] ? match[3].replace(/\s+/g, '') : '0';
  const rawRhs = match[4].replace(/\s+/g, '');

  let coefficient = 1;
  if (rawCoeff === '' || rawCoeff === '+') {
    coefficient = 1;
  } else if (rawCoeff === '-') {
    coefficient = -1;
  } else {
    coefficient = parseFloat(rawCoeff);
  }

  const constant = parseFloat(rawConst || '0');
  const rhs = parseFloat(rawRhs);

  if (isNaN(coefficient) || isNaN(constant) || isNaN(rhs)) {
    return { isMatch: false };
  }

  if (coefficient === 0) {
    return { isMatch: false };
  }

  return buildSolution(variable, coefficient, constant, rhs);
}

function buildSolution(
  variable: string,
  coefficient: number,
  constant: number,
  rhs: number
): MathSolverResult {
  const rhsAfterTransposition = rhs - constant;
  const solution = rhsAfterTransposition / coefficient;
  const formattedSolution = Number.isInteger(solution) ? solution.toString() : parseFloat(solution.toFixed(4)).toString();

  const originalEq = `${coefficient === 1 ? '' : coefficient === -1 ? '-' : coefficient}${variable} ${constant >= 0 ? (constant === 0 ? '' : `+ ${constant}`) : `- ${Math.abs(constant)}`} = ${rhs}`.replace(/\s+/g, ' ').trim();

  const steps: string[] = [];
  
  steps.push(`Start with the equation: **${originalEq}**`);

  if (constant !== 0) {
    const oppOp = constant > 0 ? 'Subtract' : 'Add';
    const absVal = Math.abs(constant);
    steps.push(
      `Step 1: ${oppOp} ${absVal} ${constant > 0 ? 'from' : 'to'} both sides to isolate the variable term:  \n` +
      `$$${coefficient === 1 ? '' : coefficient}${variable} = ${rhs} ${constant > 0 ? '-' : '+'} ${absVal} \\implies ${coefficient === 1 ? '' : coefficient}${variable} = ${rhsAfterTransposition}$$`
    );
  } else {
    steps.push(`Step 1: The constant is 0, so the variable term is already isolated: $$${coefficient === 1 ? '' : coefficient}${variable} = ${rhsAfterTransposition}$$`);
  }

  if (coefficient !== 1) {
    steps.push(
      `Step 2: Divide both sides by the coefficient **${coefficient}** to solve for **${variable}**:  \n` +
      `$$${variable} = \\frac{${rhsAfterTransposition}}{${coefficient}} \\implies ${variable} = ${formattedSolution}$$`
    );
  } else {
    steps.push(`Step 2: The coefficient is 1, so **${variable} = ${formattedSolution}**.`);
  }

  steps.push(`**Final Solution:** **${variable} = ${formattedSolution}**`);

  const answerText = `Let's solve ${originalEq} step by step:\n\n` + steps.join('\n\n');

  let spokenText = `Let's solve ${originalEq} step by step. `;
  if (constant !== 0) {
    spokenText += constant > 0 
      ? `First, subtract ${Math.abs(constant)} from both sides, giving ${coefficient === 1 ? '' : coefficient}${variable} equals ${rhsAfterTransposition}. `
      : `First, add ${Math.abs(constant)} to both sides, giving ${coefficient === 1 ? '' : coefficient}${variable} equals ${rhsAfterTransposition}. `;
  }
  if (coefficient !== 1) {
    spokenText += `Next, divide both sides by ${coefficient}. Therefore, ${variable} equals ${formattedSolution}.`;
  } else {
    spokenText += `Therefore, ${variable} equals ${formattedSolution}.`;
  }

  return {
    isMatch: true,
    equationStr: originalEq,
    variable,
    coefficient,
    constant,
    rhs,
    solutionValue: parseFloat(formattedSolution),
    steps,
    answerText,
    spokenText,
  };
}
