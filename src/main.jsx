import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./dagu.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import "./index.css";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

function Root() {
  const { user } = useAuth();
  const [page, setPage] = useState("login"); // login | register

  // ✅ If logged in → show main app
  if (user) return <App />;

  // ❌ Not logged in → show auth pages
  if (page === "login") {
    return (
      <Login onNavigateRegister={() => setPage("register")} />
    );
  }

  return (
    <Register onNavigateLogin={() => setPage("login")} />
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
);