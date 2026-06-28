import React, { useEffect, useState } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getSuppliers,
} from "../services/api";

const EMPTY_FORM = {
  name: "",
  barcode: "",
  sku: "",
  unit: "pcs",
  selling_price: "",
  cost_price: "",
  quantity_in_stock: "",
  reorder_level: "",
  category: "",
  supplier: "",
  is_active: true,
  image: null,
};

const UNIT_OPTIONS = ["pcs", "kg", "g", "litre", "ml", "pack", "tray", "box", "dozen"];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = creating, otherwise = product.id being edited
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    getSuppliers().then((res) => setSuppliers(res.data.results || res.data));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, image: file }));
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setImagePreview(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        category: form.category || null,
        supplier: form.supplier || null,
      };
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await createProduct(payload);
      }
      resetForm();
      loadProducts();
    } catch (err) {
      alert(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : "Failed to save product. Please check the form and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Populate the form with the clicked product's data and open it in edit mode
  const handleEditClick = (product) => {
    setForm({
      name: product.name || "",
      barcode: product.barcode || "",
      sku: product.sku || "",
      unit: product.unit || "pcs",
      selling_price: product.selling_price ?? "",
      cost_price: product.cost_price ?? "",
      quantity_in_stock: product.quantity_in_stock ?? "",
      reorder_level: product.reorder_level ?? "",
      category: product.category || "",
      supplier: product.supplier || "",
      is_active: product.is_active ?? true,
      image: null, // existing image stays unless a new file is chosen
    });
    setImagePreview(product.image || null);
    setEditingId(product.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this product?")) {
      await deleteProduct(id);
      if (editingId === id) resetForm();
      loadProducts();
    }
  };

  const toggleNewProductForm = () => {
    if (showForm) {
      resetForm();
    } else {
      setForm(EMPTY_FORM);
      setImagePreview(null);
      setEditingId(null);
      setShowForm(true);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <button className="btn btn-primary" onClick={toggleNewProductForm}>
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
              placeholder="Search by name, barcode, or SKU..."
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

      {/* Add / Edit Product Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="card-header">
            <h3>
              <i className={`bi ${editingId ? "bi-pencil-square" : "bi-plus-circle"}`}></i>{" "}
              {editingId ? "Edit Product" : "Add New Product"}
            </h3>
            <span className="card-action">Required fields *</span>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "16px",
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
                <label htmlFor="productSku">SKU</label>
                <input
                  id="productSku"
                  name="sku"
                  className="form-control"
                  placeholder="Optional internal SKU"
                  value={form.sku}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productUnit">Unit of Measure</label>
                <select
                  id="productUnit"
                  name="unit"
                  className="form-control"
                  value={form.unit}
                  onChange={handleChange}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productCost">Cost Price (KES)</label>
                <input
                  id="productCost"
                  name="cost_price"
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.cost_price}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productPrice">Selling Price (KES) *</label>
                <input
                  id="productPrice"
                  name="selling_price"
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.selling_price}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productStock">
                  {editingId ? "Quantity in Stock" : "Opening Stock Quantity"}
                </label>
                <input
                  id="productStock"
                  name="quantity_in_stock"
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={form.quantity_in_stock}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productReorderLevel">Reorder Level</label>
                <input
                  id="productReorderLevel"
                  name="reorder_level"
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="5"
                  value={form.reorder_level}
                  onChange={handleChange}
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productSupplier">Supplier</label>
                <select
                  id="productSupplier"
                  name="supplier"
                  className="form-control"
                  value={form.supplier}
                  onChange={handleChange}
                >
                  <option value="">No supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="productImage">Product Image</label>
                <input
                  id="productImage"
                  name="image"
                  className="form-control"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ marginTop: "8px", width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--color-border)" }}
                  />
                )}
              </div>

              <div
                className="form-group"
                style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  id="productIsActive"
                  name="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={handleChange}
                  style={{ width: "18px", height: "18px" }}
                />
                <label htmlFor="productIsActive" style={{ marginBottom: 0 }}>
                  Active (visible at POS)
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <i className="bi bi-check-lg"></i>{" "}
                {saving ? "Saving..." : editingId ? "Update Product" : "Save Product"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={resetForm}>
                <i className="bi bi-x-lg"></i> Cancel
              </button>
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
                  <th>Barcode / SKU</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Profit</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                      <i className="bi bi-box" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                      {products.length === 0 ? "No products found. Add your first product!" : "No products match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const profit = p.selling_price - p.cost_price;
                    const isBeingEdited = editingId === p.id;
                    return (
                      <tr key={p.id} style={isBeingEdited ? { background: "var(--color-primary-light)" } : undefined}>
                        <td style={{ fontWeight: "500" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {p.image && (
                              <img
                                src={p.image}
                                alt={p.name}
                                style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "6px" }}
                              />
                            )}
                            {p.name}
                          </div>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {p.barcode}
                          {p.sku && <div style={{ color: "var(--color-text-muted)" }}>SKU: {p.sku}</div>}
                        </td>
                        <td>{p.unit}</td>
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
                        <td>
                          <span className={`pill ${p.is_active ? "success" : "neutral"}`}>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                              title="Edit product"
                              type="button"
                              onClick={() => handleEditClick(p)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                              onClick={() => handleDelete(p.id)}
                              title="Delete product"
                              type="button"
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
                {products.reduce((sum, p) => sum + Number(p.quantity_in_stock || 0), 0)}
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