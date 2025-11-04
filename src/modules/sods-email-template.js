const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";

/**
 * Escapes HTML special characters to prevent XSS attacks in email templates
 * @param {any} value - Value to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
export function escapeHtml(value) {
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

export function createSodsEmailSubject(probability, senderName) {
  // Escape values for email subject (prevents header injection)
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
  interpretation
}) {
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
  interpretation
}) {
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

  // Determine background color based on probability score
  const numProbability = parseFloat(probability);
  let resultBgColor = '#d4edda'; // green (safe)
  let resultTextColor = '#155724';

  if (numProbability >= 8) {
    resultBgColor = '#1a1a1a'; // dark (catastrophe)
    resultTextColor = '#ffffff';
  } else if (numProbability >= 6) {
    resultBgColor = '#f8d7da'; // red (danger)
    resultTextColor = '#721c24';
  } else if (numProbability >= 4) {
    resultBgColor = '#fff3cd'; // orange (worrying)
    resultTextColor = '#856404';
  } else if (numProbability >= 2) {
    resultBgColor = '#fff3cd'; // yellow (risky)
    resultTextColor = '#856404';
  }

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
                  <span style="display:block; font-size:26px; font-weight:600;">Sod's Law Calculation Shared With You</span>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 24px 8px; font-family:${FONT_STACK}; color:#333333;">
                  <p style="margin:0; font-size:16px; line-height:1.5;">Hi <strong>${safeRecipientName}</strong>,</p>
                  <p style="margin:12px 0 0; font-size:15px; line-height:1.5; color:#66717f;"><strong>${safeSenderName}</strong> <a href="mailto:${safeSenderEmail}" style="color:#4b56a3; text-decoration:none; font-weight:500;">${safeSenderEmail}</a> has shared with you a calculation for this task:</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 8px; font-family:${FONT_STACK}; color:#333333;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate; border-left:4px solid #667eea; background-color:#f8f9fa; border-radius:8px;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <p style="margin:0; font-size:16px; line-height:1.5; font-style:italic;">"${safeTaskDescription}"</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 8px; font-family:${FONT_STACK}; color:#333333;">
                  <span style="display:block; font-size:16px; font-weight:600; color:#4b56a3;">The calculation was based on:</span>
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
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Urgency (1-9)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeUrgency}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Complexity (1-9)</span>
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
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Importance (1-9)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeImportance}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" style="padding:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #e1e5ee;">
                          <tr>
                            <td style="padding:12px 16px; font-family:${FONT_STACK};">
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Skill (1-9)</span>
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
                              <span style="display:block; font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:#66717f;">Frequency (1-9)</span>
                              <span style="display:block; font-size:22px; font-weight:600; color:#333333; margin-top:4px;">${safeFrequency}</span>
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${resultBgColor}; border-radius:12px; border:1px solid #e1e5ee;">
                    <tr>
                      <td align="center" style="padding:28px 24px; font-family:${FONT_STACK}; color:${resultTextColor};">
                        <span style="display:block; font-size:18px; font-weight:600; margin-bottom:8px;">Probability of Things Going Wrong</span>
                        <span style="display:block; font-size:46px; font-weight:700; margin:16px 0 12px;">${safeProbability}</span>
                        <span style="display:block; font-size:16px; line-height:1.6; padding:16px 18px;">${safeInterpretation}</span>
                        <span style="display:block; font-size:13px; margin-top:20px; opacity:0.9;">The higher the probability, the greater the chance that Sod's law will strike.</span>
                        <span style="display:block; font-size:13px; margin-top:8px; opacity:0.9;">Probabilities range from 0.12 to 8.6.</span>
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
                        <a href="https://murphys-laws.com/sods-calculator" style="display:inline-block; padding:12px 28px; font-family:${FONT_STACK}; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none;">Calculate Your Own</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:16px 24px 28px; font-family:${FONT_STACK}; font-size:13px; color:#7b8292; border-top:1px solid #e1e5ee;">
                  <a href="https://murphys-laws.com" style="display:inline-block; color:#667eea; text-decoration:none; font-weight:600;">Visit murphys-laws.com</a>
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
