import { resolve } from 'node:path';

export const fakeMicrophone = (fixture: string) => ({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${resolve('tests/fixtures', fixture)}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
