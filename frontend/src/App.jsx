import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/Sidebar.jsx";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SessionLockModal from "./components/SessionLockModal.jsx";
import { useAuth } from "./context/AuthContext.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import POS from "./pages/POS.jsx";
import Inventory from "./pages/Inventory.jsx";
import Products from "./pages/Products.jsx";
import Categories from "./pages/Categories.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import Sales from "./pages/Sales.jsx";
import Receipt from "./pages/Receipt.jsx";
import Staff from "./pages/Staff.jsx";
import SubscriptionPage from "./pages/Subscription.jsx";
import Settings from "./pages/Settings.jsx";

function AppLayout({ children }) {
  // Close sidebar function
  const closeSidebar = () => {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      {/* Sidebar Overlay - click to close on mobile */}
      <div 
        className="sidebar-overlay" 
        id="sidebar-overlay"
        onClick={closeSidebar}
      ></div>
      <div className="app-main">
        <Navbar />
        <div className="app-content">{children}</div>
      </div>
      <SessionLockModal />
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="full-screen-loader">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <AppLayout>
              <POS />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute roles={["OWNER", "MANAGER"]}>
            <AppLayout>
              <Inventory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute roles={["OWNER", "MANAGER"]}>
            <AppLayout>
              <Products />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute roles={["OWNER", "MANAGER"]}>
            <AppLayout>
              <Categories />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute roles={["OWNER", "MANAGER"]}>
            <AppLayout>
              <Suppliers />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Sales />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/receipt/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Receipt />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute roles={["OWNER", "MANAGER"]}>
            <AppLayout>
              <Staff />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute roles={["OWNER", "MANAGER"]}>
            <AppLayout>
              <SubscriptionPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute roles={["OWNER", "MANAGER"]}>
            <AppLayout>
              <Settings />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}