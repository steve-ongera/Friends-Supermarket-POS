import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSale } from "../services/api";
import posLogo from "../assets/pos_logo.png";

export default function Receipt() {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSale(id)
      .then((res) => setSale(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="card" style={{ 
        maxWidth: "480px", 
        margin: "40px auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px"
      }}>
        <div style={{ textAlign: "center" }}>
          <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="card" style={{ 
        maxWidth: "480px", 
        margin: "40px auto",
        textAlign: "center",
        padding: "40px 20px"
      }}>
        <i className="bi bi-exclamation-circle" style={{ 
          fontSize: "3rem", 
          color: "var(--color-danger)",
          display: "block",
          marginBottom: "16px"
        }}></i>
        <h3 style={{ margin: "0 0 8px 0" }}>Receipt Not Found</h3>
        <p style={{ color: "var(--color-text-muted)", margin: "0 0 20px 0" }}>
          The receipt you're looking for doesn't exist.
        </p>
        <Link to="/pos" className="btn btn-primary">
          <i className="bi bi-arrow-left"></i> Back to POS
        </Link>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: "480px", 
      margin: "0 auto",
      padding: "16px"
    }}>
      {/* Back button */}
      <Link 
        to="/pos" 
        style={{ 
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--color-text-muted)",
          textDecoration: "none",
          marginBottom: "16px",
          padding: "8px 16px",
          borderRadius: "var(--radius-sm)",
          transition: "all 0.15s",
          fontSize: "0.9rem"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-bg)";
          e.currentTarget.style.color = "var(--color-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text-muted)";
        }}
      >
        <i className="bi bi-arrow-left"></i> Back to POS
      </Link>

      <div className="card" style={{ 
        padding: "28px 24px",
        position: "relative"
      }}>
        {/* Receipt Header */}
        <div style={{ 
          textAlign: "center", 
          borderBottom: "2px dashed var(--color-border)",
          paddingBottom: "16px",
          marginBottom: "16px"
        }}>
          <div style={{ 
            width: "70px", 
            height: "70px", 
            background: "var(--color-surface)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            padding: "8px",
            boxShadow: "var(--shadow-sm)",
            border: "1px solid var(--color-border-light)"
          }}>
            <img 
              src={posLogo} 
              alt="Friends POS" 
              style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "contain"
              }} 
            />
          </div>
          <h2 style={{ 
            margin: "0 0 4px 0",
            fontSize: "1.3rem",
            fontWeight: "700",
            color: "var(--color-primary-dark)"
          }}>
            Friends Supermarket
          </h2>
          <p style={{ 
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "0.85rem"
          }}>
            <i className="bi bi-receipt"></i> Receipt #{sale.receipt_number}
          </p>
          <p style={{ 
            margin: "4px 0 0 0",
            color: "var(--color-text-muted)",
            fontSize: "0.75rem"
          }}>
            <i className="bi bi-clock"></i> {new Date(sale.created_at).toLocaleString()}
          </p>
          <div style={{ 
            marginTop: "8px",
            display: "inline-block",
            padding: "2px 12px",
            borderRadius: "var(--radius-full)",
            background: sale.status === "COMPLETED" ? "var(--color-success-light)" : "var(--color-warning-light)",
            color: sale.status === "COMPLETED" ? "var(--color-success-dark)" : "var(--color-warning)",
            fontSize: "0.75rem",
            fontWeight: "600"
          }}>
            <i className={`bi ${sale.status === "COMPLETED" ? "bi-check-circle" : "bi-clock"}`}></i>
            {sale.status}
          </div>
        </div>

        {/* Items Table */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ 
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: "8px",
            padding: "8px 0",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "0.75rem",
            fontWeight: "600",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            <span>Item</span>
            <span style={{ textAlign: "center" }}>Qty</span>
            <span style={{ textAlign: "right" }}>Total</span>
          </div>
          {sale.items.map((item) => (
            <div 
              key={item.id}
              style={{ 
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: "8px",
                padding: "8px 0",
                borderBottom: "1px solid var(--color-border-light)",
                fontSize: "0.9rem"
              }}
            >
              <span style={{ fontWeight: "500" }}>{item.product_name}</span>
              <span style={{ textAlign: "center" }}>×{item.quantity}</span>
              <span style={{ textAlign: "right", fontWeight: "600" }}>
                {formatCurrency(item.line_total)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ 
          borderTop: "2px solid var(--color-border)",
          paddingTop: "16px",
          marginBottom: "16px"
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between",
            padding: "4px 0",
            fontSize: "0.9rem",
            color: "var(--color-text-muted)"
          }}>
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              padding: "4px 0",
              fontSize: "0.9rem",
              color: "var(--color-text-muted)"
            }}>
              <span>Discount</span>
              <span style={{ color: "var(--color-success)" }}>-{formatCurrency(sale.discount)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              padding: "4px 0",
              fontSize: "0.9rem",
              color: "var(--color-text-muted)"
            }}>
              <span>Tax</span>
              <span>{formatCurrency(sale.tax)}</span>
            </div>
          )}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between",
            padding: "12px 0 4px 0",
            borderTop: "1px solid var(--color-border)",
            fontSize: "1.2rem",
            fontWeight: "700",
            color: "var(--color-primary-dark)"
          }}>
            <span>Total</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          padding: "12px",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-sm)",
          marginBottom: "16px",
          fontSize: "0.85rem"
        }}>
          <span style={{ color: "var(--color-text-muted)" }}>
            <i className="bi bi-credit-card"></i> Payment
          </span>
          <span style={{ fontWeight: "600" }}>
            {sale.payment_method} {sale.amount_tendered && `(${formatCurrency(sale.amount_tendered)} tendered)`}
          </span>
        </div>

        {/* Cashier Info */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
          paddingBottom: "16px",
          borderBottom: "2px dashed var(--color-border)",
          marginBottom: "16px"
        }}>
          <span>
            <i className="bi bi-person"></i> Cashier: {sale.cashier_name || "N/A"}
          </span>
          <span>
            <i className="bi bi-receipt"></i> #{sale.id}
          </span>
        </div>

        {/* QR Code */}
        {sale.qr_code && (
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <img 
              src={sale.qr_code} 
              alt="Receipt QR Code" 
              style={{ 
                width: "120px", 
                height: "120px",
                objectFit: "contain",
                background: "white",
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-light)"
              }} 
            />
            <p style={{ 
              fontSize: "0.7rem", 
              color: "var(--color-text-muted)",
              margin: "4px 0 0 0"
            }}>
              <i className="bi bi-qr-code"></i> Scan to verify this receipt
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ 
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--color-text-muted)",
          borderTop: "1px solid var(--color-border-light)",
          paddingTop: "12px"
        }}>
          <p style={{ margin: "0 0 4px 0" }}>
            <i className="bi bi-check-circle" style={{ color: "var(--color-success)" }}></i> 
            Thank you for shopping with us!
          </p>
          <p style={{ margin: 0 }}>
            Visit us again at Friends Supermarket
          </p>
        </div>

        {/* Actions */}
        <div style={{ 
          display: "flex", 
          gap: "10px",
          marginTop: "20px"
        }}>
          <button 
            className="btn btn-primary" 
            style={{ 
              flex: 1,
              justifyContent: "center",
              padding: "12px"
            }} 
            onClick={() => window.print()}
          >
            <i className="bi bi-printer"></i> Print Receipt
          </button>
          <Link 
            to="/pos" 
            className="btn btn-secondary"
            style={{ 
              flex: 1,
              justifyContent: "center",
              padding: "12px"
            }}
          >
            <i className="bi bi-arrow-left"></i> Back to POS
          </Link>
        </div>
      </div>
    </div>
  );
}