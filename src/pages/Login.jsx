import { useState } from "react";
import { auth, googleProvider, facebookProvider } from "../firebase";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";

export default function Login({ onAuthSuccess, onNavigateRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showSocialOptions, setShowSocialOptions] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email");
      } else if (err.code === 'auth/wrong-password') {
        setError("Incorrect password");
      } else if (err.code === 'auth/invalid-email') {
        setError("Invalid email format");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many failed attempts. Please try again later");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Google user:", result.user);
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Login cancelled");
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with the same email address but different sign-in credentials");
      } else {
        setError("Google login failed: " + err.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setFacebookLoading(true);
    setError("");

    try {
      const result = await signInWithPopup(auth, facebookProvider);
      console.log("Facebook user:", result.user);
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Login cancelled");
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with the same email address but different sign-in credentials");
      } else {
        setError("Facebook login failed: " + err.message);
      }
    } finally {
      setFacebookLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, "demo@dagu.com", "demo123");
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err) {
      setError("Demo login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Contact methods
  const contactMethods = [
    { name: "WhatsApp", icon: "💬", link: "https://wa.me/251928390022" },
    { name: "Telegram", icon: "✈️", link: "https://t.me/dagu_support" },
    { name: "Facebook", icon: "📘", link: "https://m.me/dagu_support" },
    { name: "Email", icon: "📧", link: "mailto:support@dagu.com" },
    { name: "Phone Call", icon: "📞", link: "tel:+251928390022" },
    { name: "Instagram", icon: "📷", link: "https://instagram.com/dagu_official" }
  ];

  // Social login buttons
  const socialLogins = [
    { name: "Google", icon: "G", bgColor: "bg-red-600/20", hoverBg: "hover:bg-red-600/30", handler: handleGoogleLogin, loading: googleLoading },
    { name: "Facebook", icon: "f", bgColor: "bg-blue-700/20", hoverBg: "hover:bg-blue-700/30", handler: handleFacebookLogin, loading: facebookLoading },
    { name: "Twitter", icon: "t", bgColor: "bg-blue-500/20", hoverBg: "hover:bg-blue-500/30", handler: () => setError("Twitter login coming soon!"), loading: false }
  ];

  // Extended social options
  const extendedOptions = [
    { name: "Instagram", icon: "📷", bgColor: "bg-pink-600/20", hoverBg: "hover:bg-pink-600/30" },
    { name: "LinkedIn", icon: "in", bgColor: "bg-blue-800/20", hoverBg: "hover:bg-blue-800/30" },
    { name: "YouTube", icon: "▶️", bgColor: "bg-red-600/20", hoverBg: "hover:bg-red-600/30" },
    { name: "Apple", icon: "🍎", bgColor: "bg-gray-600/20", hoverBg: "hover:bg-gray-600/30" }
  ];

  // Email domains for national email detection
  const getEmailDomain = (email) => {
    if (!email) return null;
    const domain = email.split('@')[1];
    return domain;
  };

  const isNationalEmail = () => {
    const domain = getEmailDomain(email);
    const nationalDomains = ['.et', '.com.et', '.org.et', '.edu.et', '.gov.et', 'ethionet.et'];
    return domain && nationalDomains.some(nd => domain.endsWith(nd));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="bg-gray-900 p-8 rounded-2xl w-96 max-w-full border border-gray-800 shadow-2xl">
        
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-2 animate-bounce">🎬</div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
            Dagu
          </h1>
          <p className="text-gray-400 text-sm mt-1">Connect, Share, Inspire</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-xl mb-4 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Email Input */}
        <div className="space-y-4 mb-4">
          <div className="relative">
            <input
              type="email"
              placeholder="Email Address"
              className="w-full bg-gray-800 p-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-red-500 text-sm pl-10 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="absolute left-3 top-3 text-gray-500">📧</span>
            {email && isNationalEmail() && (
              <span className="absolute right-3 top-2 text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>🇪🇹</span> Ethiopia
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="password"
              placeholder="Password"
              className="w-full bg-gray-800 p-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-red-500 text-sm pl-10 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <span className="absolute left-3 top-3 text-gray-500">🔒</span>
          </div>
        </div>

        {/* Forgot Password */}
        <div className="text-right mb-4">
          <button className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center justify-end gap-1">
            <span>🔑</span> Forgot Password?
          </button>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-red-600 to-red-500 py-3 rounded-xl font-bold hover:from-red-700 hover:to-red-600 transition-all disabled:opacity-50 shadow-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Logging in...
            </span>
          ) : (
            "Log In"
          )}
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gray-900 px-3 text-gray-500">OR CONTINUE WITH</span>
          </div>
        </div>

        {/* Social Login Options - Grid Layout */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {socialLogins.map((social) => (
            <button
              key={social.name}
              onClick={social.handler}
              disabled={social.loading}
              className={`${social.bgColor} ${social.hoverBg} py-3 rounded-xl font-semibold transition-all disabled:opacity-50 flex flex-col items-center gap-1 group`}
            >
              {social.loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="text-2xl font-bold group-hover:scale-110 transition-transform">{social.icon}</span>
                  <span className="text-xs">{social.name}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Toggle More Social Options */}
        <button
          onClick={() => setShowSocialOptions(!showSocialOptions)}
          className="w-full text-center text-sm text-gray-500 hover:text-red-400 transition-colors mb-4 flex items-center justify-center gap-2"
        >
          <span>{showSocialOptions ? '▲' : '▼'}</span>
          {showSocialOptions ? 'Less Options' : 'More Login Options'}
        </button>

        {/* Extended Social Options */}
        {showSocialOptions && (
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-2 gap-3">
              {extendedOptions.map((option) => (
                <button
                  key={option.name}
                  className={`${option.bgColor} ${option.hoverBg} py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-all`}
                  onClick={() => setError(`${option.name} login coming soon!`)}
                >
                  <span>{option.icon}</span>
                  <span>{option.name}</span>
                </button>
              ))}
            </div>
            <button 
              className="w-full bg-gray-800 py-2 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-700 transition-all"
              onClick={() => setError("Phone number login coming soon!")}
            >
              <span>📱</span> Phone Number Login
            </button>
          </div>
        )}

        {/* Demo Login */}
        <button
          onClick={handleDemoLogin}
          disabled={loading}
          className="w-full bg-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-6"
        >
          <span>🎮</span>
          Try Demo Account
        </button>

        {/* Help & Support Section */}
        <div className="border-t border-gray-800 pt-4">
          <button
            onClick={() => setShowContact(!showContact)}
            className="w-full text-center text-sm text-gray-400 hover:text-red-400 transition-colors flex items-center justify-center gap-2 py-2"
          >
            <span>🆘</span>
            Need Help?
            <span className="text-xs">{showContact ? '▲' : '▼'}</span>
          </button>

          {showContact && (
            <div className="mt-4 space-y-3">
              {/* Contact Header */}
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">24/7 Customer Support</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-red-500 text-2xl">❤️</span>
                  <span className="text-sm font-bold text-red-400">We're here to help!</span>
                </div>
              </div>

              {/* Contact Methods Grid */}
              <div className="grid grid-cols-2 gap-2">
                {contactMethods.map((method) => (
                  <a
                    key={method.name}
                    href={method.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gray-800 p-3 rounded-xl text-center hover:bg-gray-700 transition-all duration-200 group"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl group-hover:scale-110 transition-transform">{method.icon}</span>
                      <span className="text-xs font-medium text-gray-300">{method.name}</span>
                    </div>
                  </a>
                ))}
              </div>

              {/* Direct Phone Number Display */}
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Call / WhatsApp Direct</p>
                <a href="tel:+251928390022" className="text-xl font-bold text-green-400 hover:text-green-300 transition-colors">
                  +251 92 839 0022
                </a>
                <div className="flex gap-2 justify-center mt-2">
                  <a href="https://wa.me/251928390022" className="text-xs bg-green-600/30 px-3 py-1 rounded-full text-green-400 hover:bg-green-600 transition-all">
                    WhatsApp
                  </a>
                  <a href="https://t.me/dagu_support" className="text-xs bg-blue-600/30 px-3 py-1 rounded-full text-blue-400 hover:bg-blue-600 transition-all">
                    Telegram
                  </a>
                  <a href="https://m.me/dagu_support" className="text-xs bg-blue-700/30 px-3 py-1 rounded-full text-blue-300 hover:bg-blue-700 transition-all">
                    Messenger
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sign Up Link */}
        <p className="text-center mt-6 text-gray-400 text-sm">
          Don't have an account?{" "}
          <button
            onClick={onNavigateRegister}
            className="text-red-500 font-semibold underline ml-1 hover:text-red-400"
          >
            Sign Up
          </button>
        </p>

        {/* Terms & Privacy */}
        <p className="text-center text-xs text-gray-600 mt-4">
          By continuing, you agree to Dagu's{" "}
          <button className="text-gray-500 hover:text-red-400">Terms</button> and{" "}
          <button className="text-gray-500 hover:text-red-400">Privacy Policy</button>
        </p>
      </div>
    </div>
  );
}