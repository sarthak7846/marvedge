interface TextColorToolbarProps {
  textColor: string;
  setTextColor: (color: string) => void;
  textFont: string;
  setTextFont: (font: string) => void;
}

export default function TextColorToolbar({
  textColor,
  setTextColor,
  textFont,
  setTextFont,
}: TextColorToolbarProps) {
  return (
    <div className="flex gap-3 items-center mb-6 sm:mb-0 mx-4 sm:mx-8">
      <label className="text-sm">Text Color:</label>
      <input
        type="color"
        value={textColor}
        onChange={(e) => setTextColor(e.target.value)}
        className="border rounded"
      />
      <label className="text-sm ml-4">Font:</label>
      <select
        value={textFont}
        onChange={(e) => setTextFont(e.target.value)}
        className="border p-1 rounded"
      >
        <option value="16px sans-serif">Default</option>
        <option value="20px serif">Serif</option>
        <option value="20px monospace">Monospace</option>
        <option value="18px Arial">Arial</option>
        <option value="18px Georgia">Georgia</option>
      </select>
    </div>
  );
}
