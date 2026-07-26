const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

type FormulaValue = string | number;
type MathTag = 'math' | 'mrow' | 'mi' | 'mn' | 'mo' | 'mfrac' | 'msqrt' | 'mtext';

export interface SodsFormulaValues {
  probability: FormulaValue;
  urgency: FormulaValue;
  complexity: FormulaValue;
  importance: FormulaValue;
  skill: FormulaValue;
  frequency: FormulaValue;
  activity: FormulaValue;
}

export interface ToastFormulaValues {
  height: FormulaValue;
  gravity: FormulaValue;
  overhang: FormulaValue;
  butter: FormulaValue;
  friction: FormulaValue;
  inertia: FormulaValue;
}

function mathElement(tag: MathTag, text?: FormulaValue): MathMLElement {
  const element = document.createElementNS(
    MATHML_NAMESPACE,
    tag,
  ) as MathMLElement;
  if (text !== undefined) {
    element.textContent = String(text);
  }
  return element;
}

function row(...children: MathMLElement[]): MathMLElement {
  const element = mathElement('mrow');
  element.append(...children);
  return element;
}

function operator(value: string): MathMLElement {
  return mathElement('mo', value);
}

function numberOrVariable(
  value: FormulaValue,
  title?: string,
): MathMLElement {
  const isNumber = typeof value === 'number' || /^-?\d+(?:\.\d+)?$/.test(value);
  const element = mathElement(isNumber ? 'mn' : 'mi', value);
  if (!isNumber && title) {
    element.setAttribute('title', title);
    element.setAttribute('data-tooltip', title);
  }
  return element;
}

function fraction(
  numerator: MathMLElement,
  denominator: MathMLElement,
): MathMLElement {
  const element = mathElement('mfrac');
  element.append(numerator, denominator);
  return element;
}

function squareRoot(value: MathMLElement): MathMLElement {
  const element = mathElement('msqrt');
  element.append(value);
  return element;
}

export function renderSodsFormula(
  container: Element,
  values: SodsFormulaValues,
): void {
  const math = mathElement('math');
  math.setAttribute('display', 'block');
  math.setAttribute(
    'aria-label',
    `Probability equals urgency plus complexity plus importance, multiplied by ten minus skill, divided by twenty, multiplied by activity, multiplied by one divided by one minus sine of frequency divided by ten.`,
  );

  const summedInputs = row(
    operator('('),
    numberOrVariable(values.urgency, 'Urgency (1-9)'),
    operator('+'),
    numberOrVariable(values.complexity, 'Complexity (1-9)'),
    operator('+'),
    numberOrVariable(values.importance, 'Importance (1-9)'),
    operator(')'),
  );
  const skillFactor = row(
    operator('('),
    mathElement('mn', 10),
    operator('−'),
    numberOrVariable(values.skill, 'Skill (1-9)'),
    operator(')'),
  );
  const frequencyFraction = fraction(
    numberOrVariable(values.frequency, 'Frequency (1-9)'),
    mathElement('mn', 10),
  );
  const sine = row(
    mathElement('mi', 'sin'),
    operator('('),
    frequencyFraction,
    operator(')'),
  );

  math.append(
    row(
      numberOrVariable(values.probability, 'Probability'),
      operator('='),
      fraction(
        row(summedInputs, operator('×'), skillFactor),
        mathElement('mn', 20),
      ),
      operator('×'),
      numberOrVariable(values.activity, 'Activity constant (0.7)'),
      operator('×'),
      fraction(
        mathElement('mn', 1),
        row(mathElement('mn', 1), operator('−'), sine),
      ),
    ),
  );

  container.replaceChildren(math);
}

export function renderToastFormula(
  container: Element,
  values: ToastFormulaValues,
): void {
  const math = mathElement('math');
  math.setAttribute('display', 'block');
  math.setAttribute(
    'aria-label',
    'Butter-down probability derived from height, gravity, overhang, butter, friction, and toast inertia.',
  );

  const rotation = fraction(
    row(
      mathElement('mn', 30),
      operator('×'),
      squareRoot(
        fraction(
          numberOrVariable(values.height, 'Height of fall (30-200 cm)'),
          numberOrVariable(values.gravity, 'Gravity (162-2479 cm/s²)'),
        ),
      ),
      operator('×'),
      numberOrVariable(values.overhang, 'Initial overhang or push (1-20 cm)'),
      operator('×'),
      numberOrVariable(values.butter, 'Butter factor (1.0-2.0)'),
    ),
    row(
      numberOrVariable(values.inertia, 'Toast inertia (250-500)'),
      operator('+'),
      numberOrVariable(values.friction, 'Air friction or drag (0-100)'),
    ),
  );

  const label = mathElement('mtext', 'P butter-down');
  math.append(
    row(
      label,
      operator('='),
      operator('('),
      mathElement('mn', 1),
      operator('−'),
      operator('|'),
      operator('('),
      rotation,
      mathElement('mtext', ' mod 1'),
      operator(')'),
      operator('−'),
      mathElement('mn', '0.5'),
      operator('|'),
      operator('×'),
      mathElement('mn', 2),
      operator(')'),
      operator('×'),
      mathElement('mn', 100),
      operator('%'),
    ),
  );

  container.replaceChildren(math);
}
