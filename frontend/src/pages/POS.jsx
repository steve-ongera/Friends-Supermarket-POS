import React, { useEffect, useRef, useState } from "react";
import { lookupProductByBarcode, createSale, getProducts } from "../services/api";
import { useSession } from "../context/SessionContext.jsx";
import { useNavigate } from "react-router-dom";

export default function POS() {
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]); // [{ product_id, name, unit_price, quantity }]
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  // --- Product grid (always visible, click-to-add — modern POS style) ---
  const [allProducts, setAllProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [justAddedId, setJustAddedId] = useState(null);

  const inputRef = useRef(null);
  const { refreshSession, setShowUnlockModal } = useSession();
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  // Load the full product catalog once — shown automatically as a grid
  useEffect(() => {
    setLoadingProducts(true);
    getProducts()
      .then((res) => setAllProducts(res.data.results || res.data))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  const addProductToCart = (product) => {
    const sellingPrice = parseFloat(product.selling_price);
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          unit_price: sellingPrice,
          quantity: 1,
        },
      ];
    });

    // brief visual confirmation on the clicked product card
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId(null), 500);
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    setError("");
    try {
      const res = await lookupProductByBarcode(barcode.trim());
      addProductToCart(res.data);
    } catch {
      setError(`No product found for barcode "${barcode}". Click it from the product list below instead.`);
    } finally {
      setBarcode("");
      inputRef.current?.focus();
    }
  };

  const updateQty = (productId, qty) => {
    if (qty < 1) return;
    setCart((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity: qty } : i))
    );
  };

  const increaseQty = (productId) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i
      )
    );
  };

  const decreaseQty = (productId) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product_id === productId && i.quantity > 1
          ? { ...i, quantity: i.quantity - 1 }
          : i
      )
    );
  };

  const removeItem = (productId) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setPlacingOrder(true);
    setError("");
    try {
      const res = await createSale({
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_method: paymentMethod,
        amount_tendered: amountTendered || null,
      });
      setCart([]);
      setAmountTendered("");
      await refreshSession();
      navigate(`/receipt/${res.data.id}`);
    } catch (err) {
      if (err.response?.status === 402) {
        setShowUnlockModal(true);
      } else {
        setError(err.response?.data?.detail || "Checkout failed.");
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  const filteredProducts = allProducts.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode || "").toLowerCase().includes(q) ||
      (p.category_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: "700",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          <i className="bi bi-cart4" style={{ marginRight: "8px" }}></i>
          Point of Sale
        </h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            borderRadius: "999px",
            fontSize: "0.8rem",
            fontWeight: 600,
            background: "#eef1f4",
            color: "#4b5563",
          }}
        >
          <i className="bi bi-clock"></i> {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "20px",
          alignItems: "start",
        }}
        className="pos-grid-layout"
      >
        {/* Left: Scanner + always-visible product grid */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <form onSubmit={handleScan} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
            <input
              ref={inputRef}
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcode here..."
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #e2e6ea",
                fontSize: "0.95rem",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "12px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#1d6f42",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <i className="bi bi-upc-scan"></i> Scan
            </button>
          </form>

          {error && (
            <div
              style={{
                background: "#fdecec",
                color: "#e03131",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                marginBottom: "14px",
              }}
            >
              <i className="bi bi-exclamation-circle" style={{ marginRight: "6px" }}></i>
              {error}
            </div>
          )}

          <input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Or search a product by name / category..."
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #e2e6ea",
              fontSize: "0.9rem",
              marginBottom: "14px",
            }}
          />

          {/* Auto-shown product grid — click any card to add to cart */}
          {loadingProducts ? (
            <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading products...</p>
          ) : filteredProducts.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>No matching products.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "10px",
                maxHeight: "460px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {filteredProducts.map((p) => {
                const lowStock = p.is_low_stock;
                const justAdded = justAddedId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToCart(p)}
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      borderRadius: "10px",
                      border: justAdded ? "2px solid #1d6f42" : "1px solid #e2e6ea",
                      background: justAdded ? "#e8f5ee" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minHeight: "92px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#1f2933",
                        lineHeight: 1.3,
                      }}
                    >
                      {p.name}
                    </span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1d6f42" }}>
                      KES {parseFloat(p.selling_price).toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: lowStock ? "#e03131" : "#6b7280",
                        fontWeight: lowStock ? 600 : 400,
                      }}
                    >
                      {lowStock && <i className="bi bi-exclamation-triangle" style={{ marginRight: 3 }}></i>}
                      {p.quantity_in_stock} {p.unit} left
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Cart + Checkout */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            position: "sticky",
            top: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem" }}>
              <i className="bi bi-cart-check" style={{ marginRight: "6px" }}></i> Cart
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#1a56db",
                background: "#e8f0fe",
                padding: "3px 10px",
                borderRadius: "999px",
              }}
            >
              {cart.length} item{cart.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ maxHeight: "260px", overflowY: "auto", marginBottom: "16px" }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#6b7280" }}>
                <i className="bi bi-cart" style={{ fontSize: "2.2rem", display: "block", marginBottom: "10px" }}></i>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  Scan a barcode or click a product to add it here.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #e2e6ea",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{item.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      KES {item.unit_price.toFixed(2)} each
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Quantity controls */}
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "4px",
                      border: "1px solid #e2e6ea",
                      borderRadius: "6px",
                      overflow: "hidden"
                    }}>
                      <button
                        onClick={() => decreaseQty(item.product_id)}
                        disabled={item.quantity <= 1}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: "4px 8px",
                          cursor: item.quantity <= 1 ? "not-allowed" : "pointer",
                          color: item.quantity <= 1 ? "#ccc" : "#4b5563",
                          fontSize: "0.9rem",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (item.quantity > 1) {
                            e.currentTarget.style.background = "#f0f0f0";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <i className="bi bi-dash"></i>
                      </button>
                      
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) {
                            updateQty(item.product_id, val);
                          }
                        }}
                        style={{
                          width: "40px",
                          padding: "4px 2px",
                          border: "none",
                          borderLeft: "1px solid #e2e6ea",
                          borderRight: "1px solid #e2e6ea",
                          fontSize: "0.8rem",
                          textAlign: "center",
                          background: "#f9fafb",
                          outline: "none",
                          borderRadius: 0,
                        }}
                      />
                      
                      <button
                        onClick={() => increaseQty(item.product_id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: "4px 8px",
                          cursor: "pointer",
                          color: "#4b5563",
                          fontSize: "0.9rem",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <i className="bi bi-plus"></i>
                      </button>
                    </div>
                    
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", minWidth: "70px", textAlign: "right" }}>
                      KES {(item.unit_price * item.quantity).toFixed(2)}
                    </div>
                    
                    <button
                      onClick={() => removeItem(item.product_id)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#e03131",
                        cursor: "pointer",
                        fontSize: "1rem",
                        padding: "4px",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#b71c1c";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#e03131";
                      }}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              background: "#e8f5ee",
              padding: "14px",
              borderRadius: "10px",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>SUBTOTAL</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#1d6f42", letterSpacing: "-0.02em" }}>
              KES {subtotal.toFixed(2)}
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #e2e6ea",
                fontSize: "0.9rem",
              }}
            >
              <option value="CASH">Cash</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CARD">Card</option>
            </select>
          </div>

          {paymentMethod === "CASH" && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>
                Amount Tendered
              </label>
              <input
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder="Enter amount tendered"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e6ea",
                  fontSize: "0.9rem",
                }}
              />
              {amountTendered && parseFloat(amountTendered) > 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: parseFloat(amountTendered) >= subtotal ? "#2f9e44" : "#e03131",
                  }}
                >
                  {parseFloat(amountTendered) >= subtotal ? (
                    <>
                      <i className="bi bi-check-circle"></i> Change: KES {(parseFloat(amountTendered) - subtotal).toFixed(2)}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-exclamation-triangle"></i> Balance due: KES {(subtotal - parseFloat(amountTendered)).toFixed(2)}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {paymentMethod === "MPESA" && (
            <div
              style={{
                background: "#fff4e0",
                padding: "10px 12px",
                borderRadius: "8px",
                marginBottom: "14px",
                fontSize: "0.8rem",
                color: "#4b5563",
              }}
            >
              <i className="bi bi-info-circle"></i> Customer will receive an M-Pesa STK Push prompt.
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || placingOrder}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "8px",
              border: "none",
              background: cart.length === 0 || placingOrder ? "#9bbfa8" : "#1d6f42",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: cart.length === 0 || placingOrder ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {placingOrder ? (
              <>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                ></span>
                Processing...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle"></i> Complete Sale
              </>
            )}
          </button>

          {cart.length > 0 && (
            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop: "1px solid #eef1f4",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.78rem",
                color: "#6b7280",
              }}
            >
              <span>Line items: {cart.length}</span>
              <span>Units total: {cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .pos-grid-layout { grid-template-columns: 1fr !important; }
        }
        /* Hide number input arrows */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}