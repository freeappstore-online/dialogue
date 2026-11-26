export function PinyinToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return <label className="toggle"><input type="checkbox" checked={enabled} onChange={e => onChange(e.target.checked)} /> Show pinyin</label>;
}
