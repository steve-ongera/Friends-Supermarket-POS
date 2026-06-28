import React, { useRef, useState } from "react";
import { lookupProductByBarcode, createSale } from "../services/api";
import { useSession } from "../context/SessionContext.jsx";
import { useNavigate } from "react-router-dom";

export default function POS() {
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]); // [{ product_id, name, unit_price, quantity }]
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  const inputRef = useRef(null);
  const { refreshSession, setShowUnlockModal } = useSession();
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    setError("");
    try {
      const res = await lookupProductByBarcode(barcode.trim());
      const product = res.data;

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
            unit_price: parseFloat(product.selling_price),
            quantity: 1,
          },
        ];
      });
    } catch {
      setError(`No product found for barcode "${barcode}"`);
    } finally {
      setBarcode("");
      inputRef.current?.focus();
    }
  };

  const updateQty = (productId, qty) => {
    setCart((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity: Math.max(qty, 1) } : i))
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

  return (
    <div>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "24px"
      }}>
        <h2 style={{ 
          fontSize: "1.5rem", 
          fontWeight: "700", 
          margin: 0,
          letterSpacing: "-0.02em"
        }}>
          <i className="bi bi-cart4" style={{ marginRight: "8px" }}></i>
          Point of Sale
        </h2>
        <div style={{ 
          fontSize: "0.85rem", 
          color: "var(--color-text-muted)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span className="pill neutral">
            <i className="bi bi-clock"></i> {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="pos-layout">
        {/* Left: Scan + Cart */}
        <div className="card">
          <div className="card-header">
            <h3><i className="bi bi-upc-scan"></i> Scan Products</h3>
            <span className="card-action">{cart.length} items</span>
          </div>

          <form onSubmit={handleScan} style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <input
              ref={inputRef}
              autoFocus
              className="form-control"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type barcode..."
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit">
              <i className="bi bi-upc-scan"></i> Add
            </button>
          </form>

          {error && (
            <div style={{ 
              background: "var(--color-danger-light)", 
              color: "var(--color-danger)",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.875rem",
              marginBottom: "16px"
            }}>
              <i className="bi bi-exclamation-circle" style={{ marginRight: "6px" }}></i>
              {error}
            </div>
          )}

          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {cart.length === 0 ? (
              <div style={{ 
                textAlign: "center", 
                padding: "40px 20px",
                color: "var(--color-text-muted)"
              }}>
                <i className="bi bi-cart" style={{ fontSize: "2.5rem", display: "block", marginBottom: "12px" }}></i>
                <p style={{ margin: 0 }}>Cart is empty. Scan a product to begin.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div className="pos-cart-item" key={item.product_id}>
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-meta">
                      KES {item.unit_price.toFixed(2)} each
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQty(item.product_id, parseFloat(e.target.value))}
                      className="form-control"
                      style={{ width: "60px", padding: "4px 6px", fontSize: "0.85rem" }}
                    />
                    <div className="item-price">KES {(item.unit_price * item.quantity).toFixed(2)}</div>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => removeItem(item.product_id)}
                      style={{ color: "var(--color-danger)" }}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Checkout panel */}
        <div className="card">
          <div className="card-header">
            <h3><i className="bi bi-receipt"></i> Order Summary</h3>
            <span className="card-action">
              <span className="pill info">{cart.length} items</span>
            </span>
          </div>

          <div style={{ 
            background: "var(--color-primary-50)",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            marginBottom: "20px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
              SUBTOTAL
            </div>
            <div style={{ 
              fontSize: "2rem", 
              fontWeight: "700", 
              color: "var(--color-primary)",
              letterSpacing: "-0.02em"
            }}>
              KES {subtotal.toFixed(2)}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="paymentMethod">Payment Method</label>
            <select
              id="paymentMethod"
              className="form-control"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CARD">Card</option>
            </select>
          </div>

          {paymentMethod === "CASH" && (
            <div className="form-group">
              <label htmlFor="amountTendered">Amount Tendered</label>
              <input
                id="amountTendered"
                className="form-control"
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder="Enter amount tendered"
              />
              {amountTendered && parseFloat(amountTendered) > 0 && (
                <div style={{ 
                  marginTop: "8px",
                  fontSize: "0.85rem",
                  color: parseFloat(amountTendered) >= subtotal ? "var(--color-success)" : "var(--color-danger)",
                  fontWeight: "600"
                }}>
                  {parseFloat(amountTendered) >= subtotal ? (
                    <><i className="bi bi-check-circle"></i> Change: KES {(parseFloat(amountTendered) - subtotal).toFixed(2)}</>
                  ) : (
                    <><i className="bi bi-exclamation-triangle"></i> Balance due: KES {(subtotal - parseFloat(amountTendered)).toFixed(2)}</>
                  )}
                </div>
              )}
            </div>
          )}

          {paymentMethod === "MPESA" && (
            <div style={{ 
              background: "var(--color-warning-light)",
              padding: "12px",
              borderRadius: "var(--radius-sm)",
              marginBottom: "16px",
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)"
            }}>
              <i className="bi bi-info-circle"></i> M-Pesa payment will be processed via STK Push
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ 
              width: "100%", 
              justifyContent: "center",
              padding: "14px",
              fontSize: "1rem"
            }}
            disabled={cart.length === 0 || placingOrder}
            onClick={handleCheckout}
          >
            {placingOrder ? (
              <>
                <span className="loader-spinner" style={{ 
                  width: "20px", 
                  height: "20px", 
                  borderWidth: "2px",
                  marginRight: "8px"
                }}></span>
                Processing...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle"></i> Complete Sale
              </>
            )}
          </button>

          {cart.length > 0 && (
            <div style={{ 
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid var(--color-border-light)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.85rem",
              color: "var(--color-text-muted)"
            }}>
              <span>Items: {cart.length}</span>
              <span>Items total: {cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}