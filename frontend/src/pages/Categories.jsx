import React, { useEffect, useState } from "react";
import { getCategories, createCategory, deleteCategory } from "../services/api";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const load = () => {
    setLoading(true);
    return getCategories()
      .then((res) => setCategories(res.data.results || res.data))
      .finally(() => setLoading(false));
  };

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

  // Filter categories based on search
  const filteredCategories = categories.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <i className="bi bi-tags" style={{ marginRight: "8px" }}></i>
          Categories
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span className="pill info">
            <i className="bi bi-tag"></i> {categories.length} categories
          </span>
        </div>
      </div>

      {/* Add Category Form */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3><i className="bi bi-plus-circle"></i> Add New Category</h3>
          <span className="card-action">Create product category</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ 
            display: "flex", 
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "flex-end"
          }}>
            <div className="form-group" style={{ flex: "1", minWidth: "200px", marginBottom: 0 }}>
              <label htmlFor="categoryName">Category Name *</label>
              <input
                id="categoryName"
                className="form-control"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter category name"
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ height: "42px", minWidth: "120px" }}>
              <i className="bi bi-plus-lg"></i> Add Category
            </button>
          </div>
        </form>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ 
          display: "flex", 
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <div className="form-group" style={{ flex: "1", minWidth: "200px", marginBottom: 0 }}>
            <label htmlFor="searchCategories">
              <i className="bi bi-search"></i> Search Categories
            </label>
            <input
              id="searchCategories"
              className="form-control"
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {filteredCategories.length !== categories.length && (
              <span>Showing {filteredCategories.length} of {categories.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Categories Table */}
      {loading ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading categories...</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Products</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                      <i className="bi bi-tags" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                      {categories.length === 0 ? "No categories found. Create your first category!" : "No categories match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: "600" }}>
                        <span className="pill neutral">
                          <i className="bi bi-tag" style={{ marginRight: "4px" }}></i>
                          {c.name}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>
                        {c.description || "—"}
                      </td>
                      <td>
                        <span className="pill info">
                          {c.product_count || 0} products
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            title="Edit category"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            onClick={() => handleDelete(c.id)}
                            title="Delete category"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
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
      {!loading && categories.length > 0 && (
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
                Total Categories
              </span>
              <div style={{ fontWeight: "700" }}>{categories.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Total Products
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-primary)" }}>
                {categories.reduce((sum, c) => sum + (c.product_count || 0), 0)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Categories with Products
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-success)" }}>
                {categories.filter(c => (c.product_count || 0) > 0).length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Empty Categories
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-text-muted)" }}>
                {categories.filter(c => (c.product_count || 0) === 0).length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {filteredCategories.length !== categories.length && (
              <span>Showing {filteredCategories.length} of {categories.length} categories</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}