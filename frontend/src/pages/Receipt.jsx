import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSale } from "../services/api";

export default function Receipt() {
  const { id } = useParams();
  const [sale, setSale] = useState(null);

  useEffect(() => {
    getSale(id).then((res) => setSale(res.data));
  }, [id]);

  if (!sale) return <p>Loading receipt...</p>;

  return (
    <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h2 style={{ textAlign: "center" }}>Friends Supermarket</h2>
      <p style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        Receipt #{sale.receipt_number}
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id}>
              <td>{item.product_name}</td>
              <td>{item.quantity}</td>
              <td>KES {item.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 14, textAlign: "right" }}>
        <p>Subtotal: KES {sale.subtotal}</p>
        <p>Discount: KES {sale.discount}</p>
        <p>Tax: KES {sale.tax}</p>
        <h3>Total: KES {sale.total}</h3>
      </div>

      {sale.qr_code && (
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <img src={sale.qr_code} alt="Receipt QR Code" style={{ width: 140 }} />
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Scan to verify this receipt
          </p>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={() => window.print()}>
        <i className="bi bi-printer"></i> Print Receipt
      </button>
    </div>
  );
}