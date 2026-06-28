import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "var(--color-bg)",
      padding: "20px"
    }}>
      <div className="card" style={{ 
        maxWidth: "400px", 
        width: "100%", 
        padding: "32px 28px"
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ 
            width: "64px", 
            height: "64px", 
            background: "var(--color-primary)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            fontSize: "28px",
            color: "#fff"
          }}>
            <i className="bi bi-shop"></i>
          </div>
          <h2 style={{ 
            fontSize: "1.5rem", 
            fontWeight: "700", 
            margin: 0,
            letterSpacing: "-0.02em"
          }}>
            Friends POS
          </h2>
          <p style={{ 
            color: "var(--color-text-muted)", 
            fontSize: "0.9rem",
            margin: "4px 0 0 0"
          }}>
            Login to your supermarket account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="form-control"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div style={{ 
              background: "var(--color-danger-light)", 
              color: "var(--color-danger)",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.875rem",
              marginBottom: "16px"
            }}>
              {error}
            </div>
          )}

          <button 
            className="btn btn-primary" 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: "100%", 
              justifyContent: "center",
              padding: "12px",
              fontSize: "0.95rem"
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ 
          marginTop: "20px", 
          fontSize: "0.875rem",
          textAlign: "center",
          color: "var(--color-text-muted)",
          borderTop: "1px solid var(--color-border-light)",
          paddingTop: "20px"
        }}>
          New supermarket? <Link to="/register" style={{ 
            color: "var(--color-primary)", 
            fontWeight: "600",
            textDecoration: "none"
          }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}