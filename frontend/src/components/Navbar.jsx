import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSession } from "../context/SessionContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { session, refreshSession } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    refreshSession().catch(() => {});
  }, [refreshSession]);

  const toggleSidebar = () => {
    document.getElementById("app-sidebar")?.classList.toggle("open");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isLocked = session?.status === "LOCKED";
  const remaining = session ? Math.max(session.sales_limit - session.sales_count, 0) : null;

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="navbar-toggle" onClick={toggleSidebar}>
          <i className="bi bi-list"></i>
        </button>

        {session && (
          <span className={`navbar-session-pill${isLocked ? " locked" : ""}`}>
            <i className={`bi ${isLocked ? "bi-lock-fill" : "bi-unlock-fill"}`}></i>
            {isLocked ? "Session Locked" : `${remaining} sales left`}
          </span>
        )}
      </div>

      <div className="navbar-right">
        <div className="navbar-user">
          <div className="navbar-avatar">
            {(user?.first_name?.[0] || user?.username?.[0] || "U").toUpperCase()}
          </div>
          <span>{user?.full_name || user?.username}</span>
        </div>
        <button className="btn btn-outline" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right"></i> Logout
        </button>
      </div>
    </header>
  );
}