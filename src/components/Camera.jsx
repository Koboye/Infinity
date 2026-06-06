import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, orderBy, query, doc, getDoc } from "firebase/firestore";
import VideoCard from "./VideoCard";

export default function VideoFeed() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, async (snapshot) => {
      const videosData = await Promise.all(
        snapshot.docs.map(async (d) => {
          const video = { id: d.id, ...d.data() };
          try {
            const userSnap = await getDoc(doc(db, "users", video.userId));
            if (userSnap.exists()) {
              video.username = userSnap.data().username;
            }
          } catch (e) {}
          return video;
        })
      );
      setVideos(videosData);
    });
    return unsub;
  }, []);

  return (
    <div className="flex flex-col items-center mt-6">
      {videos.length === 0 ? (
        <p className="text-gray-500 mt-10">No videos yet. Be the first to upload!</p>
      ) : (
        videos.map((video) => <VideoCard key={video.id} video={video} />)
      )}
    </div>
  );
}