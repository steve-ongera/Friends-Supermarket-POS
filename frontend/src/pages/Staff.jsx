import React, { useEffect, useState } from "react";
import { getStaff, createStaff, deleteStaff } from "../services/api";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", role: "CASHIER", phone_number: "" });
  const [showForm, setShowForm] = useState(false);

  const load = () => getStaff().then((res) => setStaff(res.data.results || res.data));

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Staff</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="bi bi-plus-lg"></i> Add Staff
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <input name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
          <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
          <input name="phone_number" placeholder="Phone number" value={form.phone_number} onChange={handleChange} />
          <select name="role" value={form.role} onChange={handleChange}>
            <option value="CASHIER">Cashier</option>
            <option value="MANAGER">Manager</option>
          </select>
          <button className="btn btn-primary" type="submit">Save</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Username</th><th>Role</th><th>Phone</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <td>{s.full_name}</td>
              <td><span className="pill warning">{s.role}</span></td>
              <td>{s.phone_number}</td>
              <td>
                <span className={`pill ${s.is_locked ? "danger" : "success"}`}>
                  {s.is_locked ? "Locked" : "Active"}
                </span>
              </td>
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