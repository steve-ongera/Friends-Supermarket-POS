import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSession } from "../context/SessionContext.jsx";
import { getSubscription } from "../services/api";

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
  
  // Subscription balance state
  const [subscriptionBalance, setSubscriptionBalance] = useState(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [hasQueued, setHasQueued] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  // Initial load
  useEffect(() => {
    refreshSession().catch(() => {});
  }, [refreshSession]);

  // Fetch subscription balance with auto-refresh
  useEffect(() => {
    const fetchSubscriptionBalance = async () => {
      try {
        setLoadingBalance(true);
        const response = await getSubscription();
        const data = response.data;
        
        setSubscriptionBalance(data.total_sales_remaining);
        setIsUnlimited(data.is_unlimited);
        setHasQueued((data.queued?.length || 0) > 0);
        setIsLocked(!data.has_quota);
      } catch (error) {
        console.error("Failed to fetch subscription balance:", error);
        setSubscriptionBalance(null);
      } finally {
        setLoadingBalance(false);
      }
    };

    // Initial fetch
    fetchSubscriptionBalance();
    
    // Auto-refresh every 5 seconds (smooth and frequent)
    const interval = setInterval(fetchSubscriptionBalance, 5000);
    
    // Also refresh when the page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSubscriptionBalance();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sidebar state management
  useEffect(() => {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      const isOpen = sidebar.classList.contains("open");
      setIsSidebarOpen(isOpen);
    }

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

  // Close sidebar on mobile route change
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

  const getPageTitle = () => {
    const path = location.pathname;
    const item = NAV_ITEMS.find(item => item.to === path);
    return item?.label || "Dashboard";
  };

  // Balance display helpers
  const getBalanceDisplay = () => {
    if (loadingBalance) return "⟳ Loading...";
    if (isUnlimited) return "♾️ Unlimited";
    if (subscriptionBalance === null || subscriptionBalance === undefined) return "No subscription";
    if (isLocked) return "🔒 Locked - 0 sales";
    if (subscriptionBalance === 0 && hasQueued) return "0 (queued available)";
    if (subscriptionBalance === 0) return "0 sales left";
    if (subscriptionBalance === 1) return "1 sale left";
    return `${subscriptionBalance} sales left`;
  };

  const getBalanceColor = () => {
    if (loadingBalance) return "var(--color-text-muted)";
    if (isUnlimited) return "var(--color-primary)";
    if (subscriptionBalance === null || subscriptionBalance === undefined) return "var(--color-text-muted)";
    if (isLocked || subscriptionBalance === 0) return "var(--color-danger)";
    if (subscriptionBalance <= 5) return "var(--color-warning)";
    return "var(--color-success)";
  };

  const getBalanceIcon = () => {
    if (loadingBalance) return "bi-arrow-repeat";
    if (isUnlimited) return "bi-infinity";
    if (subscriptionBalance === null || subscriptionBalance === undefined) return "bi-exclamation-circle";
    if (isLocked || subscriptionBalance === 0) return "bi-exclamation-triangle";
    if (subscriptionBalance <= 5) return "bi-hourglass-split";
    return "bi-check-circle";
  };

  const getBackgroundColor = () => {
    if (loadingBalance) return "var(--color-bg)";
    if (isUnlimited) return "var(--color-primary-50)";
    if (isLocked || subscriptionBalance === 0) return "var(--color-danger-50)";
    if (subscriptionBalance <= 5) return "var(--color-warning-50)";
    return "var(--color-success-50)";
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

        {/* Single Subscription Balance Pill - Auto-refreshes every 5 seconds */}
        <span 
          className="navbar-balance-pill"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 14px",
            borderRadius: "var(--radius-full)",
            fontSize: "0.78rem",
            fontWeight: "600",
            background: getBackgroundColor(),
            border: `1.5px solid ${getBalanceColor()}`,
            color: getBalanceColor(),
            cursor: "pointer",
            transition: "all 0.3s ease",
            minWidth: "120px",
            justifyContent: "center"
          }}
          onClick={() => navigate("/subscription")}
          title="Click to view subscription details"
        >
          <i 
            className={`bi ${getBalanceIcon()}`}
            style={{
              animation: loadingBalance ? "spin 1s linear infinite" : "none"
            }}
          ></i>
          <span>{getBalanceDisplay()}</span>
          {hasQueued && subscriptionBalance !== 0 && (
            <span 
              style={{
                background: "var(--color-primary)",
                color: "#fff",
                borderRadius: "var(--radius-full)",
                padding: "0 8px",
                fontSize: "0.6rem",
                fontWeight: "700",
                marginLeft: "2px"
              }}
            >
              +{subscriptionBalance > 0 ? "queued" : ""}
            </span>
          )}
          {isLocked && (
            <span 
              style={{
                background: "var(--color-danger)",
                color: "#fff",
                borderRadius: "var(--radius-full)",
                padding: "0 8px",
                fontSize: "0.6rem",
                fontWeight: "700",
                marginLeft: "2px"
              }}
            >
              LOCKED
            </span>
          )}
        </span>
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