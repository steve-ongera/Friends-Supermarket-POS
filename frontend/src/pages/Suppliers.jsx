import React, { useEffect, useState } from "react";
import { getSuppliers, createSupplier, deleteSupplier } from "../services/api";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: "", phone_number: "", email: "" });

  const load = () => getSuppliers().then((res) => setSuppliers(res.data.results || res.data));

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

  return (
    <div>
      <h2>Suppliers</h2>

      <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <input name="name" placeholder="Supplier name" value={form.name} onChange={handleChange} required />
        <input name="phone_number" placeholder="Phone number" value={form.phone_number} onChange={handleChange} />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <button className="btn btn-primary" type="submit">Add Supplier</button>
      </form>

      <table className="data-table">
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th></th></tr></thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.phone_number}</td>
              <td>{s.email}</td>
              <td>
                <button className="btn btn-outline" onClick={() => handleDelete(s.id)}>
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