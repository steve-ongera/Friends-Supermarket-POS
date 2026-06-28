import React, { useEffect, useState } from "react";
import { getSupermarket, updateSupermarket } from "../services/api";

export default function Settings() {
  const [form, setForm] = useState({ name: "", location: "", phone_number: "", email: "", kra_pin: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getSupermarket()
      .then((res) => setForm(res.data))
      .catch(() => setError("Failed to load business settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await updateSupermarket(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "24px",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <h2 style={{ 
          fontSize: "1.5rem", 
          fontWeight: "700", 
          margin: 0,
          letterSpacing: "-0.02em"
        }}>
          <i className="bi bi-gear" style={{ marginRight: "8px" }}></i>
          Business Settings
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span className="pill info">
            <i className="bi bi-building"></i> {form.name || "Business"}
          </span>
        </div>
      </div>

      {loading && !form.name ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px",
          maxWidth: "520px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading settings...</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: "520px" }}>
          <div className="card-header">
            <h3>
              <i className="bi bi-building" style={{ marginRight: "8px" }}></i>
              Business Information
            </h3>
            <span className="card-action">Update your business details</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="businessName">
                <i className="bi bi-shop" style={{ marginRight: "4px" }}></i>
                Business Name *
              </label>
              <input
                id="businessName"
                name="name"
                className="form-control"
                type="text"
                value={form.name || ""}
                onChange={handleChange}
                placeholder="Enter business name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="businessLocation">
                <i className="bi bi-geo-alt" style={{ marginRight: "4px" }}></i>
                Location
              </label>
              <input
                id="businessLocation"
                name="location"
                className="form-control"
                type="text"
                value={form.location || ""}
                onChange={handleChange}
                placeholder="Enter business location"
              />
            </div>

            <div className="form-group">
              <label htmlFor="businessPhone">
                <i className="bi bi-phone" style={{ marginRight: "4px" }}></i>
                Phone Number
              </label>
              <input
                id="businessPhone"
                name="phone_number"
                className="form-control"
                type="text"
                value={form.phone_number || ""}
                onChange={handleChange}
                placeholder="2547XXXXXXXX"
              />
            </div>

            <div className="form-group">
              <label htmlFor="businessEmail">
                <i className="bi bi-envelope" style={{ marginRight: "4px" }}></i>
                Email
              </label>
              <input
                id="businessEmail"
                name="email"
                className="form-control"
                type="email"
                value={form.email || ""}
                onChange={handleChange}
                placeholder="business@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="businessKraPin">
                <i className="bi bi-file-text" style={{ marginRight: "4px" }}></i>
                KRA PIN
              </label>
              <input
                id="businessKraPin"
                name="kra_pin"
                className="form-control"
                type="text"
                value={form.kra_pin || ""}
                onChange={handleChange}
                placeholder="Enter KRA PIN"
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
                <i className="bi bi-exclamation-circle" style={{ marginRight: "6px" }}></i>
                {error}
              </div>
            )}

            {saved && (
              <div style={{ 
                background: "var(--color-success-light)", 
                color: "var(--color-success-dark)",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.875rem",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <i className="bi bi-check-circle-fill"></i>
                Settings saved successfully!
              </div>
            )}

            <div style={{ 
              display: "flex", 
              gap: "12px",
              marginTop: "8px"
            }}>
              <button 
                className="btn btn-primary" 
                type="submit" 
                disabled={loading}
                style={{ 
                  flex: 1,
                  justifyContent: "center",
                  padding: "12px"
                }}
              >
                {loading ? (
                  <>
                    <span className="loader-spinner" style={{ 
                      width: "20px", 
                      height: "20px", 
                      borderWidth: "2px",
                      marginRight: "8px"
                    }}></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i> Save Changes
                  </>
                )}
              </button>
              <button 
                className="btn btn-secondary" 
                type="button"
                onClick={() => {
                  getSupermarket().then((res) => setForm(res.data));
                  setSaved(false);
                  setError("");
                }}
                disabled={loading}
              >
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>
            </div>
          </form>

          {/* Quick info */}
          <div style={{ 
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border-light)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.8rem",
            color: "var(--color-text-muted)",
            flexWrap: "wrap",
            gap: "8px"
          }}>
            <span>
              <i className="bi bi-clock"></i> Last updated: {new Date().toLocaleString()}
            </span>
            <span>
              <i className="bi bi-check-circle" style={{ color: "var(--color-success)" }}></i> All fields are optional
            </span>
          </div>
        </div>
      )}
    </div>
  );
}