type ImportExportPresetProps = {
  disabled?: boolean;
};

function ImportExportPreset({ disabled = true }: ImportExportPresetProps) {
  return (
    <div className="import-export-preset">
      <button type="button" disabled={disabled}>
        Import
      </button>
      <button type="button" disabled={disabled}>
        Export
      </button>
    </div>
  );
}

export default ImportExportPreset;
