import React, { useEffect, useState } from "react";
import { getSuppliers, createSupplier, deleteSupplier } from "../services/api";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: "", phone_number: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const load = () => {
    setLoading(true);
    return getSuppliers()
      .then((res) => setSuppliers(res.data.results || res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createSupplier(form);
    setForm({ name: "", phone_number: "", email: "" });
    load();
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this supplier?")) {
      await deleteSupplier(id);
      load();
    }
  };

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter((s) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <i className="bi bi-truck" style={{ marginRight: "8px" }}></i>
          Suppliers
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span className="pill info">
            <i className="bi bi-people"></i> {suppliers.length} suppliers
          </span>
        </div>
      </div>

      {/* Add Supplier Form */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3><i className="bi bi-plus-circle"></i> Add New Supplier</h3>
          <span className="card-action">Register supplier</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: "16px",
            alignItems: "end"
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="supplierName">Supplier Name *</label>
              <input
                id="supplierName"
                name="name"
                className="form-control"
                type="text"
                placeholder="Enter supplier name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="supplierPhone">Phone Number</label>
              <input
                id="supplierPhone"
                name="phone_number"
                className="form-control"
                type="text"
                placeholder="2547XXXXXXXX"
                value={form.phone_number}
                onChange={handleChange}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="supplierEmail">Email</label>
              <input
                id="supplierEmail"
                name="email"
                className="form-control"
                type="email"
                placeholder="supplier@email.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ height: "42px" }}>
              <i className="bi bi-plus-lg"></i> Add Supplier
            </button>
          </div>
        </form>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ 
          display: "flex", 
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <div className="form-group" style={{ flex: "1", minWidth: "200px", marginBottom: 0 }}>
            <label htmlFor="searchSuppliers">
              <i className="bi bi-search"></i> Search Suppliers
            </label>
            <input
              id="searchSuppliers"
              className="form-control"
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {filteredSuppliers.length !== suppliers.length && (
              <span>Showing {filteredSuppliers.length} of {suppliers.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      {loading ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading suppliers...</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                      <i className="bi bi-truck" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                      {suppliers.length === 0 ? "No suppliers found. Add your first supplier!" : "No suppliers match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: "600" }}>
                        <span className="pill neutral">
                          <i className="bi bi-building" style={{ marginRight: "4px" }}></i>
                          {s.name}
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
                        {s.email ? (
                          <a 
                            href={`mailto:${s.email}`}
                            style={{ 
                              color: "var(--color-primary)", 
                              textDecoration: "none",
                              fontWeight: "500"
                            }}
                          >
                            <i className="bi bi-envelope"></i> {s.email}
                          </a>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="pill success">
                          <i className="bi bi-check-circle"></i> Active
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            title="Edit supplier"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            onClick={() => handleDelete(s.id)}
                            title="Delete supplier"
                          >
                            <i className="bi bi-trash"></i>
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
      {!loading && suppliers.length > 0 && (
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
                Total Suppliers
              </span>
              <div style={{ fontWeight: "700" }}>{suppliers.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                With Phone
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-success)" }}>
                {suppliers.filter(s => s.phone_number).length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                With Email
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-primary)" }}>
                {suppliers.filter(s => s.email).length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Contact Info Complete
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-accent)" }}>
                {suppliers.filter(s => s.phone_number && s.email).length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {filteredSuppliers.length !== suppliers.length && (
              <span>Showing {filteredSuppliers.length} of {suppliers.length} suppliers</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}