import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerSupermarket, setAuthToken } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    supermarket_name: "",
    phone_number: "",
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerSupermarket(form);
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh);
      setAuthToken(res.data.access);
      setUser(res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Check your details.");
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
        maxWidth: "440px", 
        width: "100%", 
        padding: "32px 28px"
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ 
            width: "64px", 
            height: "64px", 
            background: "var(--color-accent)",
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
            Create your Supermarket Account
          </h2>
          <p style={{ 
            color: "var(--color-text-muted)", 
            fontSize: "0.9rem",
            margin: "4px 0 0 0"
          }}>
            Register your supermarket
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="supermarket_name">Supermarket Name</label>
            <input
              id="supermarket_name"
              name="supermarket_name"
              className="form-control"
              type="text"
              value={form.supermarket_name}
              onChange={handleChange}
              placeholder="Enter supermarket name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone_number">Phone Number</label>
            <input
              id="phone_number"
              name="phone_number"
              className="form-control"
              type="text"
              value={form.phone_number}
              onChange={handleChange}
              placeholder="2547XXXXXXXX"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Owner Username</label>
            <input
              id="username"
              name="username"
              className="form-control"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder="Choose a username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              className="form-control"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Create a password"
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
            {loading ? "Creating account..." : "Create Account"}
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
          Already registered? <Link to="/login" style={{ 
            color: "var(--color-primary)", 
            fontWeight: "600",
            textDecoration: "none"
          }}>Login</Link>
        </p>
      </div>
    </div>
  );
}