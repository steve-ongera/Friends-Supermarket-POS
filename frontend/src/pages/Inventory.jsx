import React, { useEffect, useState } from "react";
import { getProducts, getStockMovements, adjustStock } from "../services/api";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({ product: "", quantity: "", movement_type: "RESTOCK", note: "" });

  const loadAll = () => {
    getProducts().then((res) => setProducts(res.data.results || res.data));
    getStockMovements().then((res) => setMovements(res.data.results || res.data));
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

  return (
    <div>
      <h2>Inventory & Stock Movements</h2>

      <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <select name="product" value={form.product} onChange={handleChange} required>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.quantity_in_stock} in stock)</option>
          ))}
        </select>
        <select name="movement_type" value={form.movement_type} onChange={handleChange}>
          <option value="RESTOCK">Restock</option>
          <option value="ADJUSTMENT">Manual Adjustment</option>
          <option value="DAMAGE">Damage / Loss</option>
          <option value="RETURN">Customer Return</option>
        </select>
        <input name="quantity" type="number" placeholder="Quantity" value={form.quantity} onChange={handleChange} required />
        <input name="note" placeholder="Note (optional)" value={form.note} onChange={handleChange} />
        <button className="btn btn-primary" type="submit">Record Movement</button>
      </form>

      <h3>Recent Movements</h3>
      <table className="data-table">
        <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Note</th><th>By</th><th>Date</th></tr></thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>{m.product_name}</td>
              <td><span className="pill warning">{m.movement_type}</span></td>
              <td>{m.quantity}</td>
              <td>{m.note}</td>
              <td>{m.performed_by_name}</td>
              <td>{new Date(m.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}