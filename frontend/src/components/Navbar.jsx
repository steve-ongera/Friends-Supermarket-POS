import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSession } from "../context/SessionContext.jsx";

// Navigation items for page title lookup
const NAV_ITEMS = [
  { to: "/", icon: "bi-speedometer2", label: "Dashboard", roles: null },
  { to: "/pos", icon: "bi-cart4", label: "POS / Till", roles: null },
  { to: "/sales", icon: "bi-receipt", label: "Sales", roles: null },
  { to: "/products", icon: "bi-box-seam", label: "Products", roles: ["OWNER", "MANAGER"] },
  { to: "/inventory", icon: "bi-clipboard-data", label: "Inventory", roles: ["OWNER", "MANAGER"] },
  { to: "/categories", icon: "bi-tags", label: "Categories", roles: ["OWNER", "MANAGER"] },
  { to: "/suppliers", icon: "bi-truck", label: "Suppliers", roles: ["OWNER", "MANAGER"] },
  { to: "/staff", icon: "bi-people", label: "Staff", roles: ["OWNER", "MANAGER"] },
  { to: "/subscription", icon: "bi-credit-card", label: "Subscription", roles: ["OWNER", "MANAGER"] },
  { to: "/settings", icon: "bi-gear", label: "Settings", roles: ["OWNER", "MANAGER"] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { session, refreshSession } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    refreshSession().catch(() => {});
  }, [refreshSession]);

  // Check sidebar state on mount and when it changes
  useEffect(() => {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      const isOpen = sidebar.classList.contains("open");
      setIsSidebarOpen(isOpen);
    }

    // Listen for sidebar state changes
    const observer = new MutationObserver(() => {
      const sidebar = document.getElementById("app-sidebar");
      if (sidebar) {
        setIsSidebarOpen(sidebar.classList.contains("open"));
      }
    });

    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    return () => observer.disconnect();
  }, []);

  // Close sidebar when route changes (only on mobile)
  useEffect(() => {
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  }, [location]);

  const toggleSidebar = () => {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.toggle("open");
      const isOpen = sidebar.classList.contains("open");
      setIsSidebarOpen(isOpen);
    }
  };

  const closeSidebar = () => {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
      setIsSidebarOpen(false);
    }
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

  // Get current page title from path
  const getPageTitle = () => {
    const path = location.pathname;
    const item = NAV_ITEMS.find(item => item.to === path);
    return item?.label || "Dashboard";
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button 
          className="navbar-toggle" 
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <i className={`bi ${isSidebarOpen ? "bi-x-lg" : "bi-list"}`}></i>
        </button>

        <div className="navbar-breadcrumb">
          <span className="brand-name">Friends Supermarket</span>
          <span className="separator"> / </span>
          <span className="current">{getPageTitle()}</span>
        </div>

        {session && (
          <span className={`navbar-session-pill${isLocked ? " locked" : ""}`}>
            <i className={`bi ${isLocked ? "bi-lock-fill" : "bi-unlock-fill"}`}></i>
            <span className="pill-text">{isLocked ? "Session Locked" : `${remaining} sales left`}</span>
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

        <button className="btn btn-outline btn-sm logout-btn" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right"></i>
          <span className="logout-text">Logout</span>
        </button>
      </div>
    </header>
  );
}