import React, { useEffect, useState } from "react";
import { getProducts, getStockMovements, adjustStock } from "../services/api";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({ product: "", quantity: "", movement_type: "RESTOCK", note: "" });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("ALL");

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getProducts().then((res) => setProducts(res.data.results || res.data)),
      getStockMovements().then((res) => setMovements(res.data.results || res.data)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product || !form.quantity) return;
    await adjustStock(form.product, {
      quantity: form.quantity,
      movement_type: form.movement_type,
      note: form.note,
    });
    setForm({ product: "", quantity: "", movement_type: "RESTOCK", note: "" });
    loadAll();
  };

  // Filter movements based on type
  const filteredMovements = filterType === "ALL" 
    ? movements 
    : movements.filter(m => m.movement_type === filterType);

  // Get movement type pill class
  const getMovementPill = (type) => {
    switch(type) {
      case "RESTOCK": return "success";
      case "ADJUSTMENT": return "warning";
      case "DAMAGE": return "danger";
      case "RETURN": return "info";
      default: return "neutral";
    }
  };

  // Get movement icon
  const getMovementIcon = (type) => {
    switch(type) {
      case "RESTOCK": return "bi-arrow-up-circle";
      case "ADJUSTMENT": return "bi-arrow-left-right";
      case "DAMAGE": return "bi-exclamation-triangle";
      case "RETURN": return "bi-arrow-return-left";
      default: return "bi-arrow-right";
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
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
          <i className="bi bi-clipboard-data" style={{ marginRight: "8px" }}></i>
          Inventory & Stock Movements
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span className="pill info">
            <i className="bi bi-box"></i> {products.length} products
          </span>
          <span className="pill neutral">
            <i className="bi bi-arrow-left-right"></i> {movements.length} movements
          </span>
        </div>
      </div>

      {/* Add Stock Movement Form */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3><i className="bi bi-plus-circle"></i> Record Stock Movement</h3>
          <span className="card-action">Update inventory</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: "16px",
            alignItems: "end"
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="selectProduct">Product *</label>
              <select
                id="selectProduct"
                name="product"
                className="form-control"
                value={form.product}
                onChange={handleChange}
                required
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.quantity_in_stock || 0} in stock)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="movementType">Movement Type *</label>
              <select
                id="movementType"
                name="movement_type"
                className="form-control"
                value={form.movement_type}
                onChange={handleChange}
              >
                <option value="RESTOCK">Restock</option>
                <option value="ADJUSTMENT">Manual Adjustment</option>
                <option value="DAMAGE">Damage / Loss</option>
                <option value="RETURN">Customer Return</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="quantity">Quantity *</label>
              <input
                id="quantity"
                name="quantity"
                className="form-control"
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={form.quantity}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="note">Note</label>
              <input
                id="note"
                name="note"
                className="form-control"
                type="text"
                placeholder="Optional note"
                value={form.note}
                onChange={handleChange}
              />
            </div>

            <button className="btn btn-primary" type="submit" style={{ height: "42px" }}>
              <i className="bi bi-check-lg"></i> Record Movement
            </button>
          </div>
        </form>
      </div>

      {/* Movements Filter */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "16px",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <h3 style={{ 
          fontSize: "1.1rem", 
          fontWeight: "600", 
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <i className="bi bi-clock-history"></i>
          Recent Movements
        </h3>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button 
            className={`btn ${filterType === "ALL" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilterType("ALL")}
          >
            All
          </button>
          <button 
            className={`btn ${filterType === "RESTOCK" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilterType("RESTOCK")}
          >
            Restock
          </button>
          <button 
            className={`btn ${filterType === "ADJUSTMENT" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilterType("ADJUSTMENT")}
          >
            Adjustment
          </button>
          <button 
            className={`btn ${filterType === "DAMAGE" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilterType("DAMAGE")}
          >
            Damage
          </button>
          <button 
            className={`btn ${filterType === "RETURN" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilterType("RETURN")}
          >
            Return
          </button>
        </div>
      </div>

      {/* Movements Table */}
      {loading ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading movements...</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Note</th>
                  <th>Performed By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                      <i className="bi bi-clock-history" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                      {movements.length === 0 ? "No stock movements recorded yet." : "No movements match your filter."}
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: "500" }}>{m.product_name}</td>
                      <td>
                        <span className={`pill ${getMovementPill(m.movement_type)}`}>
                          <i className={`bi ${getMovementIcon(m.movement_type)}`} style={{ marginRight: "4px" }}></i>
                          {m.movement_type}
                        </span>
                      </td>
                      <td style={{ 
                        fontWeight: "600",
                        color: ["RESTOCK", "RETURN"].includes(m.movement_type) 
                          ? "var(--color-success)" 
                          : "var(--color-danger)"
                      }}>
                        {["RESTOCK", "RETURN"].includes(m.movement_type) ? "+" : "-"}
                        {m.quantity}
                      </td>
                      <td style={{ color: "var(--color-text-muted)", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.note || "—"}
                      </td>
                      <td>{m.performed_by_name || "System"}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        {new Date(m.created_at).toLocaleString()}
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
      {!loading && movements.length > 0 && (
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
                Total Movements
              </span>
              <div style={{ fontWeight: "700" }}>{movements.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Restocks
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-success)" }}>
                {movements.filter(m => m.movement_type === "RESTOCK").length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Adjustments
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-warning)" }}>
                {movements.filter(m => m.movement_type === "ADJUSTMENT").length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Damage
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-danger)" }}>
                {movements.filter(m => m.movement_type === "DAMAGE").length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Returns
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-primary)" }}>
                {movements.filter(m => m.movement_type === "RETURN").length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {filteredMovements.length !== movements.length && (
              <span>Showing {filteredMovements.length} of {movements.length} movements</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}