/**
 * JSON schema for the weekly feedback report, used with Anthropic structured
 * outputs so the script never has to recover JSON from prose.
 *
 * Anthropic drops array-length constraints, so "exactly 3" lives in the
 * description and the caller still slices the arrays.
 */

const stringArray = (description) => ({
  type: 'array',
  description,
  items: { type: 'string' },
})

export const WEEKLY_FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    combinedSummary: {
      type: 'string',
      description: '2 to 4 sentences, the headline read on the week.',
    },
    healthAnalysis: { type: 'string', description: 'One short paragraph.' },
    claudeWorkAnalysis: { type: 'string', description: 'One short paragraph.' },
    iszeAnalysis: {
      type: 'string',
      description: 'One short paragraph on professional/ISZE feedback.',
    },
    wins: stringArray('Exactly 3 items.'),
    improvements: stringArray('Exactly 3 items about prompting and project execution.'),
    healthActions: stringArray('Exactly 3 concrete health actions for next week.'),
    iszeActions: stringArray(
      'Exactly 3 concrete ISZE close-the-loop actions, or an empty array when no ISZE data is available.',
    ),
  },
  required: [
    'combinedSummary',
    'healthAnalysis',
    'claudeWorkAnalysis',
    'iszeAnalysis',
    'wins',
    'improvements',
    'healthActions',
    'iszeActions',
  ],
  additionalProperties: false,
}
