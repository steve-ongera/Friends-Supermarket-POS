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
      <h2>Point of Sale</h2>

      <div className="pos-layout">
        {/* Left: Scan + Cart */}
        <div className="card">
          <form onSubmit={handleScan} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              ref={inputRef}
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type barcode..."
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)" }}
            />
            <button className="btn btn-primary" type="submit">
              <i className="bi bi-upc-scan"></i> Add
            </button>
          </form>

          {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

          {cart.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>Cart is empty. Scan a product to begin.</p>
          ) : (
            cart.map((item) => (
              <div className="pos-cart-item" key={item.product_id}>
                <div>
                  <strong>{item.name}</strong>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                    KES {item.unit_price.toFixed(2)} each
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQty(item.product_id, parseFloat(e.target.value))}
                    style={{ width: 60, padding: 6, borderRadius: 6, border: "1px solid var(--color-border)" }}
                  />
                  <strong>KES {(item.unit_price * item.quantity).toFixed(2)}</strong>
                  <button className="btn btn-outline" onClick={() => removeItem(item.product_id)}>
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Checkout panel */}
        <div className="card">
          <h3>Order Summary</h3>
          <p style={{ fontSize: "1.4rem", fontWeight: 700 }}>KES {subtotal.toFixed(2)}</p>

          <label>Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--color-border)", marginBottom: 12 }}
          >
            <option value="CASH">Cash</option>
            <option value="MPESA">M-Pesa</option>
            <option value="CARD">Card</option>
          </select>

          {paymentMethod === "CASH" && (
            <>
              <label>Amount Tendered</label>
              <input
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--color-border)", marginBottom: 12 }}
              />
            </>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={cart.length === 0 || placingOrder}
            onClick={handleCheckout}
          >
            {placingOrder ? "Processing..." : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}