import { useEffect, useRef, useState } from "react";
import { db, storage, auth } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export default function Camera() {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedURL, setRecordedURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [caption, setCaption] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);

  // Start camera on mount or when facingMode changes
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera();
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (err) {
      setHasPermission(false);
      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not access camera: " + err.message);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordedURL(null);
    setUploaded(false);
    setRecordingTime(0);

    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecordedURL(URL.createObjectURL(blob));
    };

    mediaRecorder.start();
    setIsRecording(true);

    // Timer
    timerRef.current = setInterval(() => {
      setRecordingTime((t) => {
        if (t >= 59) {
          stopRecording();
          return 60;
        }
        return t + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setRecordedURL(null);
    setCaption("");
    setUploaded(false);
    setRecordingTime(0);
  };

  const uploadVideo = async () => {
    if (!recordedBlob || !auth.currentUser) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const fileName = `videos/${auth.currentUser.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, recordedBlob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setUploadProgress(progress);
        },
        (err) => {
          setError("Upload failed: " + err.message);
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "videos"), {
            url: downloadURL,
            caption: caption.trim(),
            userId: auth.currentUser.uid,
            likes: [],
            comments: [],
            createdAt: serverTimestamp(),
          });
          setUploaded(true);
          setUploading(false);
          discardRecording();
        }
      );
    } catch (err) {
      setError("Upload failed: " + err.message);
      setUploading(false);
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // PERMISSION DENIED
  if (hasPermission === false) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">📵</div>
        <h2 className="text-xl font-bold mb-2">Camera Access Denied</h2>
        <p className="text-gray-400 text-sm mb-6">{error}</p>
        <button
          onClick={startCamera}
          className="bg-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  // PREVIEW RECORDED VIDEO
  if (recordedURL) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-lg font-bold mb-4">Preview Your Video</h2>
        <video
          src={recordedURL}
          controls
          autoPlay
          className="w-full max-w-sm rounded-2xl mb-4 border border-gray-800"
        />
        <input
          type="text"
          placeholder="Add a caption..."
          className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white outline-none focus:border-red-500 mb-4"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        {uploading && (
          <div className="w-full max-w-sm mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
        {uploaded && (
          <p className="text-green-400 font-bold mb-4">✅ Video uploaded successfully!</p>
        )}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={discardRecording}
            className="flex-1 bg-gray-800 py-3 rounded-xl font-bold hover:bg-gray-700 transition"
          >
            🗑️ Discard
          </button>
          <button
            onClick={uploadVideo}
            disabled={uploading}
            className="flex-1 bg-red-600 py-3 rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "⬆️ Post Video"}
          </button>
        </div>
      </div>
    );
  }

  // MAIN CAMERA VIEW
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative">
      {/* Camera Preview */}
      <div className="relative w-full max-w-sm aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />

        {/* Recording Timer */}
        {isRecording && (
          <div className="absolute top-4 left-0 right-0 flex justify-center">
            <div className="bg-red-600 px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full"></span>
              REC {formatTime(recordingTime)}
            </div>
          </div>
        )}

        {/* Flip Camera Button */}
        <button
          onClick={flipCamera}
          className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white text-xl hover:bg-black/70 transition"
        >
          🔄
        </button>
      </div>

      {/* Record Button */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${
            isRecording
              ? "bg-red-600 scale-90"
              : "bg-red-500 hover:bg-red-600 hover:scale-105"
          }`}
        >
          {isRecording ? (
            <div className="w-8 h-8 bg-white rounded-sm"></div>
          ) : (
            <div className="w-12 h-12 bg-red-600 rounded-full"></div>
          )}
        </button>
        <p className="text-gray-400 text-xs">
          {isRecording ? "Tap to stop" : "Tap to record"}
        </p>
        <p className="text-gray-600 text-xs">Max 60 seconds</p>
      </div>
    </div>
  );
}