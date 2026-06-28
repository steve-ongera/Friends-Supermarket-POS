import React, { useEffect, useState } from "react";
import { getProducts, createProduct, deleteProduct, getCategories } from "../services/api";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", barcode: "", selling_price: "", cost_price: "", category: "" });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadProducts = () => {
    setLoading(true);
    return getProducts()
      .then((res) => setProducts(res.data.results || res.data))
      .finally(() => setLoading(false));
  };

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

  // Filter products based on search
  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
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
          <i className="bi bi-box-seam" style={{ marginRight: "8px" }}></i>
          Products
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span className="pill info">
            <i className="bi bi-box"></i> {products.length} products
          </span>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-plus-lg"}`}></i> 
            {showForm ? "Cancel" : "New Product"}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ 
          display: "flex", 
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "flex-end"
        }}>
          <div className="form-group" style={{ flex: "1", minWidth: "200px", marginBottom: 0 }}>
            <label htmlFor="searchProducts">
              <i className="bi bi-search"></i> Search Products
            </label>
            <input
              id="searchProducts"
              className="form-control"
              type="text"
              placeholder="Search by name or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {filteredProducts.length !== products.length && (
              <span>Showing {filteredProducts.length} of {products.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="card-header">
            <h3><i className="bi bi-plus-circle"></i> Add New Product</h3>
            <span className="card-action">Required fields *</span>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
              gap: "16px",
              alignItems: "end"
            }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productName">Product Name *</label>
                <input
                  id="productName"
                  name="name"
                  className="form-control"
                  placeholder="Enter product name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productBarcode">Barcode *</label>
                <input
                  id="productBarcode"
                  name="barcode"
                  className="form-control"
                  placeholder="Enter barcode"
                  value={form.barcode}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productCost">Cost Price</label>
                <input
                  id="productCost"
                  name="cost_price"
                  className="form-control"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.cost_price}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productPrice">Selling Price *</label>
                <input
                  id="productPrice"
                  name="selling_price"
                  className="form-control"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.selling_price}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productCategory">Category</label>
                <select
                  id="productCategory"
                  name="category"
                  className="form-control"
                  value={form.category}
                  onChange={handleChange}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  <i className="bi bi-check-lg"></i> Save Product
                </button>
                <button 
                  className="btn btn-secondary" 
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading products...</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Barcode</th>
                  <th>Stock</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Profit</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                      <i className="bi bi-box" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                      {products.length === 0 ? "No products found. Add your first product!" : "No products match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const profit = p.selling_price - p.cost_price;
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: "500" }}>{p.name}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{p.barcode}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: "600" }}>{p.quantity_in_stock || 0}</span>
                            {p.is_low_stock && <span className="pill danger">Low stock</span>}
                          </div>
                        </td>
                        <td style={{ color: "var(--color-text-muted)" }}>{formatCurrency(p.cost_price)}</td>
                        <td style={{ fontWeight: "600", color: "var(--color-primary)" }}>
                          {formatCurrency(p.selling_price)}
                        </td>
                        <td>
                          <span className={`pill ${profit > 0 ? "success" : "danger"}`}>
                            {formatCurrency(profit)}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                              title="Edit product"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                              onClick={() => handleDelete(p.id)}
                              title="Delete product"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary footer */}
      {!loading && products.length > 0 && (
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
                Total Products
              </span>
              <div style={{ fontWeight: "700" }}>{products.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Low Stock
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-danger)" }}>
                {products.filter(p => p.is_low_stock).length}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                In Stock
              </span>
              <div style={{ fontWeight: "700", color: "var(--color-success)" }}>
                {products.reduce((sum, p) => sum + (p.quantity_in_stock || 0), 0)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                Categories
              </span>
              <div style={{ fontWeight: "700" }}>{categories.length}</div>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {filteredProducts.length !== products.length && (
              <span>Showing {filteredProducts.length} of {products.length} products</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}