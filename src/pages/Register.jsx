import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Register({ onAuthSuccess, onNavigateLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !username) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await setDoc(doc(db, "users", result.user.uid), {
        username: username.toLowerCase().trim(),
        email: email.trim(),
        uid: result.user.uid,
        followers: [],
        following: [],
        photoURL: "",
        createdAt: serverTimestamp(),
      });

      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="bg-gray-900 p-8 rounded-2xl w-96 max-w-full border border-gray-800">

        <h1 className="text-3xl font-bold text-center mb-6 text-red-500">
          Sign Up
        </h1>

        {error && (
          <p className="text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-xl mb-4 text-sm">
            {error}
          </p>
        )}

        <div className="space-y-4 mb-6">
          <input
            type="text"
            placeholder="Username"
            className="w-full bg-gray-800 p-3 rounded-xl text-white outline-none focus:ring-1 focus:ring-red-500 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="email"
            placeholder="Email Address"
            className="w-full bg-gray-800 p-3 rounded-xl text-white outline-none focus:ring-1 focus:ring-red-500 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full bg-gray-800 p-3 rounded-xl text-white outline-none focus:ring-1 focus:ring-red-500 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-red-500 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="text-center mt-6 text-gray-400 text-sm">
          Already have an account?{" "}
          <button
            onClick={onNavigateLogin}
            className="text-red-500 font-semibold underline ml-1 hover:text-red-400"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}