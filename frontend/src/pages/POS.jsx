import React, { useEffect, useRef, useState } from "react";
import {
  lookupProductByBarcode,
  createSale,
  getProducts,
  initiateSTKPush,
  getPaymentStatus,
} from "../services/api";
import { useSession } from "../context/SessionContext.jsx";
import { useNavigate } from "react-router-dom";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // ~2 minutes before we tell the cashier to force-check or retry

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

  // --- M-Pesa STK push state ---
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaStatus, setMpesaStatus] = useState("idle"); // idle | sending | pending | success | failed
  const [mpesaPayment, setMpesaPayment] = useState(null); // payment object from backend
  const [mpesaError, setMpesaError] = useState("");
  const pollTimerRef = useRef(null);
  const pollAttemptsRef = useRef(0);

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

  // Clean up any active poll timer on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const resetMpesaFlow = () => {
    stopPolling();
    pollAttemptsRef.current = 0;
    setMpesaStatus("idle");
    setMpesaPayment(null);
    setMpesaError("");
  };

  // Reset the M-Pesa flow whenever the cart changes after a completed/failed attempt,
  // or when the cashier switches payment method away from MPESA.
  useEffect(() => {
    if (paymentMethod !== "MPESA") {
      resetMpesaFlow();
    }
  }, [paymentMethod]);

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
          image: product.image || null,
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

  // Finalizes the sale in the backend (stock deduction, receipt, etc).
  // Shared by both the CASH/CARD path and the post-MPESA-success path.
  const finalizeSale = async (extra = {}) => {
    setPlacingOrder(true);
    setError("");
    try {
      const res = await createSale({
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_method: paymentMethod,
        amount_tendered: amountTendered || null,
        ...extra,
      });
      setCart([]);
      setAmountTendered("");
      resetMpesaFlow();
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

  // --- M-Pesa STK push flow ---

  const handleSendStkPush = async () => {
    const phoneDigits = mpesaPhone.replace(/\D/g, "");
    if (!phoneDigits) {
      setMpesaError("Enter the customer's phone number first.");
      return;
    }
    if (cart.length === 0) {
      setMpesaError("Add items to the cart before charging M-Pesa.");
      return;
    }

    setMpesaStatus("sending");
    setMpesaError("");

    try {
      const res = await initiateSTKPush({
        phone_number: mpesaPhone,
        amount: subtotal,
        purpose: "SALE",
      });
      setMpesaPayment(res.data.payment);
      setMpesaStatus("pending");
      pollAttemptsRef.current = 0;
      pollPaymentStatus(res.data.payment.reference_code);
    } catch (err) {
      setMpesaStatus("failed");
      setMpesaError(
        err.response?.data?.detail ||
          "Could not send the M-Pesa prompt. Check the number and try again."
      );
    }
  };

  const pollPaymentStatus = (referenceCode) => {
    stopPolling();
    pollTimerRef.current = setTimeout(async () => {
      pollAttemptsRef.current += 1;
      try {
        const res = await getPaymentStatus(referenceCode);
        const payment = res.data;
        setMpesaPayment(payment);

        if (payment.status === "SUCCESS") {
          setMpesaStatus("success");
          stopPolling();
          // Auto-complete the sale once payment is confirmed
          finalizeSale({ payment_reference: payment.reference_code });
          return;
        }
        if (payment.status === "FAILED") {
          setMpesaStatus("failed");
          setMpesaError(payment.result_desc || "Payment failed or was cancelled on the customer's phone.");
          stopPolling();
          return;
        }

        // still PENDING
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setMpesaStatus("pending"); // stays pending, but we stop auto-polling
          setMpesaError(
            "Still waiting on confirmation. If the customer has already paid, use 'Force confirm paid' below, or switch to cash."
          );
          stopPolling();
          return;
        }

        pollPaymentStatus(referenceCode);
      } catch {
        // Network blip — keep trying until max attempts
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          stopPolling();
          setMpesaError("Lost connection while checking payment status. Try 'Check again' below.");
        } else {
          pollPaymentStatus(referenceCode);
        }
      }
    }, POLL_INTERVAL_MS);
  };

  const handleCheckAgain = () => {
    if (!mpesaPayment?.reference_code) return;
    setMpesaError("");
    pollAttemptsRef.current = 0;
    pollPaymentStatus(mpesaPayment.reference_code);
  };

  // Manual override: cashier has visually confirmed with the customer that
  // the M-Pesa payment went through (e.g. customer shows the SMS) even though
  // our callback/poll hasn't caught up yet. Completes the sale immediately.
  const handleForceConfirmPaid = () => {
    stopPolling();
    finalizeSale({
      payment_reference: mpesaPayment?.reference_code || "",
      force_confirmed: true,
    });
  };

  const handleRetryStkPush = () => {
    resetMpesaFlow();
  };

  const handleSwitchToCash = () => {
    resetMpesaFlow();
    setPaymentMethod("CASH");
  };

  // --- Main checkout button handler ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === "MPESA") {
      // For M-Pesa, "Complete Sale" doesn't fire directly — the STK push
      // button drives the flow, and finalizeSale() runs automatically once
      // payment is confirmed (or via Force confirm).
      return;
    }

    finalizeSale();
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

  const mpesaBusy = mpesaStatus === "sending" || mpesaStatus === "pending";

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
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        style={{
                          width: "100%",
                          height: "64px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          marginBottom: "4px",
                          background: "#f3f4f6",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "64px",
                          borderRadius: "6px",
                          marginBottom: "4px",
                          background: "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#c1c7cd",
                        }}
                      >
                        <i className="bi bi-image" style={{ fontSize: "1.4rem" }}></i>
                      </div>
                    )}
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
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: "32px",
                          height: "32px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          flexShrink: 0,
                          background: "#f3f4f6",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          flexShrink: 0,
                          background: "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#c1c7cd",
                        }}
                      >
                        <i className="bi bi-image" style={{ fontSize: "0.8rem" }}></i>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{item.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        KES {item.unit_price.toFixed(2)} each
                      </div>
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
              disabled={mpesaBusy}
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

          {/* --- M-Pesa flow --- */}
          {paymentMethod === "MPESA" && (
            <div
              style={{
                background: "#fff4e0",
                padding: "14px",
                borderRadius: "10px",
                marginBottom: "14px",
                fontSize: "0.85rem",
                color: "#4b5563",
              }}
            >
              {mpesaStatus === "idle" && (
                <>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px" }}>
                    Customer Phone Number
                  </label>
                  <input
                    type="tel"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    placeholder="0712345678"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e6ea",
                      fontSize: "0.9rem",
                      marginBottom: "10px",
                    }}
                  />
                  {mpesaError && (
                    <div style={{ color: "#e03131", fontSize: "0.8rem", marginBottom: "10px" }}>
                      <i className="bi bi-exclamation-circle" style={{ marginRight: 4 }}></i>
                      {mpesaError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSendStkPush}
                    disabled={cart.length === 0}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      background: cart.length === 0 ? "#e0c08a" : "#f59f00",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: cart.length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    <i className="bi bi-phone" style={{ marginRight: 6 }}></i>
                    Send STK Push (KES {subtotal.toFixed(2)})
                  </button>
                </>
              )}

              {mpesaStatus === "sending" && (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <i className="bi bi-arrow-repeat" style={{ marginRight: 6 }}></i>
                  Sending prompt to {mpesaPhone}...
                </div>
              )}

              {mpesaStatus === "pending" && (
                <div>
                  <div style={{ textAlign: "center", marginBottom: "10px" }}>
                    <i className="bi bi-hourglass-split" style={{ marginRight: 6 }}></i>
                    Waiting for {mpesaPhone} to approve the M-Pesa prompt...
                  </div>
                  {mpesaError && (
                    <div style={{ color: "#e03131", fontSize: "0.8rem", marginBottom: "10px" }}>
                      <i className="bi bi-exclamation-circle" style={{ marginRight: 4 }}></i>
                      {mpesaError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <button
                      type="button"
                      onClick={handleCheckAgain}
                      style={{
                        flex: 1,
                        padding: "9px",
                        borderRadius: "8px",
                        border: "1px solid #f59f00",
                        background: "transparent",
                        color: "#b06400",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      <i className="bi bi-arrow-clockwise" style={{ marginRight: 4 }}></i>
                      Check again
                    </button>
                    <button
                      type="button"
                      onClick={handleForceConfirmPaid}
                      disabled={placingOrder}
                      style={{
                        flex: 1,
                        padding: "9px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#2f9e44",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: placingOrder ? "not-allowed" : "pointer",
                      }}
                      title="Use only if the customer has shown you their M-Pesa confirmation SMS"
                    >
                      <i className="bi bi-shield-check" style={{ marginRight: 4 }}></i>
                      Force confirm paid
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchToCash}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #e2e6ea",
                      background: "transparent",
                      color: "#6b7280",
                      fontWeight: 600,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel & switch to cash
                  </button>
                </div>
              )}

              {mpesaStatus === "success" && (
                <div style={{ textAlign: "center", color: "#2f9e44", fontWeight: 600 }}>
                  <i className="bi bi-check-circle-fill" style={{ marginRight: 6 }}></i>
                  Payment confirmed — finishing sale...
                </div>
              )}

              {mpesaStatus === "failed" && (
                <div>
                  <div style={{ color: "#e03131", fontSize: "0.85rem", marginBottom: "10px" }}>
                    <i className="bi bi-x-circle" style={{ marginRight: 4 }}></i>
                    {mpesaError || "Payment failed."}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleRetryStkPush}
                      style={{
                        flex: 1,
                        padding: "9px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#f59f00",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      <i className="bi bi-arrow-repeat" style={{ marginRight: 4 }}></i>
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchToCash}
                      style={{
                        flex: 1,
                        padding: "9px",
                        borderRadius: "8px",
                        border: "1px solid #e2e6ea",
                        background: "transparent",
                        color: "#6b7280",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      Switch to cash
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* "Complete Sale" only drives CASH/CARD now — M-Pesa is driven by the STK flow above */}
          {paymentMethod !== "MPESA" && (
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
          )}

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