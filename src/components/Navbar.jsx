import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 flex justify-around items-center py-3 z-50">
      <Link to="/" className="flex flex-col items-center text-white">
        <span className="text-2xl">🏠</span>
        <span className="text-xs mt-1">Home</span>
      </Link>
      <Link to="/search" className="flex flex-col items-center text-gray-400">
        <span className="text-2xl">🔍</span>
        <span className="text-xs mt-1">Search</span>
      </Link>
      <Link to="/upload" className="flex flex-col items-center">
        <div className="bg-red-500 px-5 py-1 rounded-xl">
          <span className="text-white text-2xl font-bold">+</span>
        </div>
      </Link>
      {user ? (
        <>
          <Link to={"/profile/" + user.uid} className="flex flex-col items-center text-gray-400">
            <span className="text-2xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
          <button onClick={handleLogout} className="flex flex-col items-center text-gray-400">
            <span className="text-2xl">🚪</span>
            <span className="text-xs mt-1">Logout</span>
          </button>
        </>
      ) : (
        <Link to="/login" className="flex flex-col items-center text-gray-400">
          <span className="text-2xl">🔑</span>
          <span className="text-xs mt-1">Login</span>
        </Link>
      )}
    </div>
  );
}