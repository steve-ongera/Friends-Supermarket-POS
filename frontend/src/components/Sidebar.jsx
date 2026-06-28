import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

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

  return (
    <aside className="sidebar" id="app-sidebar">
      <div className="sidebar-brand">
        <i className="bi bi-shop"></i>
        <span>Friends POS</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        &copy; {new Date().getFullYear()} Friends Supermarket POS
      </div>
    </aside>
  );
}