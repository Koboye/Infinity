import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import VideoCard from "../components/VideoCard";

export default function Home() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const q = query(
          collection(db, "videos"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setVideos(data);
      } catch (err) {
        console.log("Home load error:", err);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div className="bg-black min-h-screen text-white">
      {videos.length === 0 ? (
        <p className="text-center mt-10 text-gray-500">
          No videos yet
        </p>
      ) : (
        videos.map((video, i) => (
          <div key={video.id} className="h-screen">
            <VideoCard video={video} isActive={true} />
          </div>
        ))
      )}
    </div>
  );
}