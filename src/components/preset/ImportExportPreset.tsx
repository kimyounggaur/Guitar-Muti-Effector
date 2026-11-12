import { useRef, useState } from 'react';
import { usePresetStore } from '../../store/presetStore';

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
    setStatus('사용자 프리셋 파일을 내려받았습니다.');
  };

  const handleCopy = async () => {
    const json = jsonText || exportPresets();
    setJsonText(json);

    try {
      await navigator.clipboard.writeText(json);
      setStatus('클립보드에 복사했습니다.');
    } catch {
      setStatus('복사할 수 없습니다. 텍스트를 직접 복사해 주세요.');
    }
  };

  const handleImport = (json: string) => {
    try {
      const result = importPresets(json);
      setStatus(`${result.imported}개 프리셋을 가져왔습니다.`);
    } catch {
      setStatus('가져오기에 실패했습니다. JSON 파일 형식을 확인해 주세요.');
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
          파일 내보내기
        </button>
        <button type="button" onClick={handleCopy}>
          복사
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          파일 가져오기
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
        placeholder="Preset JSON"
        aria-label="Preset JSON"
      />

      <div className="preset-io-footer">
        <button type="button" onClick={() => handleImport(jsonText)} disabled={!jsonText.trim()}>
          JSON 가져오기
        </button>
        <span>{status || '사용자 프리셋을 파일로 저장하거나 가져옵니다.'}</span>
      </div>
    </div>
  );
}

export default ImportExportPreset;
