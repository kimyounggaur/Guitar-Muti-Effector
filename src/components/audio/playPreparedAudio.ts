/** Only play an element after it is routed, and cancel if PANIC replaced it. */
export async function playPreparedAudio(
  audio: HTMLAudioElement,
  current: () => HTMLAudioElement | null,
  prepare: (audio: HTMLAudioElement) => Promise<void>,
): Promise<boolean> {
  await prepare(audio);
  if (current() !== audio) return false;
  await audio.play();
  if (current() !== audio) {
    audio.pause();
    return false;
  }
  return true;
}
