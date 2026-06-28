import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSales, voidSale } from "../services/api";

export default function Sales() {
  const [sales, setSales] = useState([]);

  const load = () => getSales().then((res) => setSales(res.data.results || res.data));

  useEffect(() => { load(); }, []);

  const handleVoid = async (id) => {
    if (confirm("Void this sale? Stock will be restored.")) {
      await voidSale(id);
      load();
    }
  };

  return (
    <div>
      <h2>Sales History</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Receipt #</th>
            <th>Cashier</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td><Link to={`/receipt/${s.id}`}>{s.receipt_number}</Link></td>
              <td>{s.cashier_name}</td>
              <td>KES {s.total}</td>
              <td>{s.payment_method}</td>
              <td>
                <span className={`pill ${s.status === "COMPLETED" ? "success" : "danger"}`}>
                  {s.status}
                </span>
              </td>
              <td>{new Date(s.created_at).toLocaleString()}</td>
              <td>
                {s.status === "COMPLETED" && (
                  <button className="btn btn-outline" onClick={() => handleVoid(s.id)}>Void</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}