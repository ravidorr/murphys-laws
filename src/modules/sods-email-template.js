const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";

function escapeHtml(value) {
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

export function createSodsEmailSubject(probability) {
  return `Your Sod's Law Calculation Result - ${probability}`;
}

export function createSodsEmailText({
  taskDescription,
  urgency,
  complexity,
  importance,
  skill,
  frequency,
  probability,
  interpretation
}) {
  return `Sod's Law Calculator Result

Task Description: ${taskDescription}

Input Values:
- Urgency (U): ${urgency}
- Complexity (C): ${complexity}
- Importance (I): ${importance}
- Skill (S): ${skill}
- Frequency (F): ${frequency}
- Aggravation Factor (A): 0.7

Probability of things going wrong (P): ${probability}

Interpretation: ${interpretation}

The higher the probability (P), the greater the chance that Sod's law will strike.

Calculate your own at: https://murphys-laws.com/sods-calculator
`;
}

export function createSodsEmailHtml({
  taskDescription,
  urgency,
  complexity,
  importance,
  skill,
  frequency,
  probability,
  interpretation
}) {
  const safeTaskDescription = escapeHtml(taskDescription);
  const safeUrgency = escapeHtml(urgency);
  const safeComplexity = escapeHtml(complexity);
  const safeImportance = escapeHtml(importance);
  const safeSkill = escapeHtml(skill);
  const safeFrequency = escapeHtml(frequency);
  const safeProbability = escapeHtml(probability);
  const safeInterpretation = escapeHtml(interpretation);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>Sod's Law Calculator Result</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f4f4f4;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f4;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
              <tr>
                <td align="center" style="background-color:#667eea; background-image:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:32px 24px; color:#ffffff; font-family:${FONT_STACK};">
                  <span style="display:block; font-size:26px; font-weight:600;">Sod's Law Calculator Result</span>
                  <span style="display:block; font-size:16px; margin-top:6px;">Your personalised probability report</span>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 24px 8px; font-family:${FONT_STACK}; color:#333333;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate; border-left:4px solid #667eea; background-color:#f8f9fa; border-radius:8px;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <span style="display:block; font-size:18px; font-weight:600; color:#4b56a3;">Your Task</span>
                        <p style="margin:12px 0 0; font-size:16px; line-height:1.5;">${safeTaskDescription}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 8px; font-family:${FONT_STACK}; color:#333333;">
                  <span style="display:block; font-size:16px; font-weight:600; color:#4b56a3;">Input Values</span>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 8px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
                    <tr>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Urgency (U)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeUrgency}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Complexity (C)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeComplexity}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Importance (I)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeImportance}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Skill (S)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeSkill}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Frequency (F)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeFrequency}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Aggravation (A)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">0.7</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px 8px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; border:1px solid #e1e5ee;">
                    <tr>
                      <td align="center" style="padding:28px 24px; font-family:${FONT_STACK}; color:#333333;">
                        <span style="display:block; font-size:18px; font-weight:600; color:#4b56a3;">Probability of Things Going Wrong</span>
                        <span style="display:block; font-size:46px; font-weight:700; color:#667eea; margin:16px 0 12px;">${safeProbability}</span>
                        <span style="display:block; font-size:16px; line-height:1.6; color:#4a4f58; background-color:#f4f5fb; border-radius:8px; padding:16px 18px;">${safeInterpretation}</span>
                        <span style="display:block; font-size:13px; color:#6f7480; margin-top:20px;">The higher the probability (P), the greater the chance that Sod's law will strike.</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:8px 24px 24px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                    <tr>
                      <td align="center" bgcolor="#667eea" style="border-radius:6px;">
                        <a href="https://murphys-laws.com/sods-calculator" style="display:inline-block; padding:12px 28px; font-family:${FONT_STACK}; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none;">Try Another Calculation</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:16px 24px 28px; font-family:${FONT_STACK}; font-size:13px; color:#7b8292; border-top:1px solid #e1e5ee;">
                  <span style="display:block;">Powered by Murphy's Laws – where everything that can go wrong, will go wrong.</span>
                  <a href="https://murphys-laws.com" style="display:inline-block; margin-top:8px; color:#667eea; text-decoration:none; font-weight:600;">Visit murphys-laws.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function createSodsEmailPreviewHtml(params, overrides = {}) {
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
