import { ConnectionStatus } from '../../audio/types';
import DeviceSelector from './DeviceSelector';

type ConnectGuitarPanelProps = {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  status: ConnectionStatus;
  onConnect: () => void;
  onDeviceChange: (deviceId: string) => void;
  onPanic: () => void;
};

function ConnectGuitarPanel({
  devices,
  selectedDeviceId,
  status,
  onConnect,
  onDeviceChange,
  onPanic,
}: ConnectGuitarPanelProps) {
  return (
    <div className="connect-panel tool-panel">
      <div className="panel-heading">
        <span>Input</span>
        <strong>Guitar connection</strong>
      </div>
      <DeviceSelector devices={devices} selectedDeviceId={selectedDeviceId} onChange={onDeviceChange} />
      <div className="button-row">
        <button className="primary-action" type="button" onClick={onConnect} disabled={status === 'connecting'}>
          {status === 'connected' ? 'Reconnect Guitar' : 'Connect Guitar'}
        </button>
        <button className="danger-action" type="button" onClick={onPanic}>
          Panic
        </button>
      </div>
    </div>
  );
}

export default ConnectGuitarPanel;
