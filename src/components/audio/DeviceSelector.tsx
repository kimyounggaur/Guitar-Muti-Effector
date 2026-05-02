type DeviceSelectorProps = {
  inputDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  disabled?: boolean;
  onChange: (deviceId: string) => void;
};

const getDeviceLabel = (device: MediaDeviceInfo, index: number) =>
  device.label || `Audio input ${index + 1}`;

function DeviceSelector({ inputDevices, selectedDeviceId, disabled = false, onChange }: DeviceSelectorProps) {
  return (
    <label className="device-selector" htmlFor="audio-input-device">
      <span>Input Device</span>
      <select
        id="audio-input-device"
        value={selectedDeviceId}
        disabled={disabled || inputDevices.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Default system input</option>
        {inputDevices.map((device, index) => (
          <option key={device.deviceId || index} value={device.deviceId}>
            {getDeviceLabel(device, index)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default DeviceSelector;
