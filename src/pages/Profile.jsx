import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

export default function Profile({
  id,
  onNavigateLogin,
  onNavigateRegister,
}) {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  const [showHelp, setShowHelp] = useState(false);
  const [showEditPic, setShowEditPic] = useState(false);
  const [newPicUrl, setNewPicUrl] = useState("");

  const targetId = id || user?.uid;

  useEffect(() => {
    if (!targetId) return;

    const fetchProfileData = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", targetId));

        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(data);

          setIsFollowing(
            data.followers?.includes(user?.uid) || false
          );
          setFollowerCount(data.followers?.length || 0);
        }

        const q = query(
          collection(db, "videos"),
          where("userId", "==", targetId)
        );

        const snap = await getDocs(q);

        setVideos(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (err) {
        console.error(err);
      }
    };

    fetchProfileData();
  }, [targetId, user]);

  const toggleFollowSystem = async () => {
    if (!user) return alert("Login required");

    const prev = isFollowing;

    setIsFollowing(!prev);
    setFollowerCount((p) => (prev ? p - 1 : p + 1));

    try {
      const targetRef = doc(db, "users", targetId);
      const userRef = doc(db, "users", user.uid);

      await updateDoc(targetRef, {
        followers: prev
          ? arrayRemove(user.uid)
          : arrayUnion(user.uid),
      });

      await updateDoc(userRef, {
        following: prev
          ? arrayRemove(targetId)
          : arrayUnion(targetId),
      });
    } catch (err) {
      setIsFollowing(prev);
      setFollowerCount((p) => (prev ? p + 1 : p - 1));
    }
  };

  const handleUpdateProfilePic = async () => {
    if (!newPicUrl.trim()) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: newPicUrl,
      });

      setProfile((prev) => ({
        ...prev,
        photoURL: newPicUrl,
      }));

      setShowEditPic(false);
      setNewPicUrl("");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    if (onNavigateLogin) onNavigateLogin();
  };

  const isOwnProfile = user?.uid === targetId;

  if (!targetId) {
    return (
      <div className="bg-black min-h-screen text-white flex items-center justify-center">
        <p>Please login</p>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white p-6 pb-24">

      <div className="flex justify-between mb-6">
        <button onClick={() => setShowHelp(true)}>
          Help
        </button>

        {isOwnProfile && (
          <button onClick={handleLogout} className="text-red-500">
            Logout
          </button>
        )}
      </div>

      {profile && (
        <>
          <div className="flex flex-col items-center">

            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center">
                {profile.username?.[0]}
              </div>
            )}

            {isOwnProfile && (
              <button onClick={() => setShowEditPic(true)}>
                Edit
              </button>
            )}

            {showEditPic && (
              <div className="flex gap-2 mt-2">
                <input
                  value={newPicUrl}
                  onChange={(e) =>
                    setNewPicUrl(e.target.value)
                  }
                  placeholder="Image URL"
                  className="text-black"
                />
                <button onClick={handleUpdateProfilePic}>
                  Save
                </button>
              </div>
            )}

            <h2 className="text-xl mt-3">
              @{profile.username}
            </h2>

            <div className="flex gap-4 text-gray-400">
              <span>{videos.length} videos</span>
              <span>{followerCount} followers</span>
              <span>
                {profile.following?.length || 0} following
              </span>
            </div>

            {!isOwnProfile && (
              <button
                onClick={toggleFollowSystem}
                className="mt-3 bg-red-500 px-6 py-2 rounded"
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}
          </div>

          {/* FIXED VIDEO PLAYBACK HERE */}
          <div className="grid grid-cols-3 gap-2 mt-6">
            {videos.map((v) => (
              <div
                key={v.id}
                className="aspect-[3/4] bg-gray-900"
              >
                <video
                  src={v.videoUrl || v.url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
              </div>
            ))}
          </div>
        </>
      )}

      {showHelp && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 p-4">
            <p>Help Section</p>
            <button onClick={() => setShowHelp(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}