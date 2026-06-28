import React, { useEffect, useState } from "react";
import { getProducts, createProduct, deleteProduct, getCategories } from "../services/api";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", barcode: "", selling_price: "", cost_price: "", category: "" });
  const [showForm, setShowForm] = useState(false);

  const loadProducts = () => getProducts().then((res) => setProducts(res.data.results || res.data));

  useEffect(() => {
    loadProducts();
    getCategories().then((res) => setCategories(res.data.results || res.data));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createProduct(form);
    setForm({ name: "", barcode: "", selling_price: "", cost_price: "", category: "" });
    setShowForm(false);
    loadProducts();
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this product?")) {
      await deleteProduct(id);
      loadProducts();
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Products</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="bi bi-plus-lg"></i> New Product
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <input name="name" placeholder="Product name" value={form.name} onChange={handleChange} required />
          <input name="barcode" placeholder="Barcode" value={form.barcode} onChange={handleChange} required />
          <input name="cost_price" type="number" placeholder="Cost price" value={form.cost_price} onChange={handleChange} />
          <input name="selling_price" type="number" placeholder="Selling price" value={form.selling_price} onChange={handleChange} required />
          <select name="category" value={form.category} onChange={handleChange}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">Save</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Barcode</th>
            <th>Stock</th>
            <th>Cost</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.barcode}</td>
              <td>
                {p.quantity_in_stock}{" "}
                {p.is_low_stock && <span className="pill danger">Low stock</span>}
              </td>
              <td>KES {p.cost_price}</td>
              <td>KES {p.selling_price}</td>
              <td>
                <button className="btn btn-outline" onClick={() => handleDelete(p.id)}>
                  <i className="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}