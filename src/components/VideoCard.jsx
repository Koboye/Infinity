export default function VideoCard({ video }) {
  return (
    <div className="video-card">
      <video src={video?.url} controls />
      <p>{video?.title}</p>
    </div>
  );
}
