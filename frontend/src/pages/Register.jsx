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
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h2><i className="bi bi-shop"></i> Create your Supermarket Account</h2>

        <label>Supermarket Name</label>
        <input name="supermarket_name" value={form.supermarket_name} onChange={handleChange} required />

        <label>Phone Number</label>
        <input name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="2547XXXXXXXX" required />

        <label>Owner Username</label>
        <input name="username" value={form.username} onChange={handleChange} required />

        <label>Password</label>
        <input type="password" name="password" value={form.password} onChange={handleChange} required />

        {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p style={{ marginTop: 14, fontSize: "0.85rem" }}>
          Already registered? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}