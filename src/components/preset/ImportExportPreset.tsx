import { useRef, useState } from 'react';
import { usePresetStore } from '../../store/presetStore';
import { t } from '../../i18n/ko';
import { showToast } from '../common/Toast';

type ImportExportPresetProps = {
  compact?: boolean;
};

function ImportExportPreset({ compact = false }: ImportExportPresetProps) {
  const exportPresets = usePresetStore((state) => state.exportPresets);
  const importPresets = usePresetStore((state) => state.importPresets);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [status, setStatus] = useState('');

  const handleExport = () => {
    const json = exportPresets();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'guitar-user-presets.json';
    link.click();
    URL.revokeObjectURL(url);
    setStatus(t('toast.exported'));
    showToast('toast.exported');
  };

  const handleCopy = async () => {
    const json = jsonText || exportPresets();
    setJsonText(json);

    try {
      await navigator.clipboard.writeText(json);
      setStatus(t('panel.preset.copied'));
    } catch {
      setStatus(t('panel.preset.copyFailed'));
    }
  };

  const handleImport = (json: string) => {
    try {
      const result = importPresets(json);
      setStatus(t('panel.preset.imported', { count: result.imported }));
    } catch {
      setStatus(t('panel.preset.importFailed'));
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
    <div className={`preset-import-export ${compact ? 'is-compact' : ''}`}>
      <div className="preset-io-actions">
        <button type="button" onClick={handleExport}>
          
          {t('panel.preset.exportFile')}
        </button>
        <button type="button" onClick={handleCopy}>
          
          {t('panel.preset.duplicate')}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          
          {t('panel.preset.importFile')}
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
        placeholder={t('panel.preset.json')}
        aria-label={t('panel.preset.json')}
      />

      <div className="preset-io-footer">
        <button type="button" onClick={() => handleImport(jsonText)} disabled={!jsonText.trim()}>
          
          {t('panel.preset.importJson')}
        </button>
        <span>{status || t('panel.preset.ioHint')}</span>
      </div>
    </div>
  );
}

export default ImportExportPreset;
