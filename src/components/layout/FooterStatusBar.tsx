type FooterStatusBarProps = {
  sampleRate: number;
  latencyHint: string;
};

function FooterStatusBar({ sampleRate, latencyHint }: FooterStatusBarProps) {
  return (
    <footer className="footer-status">
      <span>Stage 2 Guitar Input</span>
      <span>{sampleRate ? `${sampleRate.toLocaleString()} Hz` : 'AudioContext idle'}</span>
      <span>Latency: {latencyHint}</span>
    </footer>
  );
}

export default FooterStatusBar;
