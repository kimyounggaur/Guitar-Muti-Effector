import SelectControl from '../controls/SelectControl';

type DeviceSelectorProps = {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onChange: (deviceId: string) => void;
};

const getDeviceLabel = (device: MediaDeviceInfo, index: number) => device.label || `Audio input ${index + 1}`;

function DeviceSelector({ devices, selectedDeviceId, onChange }: DeviceSelectorProps) {
  return (
    <SelectControl
      id="input-device"
      label="Input device"
      value={selectedDeviceId}
      onChange={onChange}
      options={[
        { value: '', label: 'Default system input' },
        ...devices.map((device, index) => ({
          value: device.deviceId,
          label: getDeviceLabel(device, index),
        })),
      ]}
    />
  );
}

export default DeviceSelector;
