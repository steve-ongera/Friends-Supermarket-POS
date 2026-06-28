import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import posLogo from "../assets/pos_logo.png";

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

export default function Sidebar() {
  const { user } = useAuth();

  // Close sidebar when a link is clicked (on mobile)
  const handleLinkClick = () => {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.remove("open");
    }
  };

  // Close sidebar function
  const closeSidebar = () => {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
    }
  };

  // Group navigation items for better organization
  const mainItems = NAV_ITEMS.filter(item => 
    !item.roles || item.roles.includes(user?.role)
  ).slice(0, 4);
  
  const managementItems = NAV_ITEMS.filter(item => 
    !item.roles || item.roles.includes(user?.role)
  ).slice(4);

  return (
    <aside className="sidebar" id="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <img 
            src={posLogo} 
            alt="Friends POS" 
            style={{ 
              width: "100%", 
              height: "100%", 
              objectFit: "contain",
              filter: "brightness(0) invert(1)"
            }} 
          />
        </div>
        <div className="brand-text">
          <span>Friends POS</span>
          <small>Supermarket Management</small>
        </div>
        {/* Close button for mobile */}
        <button 
          className="sidebar-close-btn"
          onClick={closeSidebar}
          aria-label="Close sidebar"
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <nav className="sidebar-nav">
        {mainItems.length > 0 && (
          <>
            <div className="nav-label">Main</div>
            {mainItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                onClick={handleLinkClick}
              >
                <i className={`bi ${item.icon}`}></i>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}

        {managementItems.length > 0 && (
          <>
            <div className="nav-label">Management</div>
            {managementItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                onClick={handleLinkClick}
              >
                <i className={`bi ${item.icon}`}></i>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="version">
          <span className="status-dot"></span>
          v2.0.0
        </span>
        <span>&copy; {new Date().getFullYear()}</span>
      </div>
    </aside>
  );
}