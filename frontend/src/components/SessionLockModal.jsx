import React, { useState } from "react";
import { initiateSTKPush, getPaymentStatus } from "../services/api";
import { useSession } from "../context/SessionContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function SessionLockModal() {
  const { showUnlockModal, setShowUnlockModal, refreshSession } = useSession();
  const { user } = useAuth();

  const [phone, setPhone] = useState(user?.phone_number || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | "pending" | "success" | "failed"
  const [error, setError] = useState("");

  if (!showUnlockModal) return null;

  const pollPayment = (referenceCode) => {
    const interval = setInterval(async () => {
      try {
        const res = await getPaymentStatus(referenceCode);
        if (res.data.status === "SUCCESS") {
          clearInterval(interval);
          setStatus("success");
          await refreshSession();
          setTimeout(() => setShowUnlockModal(false), 1200);
        } else if (res.data.status === "FAILED" || res.data.status === "CANCELLED") {
          clearInterval(interval);
          setStatus("failed");
        }
      } catch {
        clearInterval(interval);
        setStatus("failed");
      }
    }, 3000);
  };

  const handleUnlock = async () => {
    setError("");
    setLoading(true);
    setStatus("pending");
    try {
      const res = await initiateSTKPush({
        phone_number: phone,
        purpose: "SESSION_UNLOCK",
      });
      pollPayment(res.data.payment.reference_code);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to initiate M-Pesa payment.");
      setStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <i className="bi bi-lock-fill" style={{ fontSize: "2rem", color: "var(--color-danger)" }}></i>
        <h3>Sales Quota Reached</h3>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
          Your free sales limit for this session is exhausted. Pay via M-Pesa to unlock a new session
          and keep selling.
        </p>

        {status === "success" ? (
          <div className="pill success" style={{ fontSize: "0.95rem", padding: "8px 16px" }}>
            <i className="bi bi-check-circle"></i> Session unlocked!
          </div>
        ) : (
          <>
            <input
              type="tel"
              className="form-input"
              placeholder="2547XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                margin: "14px 0",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
              }}
            />

            {error && <p style={{ color: "var(--color-danger)", fontSize: "0.85rem" }}>{error}</p>}

            {status === "pending" && (
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                <i className="bi bi-phone-vibrate"></i> Check your phone for the M-Pesa STK push prompt...
              </p>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleUnlock}
              disabled={loading || !phone}
            >
              {loading ? "Sending STK Push..." : "Pay to Unlock Session"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}