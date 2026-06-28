import React, { useEffect, useState } from "react";
import { getCategories, createCategory, deleteCategory } from "../services/api";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");

  const load = () => getCategories().then((res) => setCategories(res.data.results || res.data));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createCategory({ name });
    setName("");
    load();
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this category?")) {
      await deleteCategory(id);
      load();
    }
  };

  return (
    <div>
      <h2>Categories</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)" }} />
        <button className="btn btn-primary" type="submit"><i className="bi bi-plus-lg"></i> Add</button>
      </form>

      <table className="data-table">
        <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.description}</td>
              <td>
                <button className="btn btn-outline" onClick={() => handleDelete(c.id)}>
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