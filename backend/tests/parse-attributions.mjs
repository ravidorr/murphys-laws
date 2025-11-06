#!/usr/bin/env node
import { parseAttributions } from '../scripts/build-sqlite.mjs';

const cases = [
  {
    label: 'Mailto simple',
    input: 'The alarm will never go off. Sent by [Brad Johnson](mailto:brad42681@yahoo.com).',
  },
  {
    label: 'Mailto with dotty domain',
    input: 'Sent by [Rene Chenier](mailto:scifihistdata@interactive.rogers.com).',
  },
  {
    label: 'With trailing note',
    input: 'Sent by [Name Here](mailto:name@example.com) — Austin, TX, age 42.',
  },
  {
    label: 'Plain text name with metadata',
    input: 'Sent by Jane Doe, Austin TX.',
  },
  {
    label: 'Plain text only',
    input: 'Sent by Someone.',
  },
];

for (const c of cases) {
  const res = parseAttributions(c.input);
  console.log('---', c.label, '---');
  console.log(JSON.stringify(res, null, 2));
}

