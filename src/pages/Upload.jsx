export default function UploadUI() {
  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button className="text-2xl">✕</button>
        <span className="font-bold text-lg">Post</span>
        <button className="text-2xl">✅</button>
      </div>

      {/* Video Placeholder */}
      <div className="w-full h-64 bg-gray-900 rounded-xl flex items-center justify-center mb-8 border border-gray-800">
        <span className="text-gray-500">Video Preview</span>
      </div>

      {/* Settings Menu */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            <span>📝</span>
            <span className="text-gray-300">Add caption</span>
          </div>
          <span className="text-gray-500 text-sm">Write something... ›</span>
        </div>

        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            <span>🎵</span>
            <span className="text-gray-300">Add sound</span>
          </div>
          <span className="text-gray-500 text-sm">Pick a song ›</span>
        </div>

        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            <span>🌍</span>
            <span className="text-gray-300">Audience</span>
          </div>
          <span className="text-gray-500 text-sm">Everyone ›</span>
        </div>

        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            <span>🎨</span>
            <span className="text-gray-300">Filters</span>
          </div>
          <span className="text-gray-500 text-sm">None ›</span>
        </div>
      </div>

      {/* Post Button */}
      <button className="w-full mt-10 bg-red-600 py-3 rounded-lg font-bold text-white hover:bg-red-700 transition">
        🚀 Post Now
      </button>
    </div>
  );
}