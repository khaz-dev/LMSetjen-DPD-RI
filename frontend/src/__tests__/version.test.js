import { describe, it, expect } from 'vitest';
import { APP_VERSION, APP_NAME, APP_VERSION_LABEL } from '../utils/version';

describe('version', () => {
  it('exports valid semantic version and labels', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(APP_NAME).toBe('LMSetjen DPD RI');
    expect(APP_VERSION_LABEL).toBe(`LMSetjen DPD RI v${APP_VERSION}`);
  });
});

