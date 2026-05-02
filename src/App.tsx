import MasterSection from './components/audio/MasterSection';
import AppShell from './components/layout/AppShell';
import FooterStatusBar from './components/layout/FooterStatusBar';
import HeaderBar from './components/layout/HeaderBar';
import PedalBoard from './components/pedalboard/PedalBoard';

function App() {
  return (
    <AppShell
      header={<HeaderBar appName="Pedalboard Lab" connectionStatus="Not connected" presetName="Init Patch" />}
      footer={<FooterStatusBar />}
    >
      <PedalBoard />
      <MasterSection />
    </AppShell>
  );
}

export default App;
