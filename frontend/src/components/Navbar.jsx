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

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return (user.first_name[0] + user.last_name[0]).toUpperCase();
    }
    if (user?.first_name) {
      return user.first_name[0].toUpperCase();
    }
    if (user?.username) {
      return user.username[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="navbar-toggle" onClick={toggleSidebar}>
          <i className="bi bi-list"></i>
        </button>

        <div className="navbar-breadcrumb">
          <span>Friends Supermarket</span>
          <span style={{ color: "var(--color-text-muted)" }}> / </span>
          <span className="current">Dashboard</span>
        </div>

        {session && (
          <span className={`navbar-session-pill${isLocked ? " locked" : ""}`}>
            <i className={`bi ${isLocked ? "bi-lock-fill" : "bi-unlock-fill"}`}></i>
            <span>{isLocked ? "Session Locked" : `${remaining} sales left`}</span>
          </span>
        )}
      </div>

      <div className="navbar-right">
        <div className="navbar-actions">
          <button className="navbar-icon-btn" title="Notifications">
            <i className="bi bi-bell"></i>
            <span className="notification-dot"></span>
          </button>
          <button className="navbar-icon-btn" title="Help">
            <i className="bi bi-question-circle"></i>
          </button>
        </div>

        <div className="navbar-user">
          <div className="navbar-user-info">
            <div className="name">{user?.full_name || user?.username}</div>
            <div className="role">{user?.role || "User"}</div>
          </div>
          <div className="navbar-avatar">
            {getInitials()}
          </div>
        </div>

        <button className="btn btn-outline btn-sm" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right"></i>
          <span style={{ display: "inline" }}>Logout</span>
        </button>
      </div>
    </header>
  );
}