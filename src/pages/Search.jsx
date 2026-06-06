import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

export default function Search({ onSelectUser }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [trendingVideos, setTrendingVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load standard trending/explore videos on initial component mount
  useEffect(() => {
    const fetchExploreContent = async () => {
      try {
        const q = query(collection(db, "videos"), limit(9));
        const snap = await getDocs(q);
        const videosBatch = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTrendingVideos(videosBatch);
      } catch (err) {
        console.error("Error loading explore grid:", err);
      }
    };
    fetchExploreContent();
  }, []);

  // Real-time keyword filter query execution
  useEffect(() => {
    const executeUserSearch = async () => {
      if (!searchQuery.trim()) {
        setUsersList([]);
        return;
      }
      setLoading(true);

      try {
        const input = searchQuery.trim().toLowerCase();
        // Look up records where username matches or starts with the input string
        const q = query(
          collection(db, "users"),
          where("username", ">=", input),
          where("username", "<=", input + "\uf8ff"),
          limit(5)
        );

        const snap = await getDocs(q);
        const matchedUsers = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsersList(matchedUsers);
      } catch (err) {
        console.error("User search query failed:", err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce database calls slightly by waiting 300ms after user stops typing
    const delayDebounceFn = setTimeout(() => {
      executeUserSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      {/* Search Input Field */}
      <div className="max-w-md mx-auto sticky top-0 bg-black pt-2 pb-4 z-10">
        <div className="relative flex items-center">
          <span className="absolute left-4 text-gray-500 text-lg">🔍</span>
          <input
            type="text"
            placeholder="Search creators by username..."
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none text-white focus:border-red-500 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {/* User Search Results List */}
        {searchQuery.trim().length > 0 ? (
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-1">Accounts</h2>
            {loading ? (
              <p className="text-sm text-gray-500 animate-pulse">Searching profiles...</p>
            ) : usersList.length > 0 ? (
              usersList.map((account) => (
                <div
                  key={account.id}
                  onClick={() => onSelectUser?.(account.id)}
                  className="flex items-center gap-3 p-3 bg-gray-900/40 border border-gray-900 rounded-xl cursor-pointer hover:bg-gray-900 transition-colors"
                >
                  {account.photoURL ? (
                    <img src={account.photoURL} alt="User Avatar" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center font-bold text-sm">
                      {account.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold">@{account.username}</p>
                    <p className="text-xs text-gray-400">{account.followers?.length || 0} followers</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No accounts found matching "{searchQuery}"</p>
            )}
          </div>
        ) : (
          /* Default Discover Grid View */
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
              <span>🔥</span> Trending Content
            </h2>
            {trendingVideos.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
                {trendingVideos.map((video) => (
                  <div 
                    key={video.id} 
                    className="aspect-[9/16] bg-gray-900 relative group overflow-hidden cursor-pointer rounded-lg"
                  >
                    <video 
                      src={video.url} 
                      className="w-full h-full object-cover pointer-events-none" 
                      muted 
                      playsInline
                    />
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-white drop-shadow font-semibold truncate bg-black/20 px-1 rounded">
                      @{video.username || "creator"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600 text-sm mt-12">No public posts available to show.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}