import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSales, voidSale } from "../services/api";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const load = () => {
    setLoading(true);
    return getSales()
      .then((res) => setSales(res.data.results || res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleVoid = async (id) => {
    if (confirm("Void this sale? Stock will be restored.")) {
      await voidSale(id);
      load();
    }
  };

  // Filter sales based on search and status
  const filteredSales = sales.filter((s) => {
    const matchesSearch = 
      s.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cashier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "ALL" || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  // Get status pill class
  const getStatusPill = (status) => {
    switch(status) {
      case "COMPLETED": return "success";
      case "VOIDED": return "danger";
      case "PENDING": return "warning";
      default: return "neutral";
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
          <i className="bi bi-receipt" style={{ marginRight: "8px" }}></i>
          Sales History
        </h2>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "12px",
          flexWrap: "wrap"
        }}>
          <span className="pill info">
            <i className="bi bi-calendar3"></i> Total: {sales.length} sales
          </span>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ 
          display: "flex", 
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "flex-end"
        }}>
          <div className="form-group" style={{ flex: "1", minWidth: "200px", marginBottom: 0 }}>
            <label htmlFor="searchSales">
              <i className="bi bi-search"></i> Search
            </label>
            <input
              id="searchSales"
              className="form-control"
              type="text"
              placeholder="Search by receipt # or cashier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ minWidth: "150px", marginBottom: 0 }}>
            <label htmlFor="filterStatus">Status</label>
            <select
              id="filterStatus"
              className="form-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      {loading ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading sales...</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Cashier</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                      <i className="bi bi-inbox" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                      {sales.length === 0 ? "No sales found." : "No sales match your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link 
                          to={`/receipt/${s.id}`}
                          style={{ 
                            color: "var(--color-primary)", 
                            fontWeight: "600",
                            textDecoration: "none"
                          }}
                        >
                          {s.receipt_number}
                        </Link>
                      </td>
                      <td>{s.cashier_name}</td>
                      <td style={{ fontWeight: "600" }}>{formatCurrency(s.total)}</td>
                      <td>
                        <span className="pill neutral">
                          {s.payment_method}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${getStatusPill(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          <Link 
                            to={`/receipt/${s.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          >
                            <i className="bi bi-eye"></i>
                          </Link>
                          {s.status === "COMPLETED" && (
                            <button 
                              className="btn btn-danger btn-sm"
                              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                              onClick={() => handleVoid(s.id)}
                            >
                              <i className="bi bi-x-circle"></i>
                            </button>
                          )}
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
      {!loading && sales.length > 0 && (
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
                Total Sales
              </span>
              <div style={{ fontWeight: "700" }}>{sales.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Total Revenue
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-primary)" }}>
                {formatCurrency(sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0))}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Completed
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-success)" }}>
                {sales.filter(s => s.status === "COMPLETED").length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Voided
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-danger)" }}>
                {sales.filter(s => s.status === "VOIDED").length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {filteredSales.length !== sales.length && (
              <span>Showing {filteredSales.length} of {sales.length} sales</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}