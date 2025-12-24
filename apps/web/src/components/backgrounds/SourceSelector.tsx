import type { BackgroundSource } from '../../types/backgrounds';

interface SourceSelectorProps {
  selected: BackgroundSource;
  onChange: (source: BackgroundSource) => void;
}

const sources: { id: BackgroundSource; name: string }[] = [
  { id: 'pexels', name: 'Pexels' },
  { id: 'unsplash', name: 'Unsplash' },
  { id: 'pixabay', name: 'Pixabay' },
];

export function SourceSelector({ selected, onChange }: SourceSelectorProps) {
  return (
    <div className="flex gap-2">
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => onChange(source.id)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium transition-colors
            ${selected === source.id
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
        >
          {source.name}
        </button>
      ))}
    </div>
  );
}
