import React, { useEffect, useState } from "react";
import { getStaff, createStaff, deleteStaff } from "../services/api";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", role: "CASHIER", phone_number: "" });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  const load = () => {
    setLoading(true);
    return getStaff()
      .then((res) => setStaff(res.data.results || res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createStaff(form);
    setForm({ username: "", password: "", role: "CASHIER", phone_number: "" });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id) => {
    if (confirm("Remove this staff member?")) {
      await deleteStaff(id);
      load();
    }
  };

  // Filter staff based on search and role
  const filteredStaff = staff.filter((s) => {
    const matchesSearch = 
      s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "ALL" || s.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Get role pill class
  const getRolePill = (role) => {
    switch(role) {
      case "MANAGER": return "warning";
      case "CASHIER": return "info";
      default: return "neutral";
    }
  };

  // Get role icon
  const getRoleIcon = (role) => {
    switch(role) {
      case "MANAGER": return "bi-person-badge";
      case "CASHIER": return "bi-person";
      default: return "bi-person";
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
          <i className="bi bi-people" style={{ marginRight: "8px" }}></i>
          Staff Management
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span className="pill info">
            <i className="bi bi-person-check"></i> {staff.length} staff members
          </span>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-plus-lg"}`}></i> 
            {showForm ? "Cancel" : "Add Staff"}
          </button>
        </div>
      </div>

      {/* Add Staff Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3><i className="bi bi-person-plus"></i> Add New Staff Member</h3>
            <span className="card-action">Required fields *</span>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
              gap: "16px",
              alignItems: "end"
            }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="staffUsername">Username *</label>
                <input
                  id="staffUsername"
                  name="username"
                  className="form-control"
                  type="text"
                  placeholder="Enter username"
                  value={form.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="staffPassword">Password *</label>
                <input
                  id="staffPassword"
                  name="password"
                  className="form-control"
                  type="password"
                  placeholder="Create password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="staffPhone">Phone Number</label>
                <input
                  id="staffPhone"
                  name="phone_number"
                  className="form-control"
                  type="text"
                  placeholder="2547XXXXXXXX"
                  value={form.phone_number}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="staffRole">Role *</label>
                <select
                  id="staffRole"
                  name="role"
                  className="form-control"
                  value={form.role}
                  onChange={handleChange}
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  <i className="bi bi-check-lg"></i> Add Staff
                </button>
                <button 
                  className="btn btn-secondary" 
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ 
          display: "flex", 
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <div className="form-group" style={{ flex: "1", minWidth: "200px", marginBottom: 0 }}>
            <label htmlFor="searchStaff">
              <i className="bi bi-search"></i> Search Staff
            </label>
            <input
              id="searchStaff"
              className="form-control"
              type="text"
              placeholder="Search by name, username, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ minWidth: "150px", marginBottom: 0 }}>
            <label htmlFor="filterRole">Role</label>
            <select
              id="filterRole"
              className="form-control"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="MANAGER">Manager</option>
              <option value="CASHIER">Cashier</option>
            </select>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {filteredStaff.length !== staff.length && (
              <span>Showing {filteredStaff.length} of {staff.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading staff...</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                      <i className="bi bi-people" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                      {staff.length === 0 ? "No staff members found. Add your first staff member!" : "No staff match your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: "600" }}>
                        <span className="pill neutral">
                          <i className={`bi ${getRoleIcon(s.role)}`} style={{ marginRight: "4px" }}></i>
                          {s.full_name || s.username}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {s.username}
                      </td>
                      <td>
                        <span className={`pill ${getRolePill(s.role)}`}>
                          <i className={`bi ${getRoleIcon(s.role)}`} style={{ marginRight: "4px" }}></i>
                          {s.role}
                        </span>
                      </td>
                      <td>
                        {s.phone_number ? (
                          <a 
                            href={`tel:${s.phone_number}`}
                            style={{ 
                              color: "var(--color-primary)", 
                              textDecoration: "none",
                              fontWeight: "500"
                            }}
                          >
                            <i className="bi bi-phone"></i> {s.phone_number}
                          </a>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${s.is_locked ? "danger" : "success"}`}>
                          <i className={`bi ${s.is_locked ? "bi-lock" : "bi-unlock"}`} style={{ marginRight: "4px" }}></i>
                          {s.is_locked ? "Locked" : "Active"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            title="Edit staff"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            onClick={() => handleDelete(s.id)}
                            title="Remove staff"
                          >
                            <i className="bi bi-person-x"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary footer */}
      {!loading && staff.length > 0 && (
        <div style={{ 
          marginTop: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "16px",
          background: "var(--color-surface-soft)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-light)"
        }}>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Total Staff
              </span>
              <div style={{ fontWeight: "700" }}>{staff.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Managers
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-warning)" }}>
                {staff.filter(s => s.role === "MANAGER").length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Cashiers
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-info)" }}>
                {staff.filter(s => s.role === "CASHIER").length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Active
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-success)" }}>
                {staff.filter(s => !s.is_locked).length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Locked
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-danger)" }}>
                {staff.filter(s => s.is_locked).length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {filteredStaff.length !== staff.length && (
              <span>Showing {filteredStaff.length} of {staff.length} staff</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}