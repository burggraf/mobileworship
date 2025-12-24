import { useState, useRef } from 'react';
import { useMedia, useAuth } from '@mobileworship/shared';

export function MediaPage() {
  const { media, isLoading, uploadMedia, deleteMedia, getPublicUrl } = useMedia();
  const { can } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      await uploadMedia.mutateAsync({ file, type });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  if (isLoading) {
    return <div className="text-gray-500">Loading media...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Media</h2>
        {can('media:write') && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Media'}
            </button>
          </>
        )}
      </div>

      {media.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No media yet. Upload backgrounds and videos to use in your services.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group"
            >
              {item.type === 'image' ? (
                <img
                  src={getPublicUrl(item.storage_path)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <video src={getPublicUrl(item.storage_path)} className="w-full h-full object-cover" />
              )}
              {can('media:write') && (
                <button
                  onClick={() => deleteMedia.mutate(item.id)}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition"
                >
                  Delete
                </button>
              )}
              <span className="absolute bottom-2 left-2 px-2 py-0.5 text-xs bg-black/50 text-white rounded">
                {item.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
