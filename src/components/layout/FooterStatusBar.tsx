type FooterStatusBarProps = {
  sampleRate: number;
  connected: boolean;
};

function FooterStatusBar({ sampleRate, connected }: FooterStatusBarProps) {
  return (
    <footer className="footer-status">
      <span>{connected ? 'Audio engine active' : 'Audio engine idle'}</span>
      <span>{Math.round(sampleRate).toLocaleString()} Hz</span>
      <span>AudioWorklet DSP</span>
    </footer>
  );
}

export default FooterStatusBar;
