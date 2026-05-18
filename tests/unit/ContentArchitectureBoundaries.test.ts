import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../..');

function readProjectFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('content architecture boundaries', () => {
  it('keeps subtitle display independent from source acquisition and translation scheduling', () => {
    const displaySession = readProjectFile(
      'src/interface/content/subtitle-display-session.ts',
    );

    expect(displaySession).not.toMatch(/source-subtitles/);
    expect(displaySession).not.toMatch(/caption-capture-buffer/);
    expect(displaySession).not.toMatch(/ai-polish-scheduler/);
    expect(displaySession).not.toMatch(/messaging/);
  });

  it('keeps source subtitle acquisition independent from rendering and AI polish', () => {
    const sourceSubtitles = readProjectFile(
      'src/interface/content/source-subtitles.ts',
    );

    expect(sourceSubtitles).not.toMatch(/subtitle-overlay/);
    expect(sourceSubtitles).not.toMatch(/side-panel/);
    expect(sourceSubtitles).not.toMatch(/subtitle-display-session/);
    expect(sourceSubtitles).not.toMatch(/ai-polish-scheduler/);
  });
});
