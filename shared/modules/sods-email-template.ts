type Escapable = string | number | boolean | null | undefined;

export interface SodsEmailParams {
  taskDescription?: Escapable;
  senderName?: Escapable;
  senderEmail?: Escapable;
  recipientName?: Escapable;
  urgency?: Escapable;
  complexity?: Escapable;
  importance?: Escapable;
  skill?: Escapable;
  frequency?: Escapable;
  probability?: Escapable;
  interpretation?: Escapable;
}

export function escapeHtml(value: Escapable): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}

export function createSodsEmailSubject(
  probability: Escapable,
  senderName: Escapable,
): string {
  const safeSenderName = escapeHtml(senderName);
  const safeProbability = escapeHtml(probability);
  return `${safeSenderName} shared a Sod's Law calculation with you (P=${safeProbability})`;
}

export function createSodsEmailText({
  taskDescription,
  senderName,
  senderEmail,
  recipientName,
  urgency,
  complexity,
  importance,
  skill,
  frequency,
  probability,
  interpretation,
}: SodsEmailParams): string {
  return `Hi ${recipientName},

${senderName} (${senderEmail}) has shared with you a calculation for this task: "${taskDescription}"

Using Sod's Law, here's the probability that things will go wrong:

Probability (P): ${probability}
${interpretation}

The calculation was based on:
- Urgency (1-9): ${urgency}
- Complexity (1-9): ${complexity}
- Importance (1-9): ${importance}
- Skill (1-9): ${skill}
- Frequency (1-9): ${frequency}

The higher the probability, the greater the chance that Sod's law will strike.
Probabilities range from 0.12 to 8.6.

Want to calculate your own? Visit: https://murphys-laws.com/sods-calculator
`;
}

function riskLevel(probability: Escapable): string {
  const value = Number.parseFloat(String(probability ?? 0));
  if (value >= 8) return 'critical';
  if (value >= 6) return 'high';
  if (value >= 2) return 'medium';
  return 'low';
}

export function createSodsEmailHtml({
  taskDescription,
  senderName,
  senderEmail,
  recipientName,
  urgency,
  complexity,
  importance,
  skill,
  frequency,
  probability,
  interpretation,
}: SodsEmailParams): string {
  const safeTaskDescription = escapeHtml(taskDescription);
  const safeSenderName = escapeHtml(senderName);
  const safeSenderEmail = escapeHtml(senderEmail);
  const safeRecipientName = escapeHtml(recipientName);
  const safeUrgency = escapeHtml(urgency);
  const safeComplexity = escapeHtml(complexity);
  const safeImportance = escapeHtml(importance);
  const safeSkill = escapeHtml(skill);
  const safeFrequency = escapeHtml(frequency);
  const safeProbability = escapeHtml(probability);
  const safeInterpretation = escapeHtml(interpretation);
  const safeRiskLevel = riskLevel(probability);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <title>Sod's Law Calculator Result</title>
    </head>
    <body>
      <table role="presentation" width="100%">
        <tr>
          <td>
            <h1>Sod's Law Calculation Shared With You</h1>
            <p>Hi <strong>${safeRecipientName}</strong>,</p>
            <p><strong>${safeSenderName}</strong> (<a href="mailto:${safeSenderEmail}">${safeSenderEmail}</a>) has shared a calculation for this task:</p>
            <blockquote>${safeTaskDescription}</blockquote>

            <h2>The calculation was based on</h2>
            <table>
              <thead>
                <tr><th scope="col">Factor</th><th scope="col">Value</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Urgency (1-9)</th><td>${safeUrgency}</td></tr>
                <tr><th scope="row">Complexity (1-9)</th><td>${safeComplexity}</td></tr>
                <tr><th scope="row">Importance (1-9)</th><td>${safeImportance}</td></tr>
                <tr><th scope="row">Skill (1-9)</th><td>${safeSkill}</td></tr>
                <tr><th scope="row">Frequency (1-9)</th><td>${safeFrequency}</td></tr>
              </tbody>
            </table>

            <section data-risk="${safeRiskLevel}">
              <h2>Probability of Things Going Wrong</h2>
              <p><strong>${safeProbability}</strong></p>
              <p>${safeInterpretation}</p>
              <p>The higher the probability, the greater the chance that Sod's law will strike.</p>
              <p>Probabilities range from 0.12 to 8.6.</p>
            </section>

            <p><a href="https://murphys-laws.com/sods-calculator">Calculate Your Own</a></p>
            <p><a href="https://murphys-laws.com">Visit murphys-laws.com</a></p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function createSodsEmailPreviewHtml(
  params: SodsEmailParams,
  overrides: { renderHtml?: (params: SodsEmailParams) => string } = {},
): string {
  const renderHtml = typeof overrides.renderHtml === 'function'
    ? overrides.renderHtml
    : createSodsEmailHtml;

  const fullHtml = renderHtml(params);
  const match = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fullHtml;
}
