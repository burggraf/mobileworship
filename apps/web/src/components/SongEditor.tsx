import type { SongContent, SongSection, SectionType } from '@mobileworship/shared';

interface SongEditorProps {
  content: SongContent;
  onChange: (content: SongContent) => void;
  readOnly?: boolean;
}

const SECTION_TYPES: SectionType[] = [
  'verse',
  'chorus',
  'bridge',
  'pre-chorus',
  'tag',
  'intro',
  'outro',
];

export function SongEditor({ content, onChange, readOnly = false }: SongEditorProps) {
  const handleSectionChange = (index: number, updates: Partial<SongSection>) => {
    const newSections = [...content.sections];
    newSections[index] = { ...newSections[index], ...updates };
    onChange({ sections: newSections });
  };

  const handleLinesChange = (index: number, linesText: string) => {
    const lines = linesText.split('\n');
    handleSectionChange(index, { lines });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === content.sections.length - 1)
    ) {
      return;
    }

    const newSections = [...content.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [
      newSections[targetIndex],
      newSections[index],
    ];
    onChange({ sections: newSections });
  };

  const deleteSection = (index: number) => {
    const newSections = content.sections.filter((_, i) => i !== index);
    onChange({ sections: newSections });
  };

  const addSection = () => {
    const newSections = [
      ...content.sections,
      {
        type: 'verse' as SectionType,
        label: `Verse ${content.sections.filter((s) => s.type === 'verse').length + 1}`,
        lines: [],
      },
    ];
    onChange({ sections: newSections });
  };

  return (
    <div className="space-y-4">
      {content.sections.map((section, index) => (
        <div
          key={`${section.type}-${section.label}-${index}`}
          className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
        >
          <div className="flex items-start gap-3 mb-3">
            {/* Section Type Dropdown */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={section.type}
                onChange={(e) =>
                  handleSectionChange(index, { type: e.target.value as SectionType })
                }
                disabled={readOnly}
                className="px-2 py-1 text-sm border dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {SECTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Label Input */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Label</label>
              <input
                type="text"
                value={section.label}
                onChange={(e) => handleSectionChange(index, { label: e.target.value })}
                disabled={readOnly}
                className="w-full px-2 py-1 text-sm border dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Section label"
              />
            </div>

            {/* Action Buttons */}
            {!readOnly && (
              <div className="flex-shrink-0 flex gap-1 mt-5">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                  aria-label="Move up"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === content.sections.length - 1}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                  aria-label="Move down"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSection(index)}
                  className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  title="Delete section"
                  aria-label="Delete section"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Lines Textarea */}
          <div>
            <label className="block text-xs font-medium mb-1">Lines</label>
            <textarea
              value={section.lines.join('\n')}
              onChange={(e) => handleLinesChange(index, e.target.value)}
              disabled={readOnly}
              rows={Math.max(3, section.lines.length + 1)}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              placeholder="Enter lyrics lines (one per line)"
            />
          </div>
        </div>
      ))}

      {/* Add Section Button */}
      {!readOnly && (
        <button
          type="button"
          onClick={addSection}
          className="w-full py-3 border-2 border-dashed dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition"
        >
          + Add Section
        </button>
      )}
    </div>
  );
}
