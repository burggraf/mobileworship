interface SlidePreviewOverlayProps {
  backgroundUrl: string;
  className?: string;
}

const SAMPLE_LYRICS = ['Amazing Grace', 'How Sweet the Sound'];

export function SlidePreviewOverlay({ backgroundUrl, className = '' }: SlidePreviewOverlayProps) {
  return (
    <div
      className={`relative aspect-video rounded-lg overflow-hidden ${className}`}
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Lyrics text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-8">
        {SAMPLE_LYRICS.map((line, index) => (
          <p
            key={index}
            className="text-2xl md:text-4xl font-bold drop-shadow-lg"
            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
