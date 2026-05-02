import { useRef, useState } from 'react';
import { usePresetStore } from '../../store/presetStore';

function ImportExportPreset() {
  const exportPresets = usePresetStore((state) => state.exportPresets);
  const importPresets = usePresetStore((state) => state.importPresets);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [status, setStatus] = useState('');

  const handleExport = () => {
    const json = exportPresets();
    setJsonText(json);
    setStatus('Preset JSON ready.');
  };

  const handleCopy = async () => {
    const json = jsonText || exportPresets();
    setJsonText(json);

    try {
      await navigator.clipboard.writeText(json);
      setStatus('Copied JSON to clipboard.');
    } catch {
      setStatus('JSON is ready to copy.');
    }
  };

  const handleImport = (json: string) => {
    try {
      const result = importPresets(json);
      setStatus(`Imported ${result.imported} preset${result.imported === 1 ? '' : 's'}.`);
    } catch {
      setStatus('Import failed. Check the JSON format.');
    }
  };

  const handleFileImport = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const text = await file.text();
    setJsonText(text);
    handleImport(text);
  };

  return (
    <div className="preset-import-export">
      <div className="preset-io-actions">
        <button type="button" onClick={handleExport}>
          JSON Export
        </button>
        <button type="button" onClick={handleCopy}>
          Copy JSON
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          JSON Import
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void handleFileImport(event.target.files?.[0])}
      />

      <textarea
        value={jsonText}
        onChange={(event) => setJsonText(event.target.value)}
        placeholder="Paste preset JSON here"
        aria-label="Preset JSON"
      />

      <div className="preset-io-footer">
        <button type="button" onClick={() => handleImport(jsonText)} disabled={!jsonText.trim()}>
          Import Pasted JSON
        </button>
        <span>{status || 'localStorage key: web-guitar-pedalboard-presets'}</span>
      </div>
    </div>
  );
}

export default ImportExportPreset;
