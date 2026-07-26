import { describe, expect, it } from 'vitest';
import {
  scanCssTokens,
  scanDesignSystemWiring,
  scanInlineCss,
  scanNativePresentation,
  scanPackageLock,
  scanPackageJson,
  scanReactSource,
  scanUiEmoji,
} from './design-conformance.ts';

describe('design conformance scanners', () => {
  it('rejects every inline CSS mechanism', () => {
    const html =
      '<style>.x{color:red}</style><p style="color:red"><link rel="stylesheet" href="data:text/css,.x{}">';
    const script =
      "node.style.display = 'none'; document.createElement('style'); new CSSStyleSheet();";

    expect(scanInlineCss('web/index.html', html)).toHaveLength(3);
    expect(scanInlineCss('web/src/view.ts', script)).toHaveLength(3);
  });

  it('accepts class and hidden based DOM state', () => {
    const script =
      "node.hidden = true; node.classList.add('is-loading'); node.toggleAttribute('hidden');";

    expect(scanInlineCss('web/src/view.ts', script)).toEqual([]);
  });

  it('rejects React packages, source imports, and browser Babel', () => {
    const packageJson = JSON.stringify({
      dependencies: { react: 'latest', '@babel/standalone': 'latest' },
    });

    expect(scanPackageJson('package.json', packageJson)).toHaveLength(2);
    expect(
      scanReactSource(
        'web/src/app.ts',
        "import React from 'react'; Babel.transform(source); import helper from '@babel/runtime/helpers/foo';",
      ),
    ).toHaveLength(3);
    expect(
      scanPackageLock(
        'package-lock.json',
        JSON.stringify({
          packages: {
            'node_modules/react': {},
            'node_modules/@babel/runtime': {},
            'node_modules/allowed': {},
          },
        }),
      ),
    ).toHaveLength(2);
  });

  it('rejects raw web colors, typography, radii, and component sizes', () => {
    const css = `.bad {
  color: #fff;
  font-size: 16px;
  border-radius: 8px;
  min-height: 44px;
}`;

    expect(scanCssTokens('web/styles/bad.css', css).map((v) => v.rule)).toEqual([
      'untokenized-css',
      'untokenized-css',
      'untokenized-css',
      'untokenized-component-size',
    ]);
  });

  it('accepts token-backed web declarations', () => {
    const css = `.good {
  color: var(--fg);
  font-size: var(--text-base);
  border-radius: var(--rounded-lg);
  min-height: var(--component-control-min-size);
}`;

    expect(scanCssTokens('web/styles/good.css', css)).toEqual([]);
  });

  it('rejects raw SwiftUI and Compose presentation values', () => {
    expect(
      scanNativePresentation(
        'ios/View.swift',
        'RoundedRectangle(cornerRadius: 8); view.font(.system(size: 20))',
      ),
    ).toHaveLength(2);
    expect(
      scanNativePresentation(
        'android/View.kt',
        'RoundedCornerShape(8.dp); Modifier.size(32.dp)',
      ),
    ).toHaveLength(2);
  });

  it('rejects UI emoji', () => {
    expect(scanUiEmoji('ios/View.swift', 'Text("🔴")')).toHaveLength(1);
    expect(scanUiEmoji('ios/View.swift', 'Image(systemName: "xmark")')).toEqual([]);
  });

  it('keeps iOS generation wired to the root design-system exporter', () => {
    const rootPackage = JSON.stringify({
      scripts: {
        'design:export:ios':
          'tsx shared/design-tokens/export-ios-tokens.ts',
      },
    });
    const projectGenerator =
      'npm --prefix .. run design:export:ios\nxcodegen generate\n';
    const iosCi = `on:
  push:
    paths:
      - 'ios/**'
      - 'shared/DESIGN.md'
      - 'shared/design-tokens/**'
      - 'web/DESIGN.md'
      - 'web/styles/partials/variables.css'
      - '.github/workflows/ios-ci.yml'
  pull_request:
    paths:
      - 'ios/**'
      - 'shared/DESIGN.md'
      - 'shared/design-tokens/**'
      - 'web/DESIGN.md'
      - 'web/styles/partials/variables.css'
      - '.github/workflows/ios-ci.yml'
jobs:
  build:
    steps:
      - run: npm run design:conformance
      - run: npm run design:export:ios
`;

    expect(scanDesignSystemWiring('package.json', rootPackage)).toEqual([]);
    expect(
      scanDesignSystemWiring(
        'ios/generate-xcode-project.sh',
        projectGenerator,
      ),
    ).toEqual([]);
    expect(
      scanDesignSystemWiring('.github/workflows/ios-ci.yml', iosCi),
    ).toEqual([]);
  });

  it('rejects stale iOS exporter and CI wiring', () => {
    const staleGenerator = 'npm --prefix ../web run design:export:ios\n';
    const staleCi = `on:
  push:
    paths:
      - 'ios/**'
  pull_request:
    paths:
      - 'ios/**'
jobs:
  build: {}
`;

    expect(
      scanDesignSystemWiring(
        'ios/generate-xcode-project.sh',
        staleGenerator,
      ),
    ).toHaveLength(1);
    expect(
      scanDesignSystemWiring('.github/workflows/ios-ci.yml', staleCi),
    ).toHaveLength(12);
  });

  it('keeps Android and web CI wired to design changes', () => {
    const androidCi = `on:
  push:
    paths:
      - 'android/**'
      - 'shared/DESIGN.md'
      - 'shared/design-tokens/**'
      - 'web/DESIGN.md'
      - 'web/styles/partials/variables.css'
      - '.github/workflows/android-ci.yml'
  pull_request:
    paths:
      - 'android/**'
      - 'shared/DESIGN.md'
      - 'shared/design-tokens/**'
      - 'web/DESIGN.md'
      - 'web/styles/partials/variables.css'
      - '.github/workflows/android-ci.yml'
jobs:
  build:
    steps:
      - run: npm run design:conformance
      - run: npm run design:export:android
      - run: ./gradlew connectedDebugAndroidTest
`;
    const webCi = `on:
  push:
    paths:
      - 'web/**'
      - 'shared/DESIGN.md'
      - 'shared/design-tokens/**'
      - '.github/workflows/web-ci.yml'
  pull_request:
    paths:
      - 'web/**'
      - 'shared/DESIGN.md'
      - 'shared/design-tokens/**'
      - '.github/workflows/web-ci.yml'
jobs:
  build:
    steps:
      - run: npm run design:check
      - run: npm run design:conformance
`;

    expect(
      scanDesignSystemWiring('.github/workflows/android-ci.yml', androidCi),
    ).toEqual([]);
    expect(
      scanDesignSystemWiring('.github/workflows/web-ci.yml', webCi),
    ).toEqual([]);
  });
});
