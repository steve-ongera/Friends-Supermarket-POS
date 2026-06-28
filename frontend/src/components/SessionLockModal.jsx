import React, { useEffect, useState } from "react";
import { initiateSTKPush, getPaymentStatus, getPackages } from "../services/api";
import { useSession } from "../context/SessionContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function SessionLockModal() {
  const { showUnlockModal, setShowUnlockModal, refreshSession } = useSession();
  const { user } = useAuth();

  const [phone, setPhone] = useState(user?.phone_number || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | "pending" | "success" | "failed"
  const [error, setError] = useState("");

  // --- Package tier picker ---
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState(null);

  // Converts session_duration_hours into a friendly label: "12 hours",
  // "1 day", "3 days" — switches to days once the duration hits 24h+.
  const formatDuration = (hours) => {
    if (hours == null) return "";
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    const days = hours / 24;
    const roundedDays = Math.round(days * 10) / 10; // keep one decimal if not whole
    const isWhole = Number.isInteger(roundedDays);
    return `${isWhole ? roundedDays : roundedDays.toFixed(1)} day${roundedDays === 1 ? "" : "s"}`;
  };

  useEffect(() => {
    if (!showUnlockModal) return;
    setLoadingPackages(true);
    getPackages()
      .then((res) => {
        const list = res.data.results || res.data;
        setPackages(list);
        // Nothing selected by default => backend falls back to the
        // supermarket's current subscription package (existing behavior).
        setSelectedPackageId(null);
      })
      .catch(() => {})
      .finally(() => setLoadingPackages(false));
  }, [showUnlockModal]);

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
        ...(selectedPackageId ? { package_id: selectedPackageId } : {}),
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
          and keep selling — or upgrade to a higher tier below.
        </p>

        {status === "success" ? (
          <div className="pill success" style={{ fontSize: "0.95rem", padding: "8px 16px" }}>
            <i className="bi bi-check-circle"></i> Session unlocked!
          </div>
        ) : (
          <>
            {/* Package tier picker */}
            <div style={{ margin: "14px 0", textAlign: "left" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "var(--color-text-muted)",
                }}
              >
                Choose a plan to unlock with
              </label>

              {loadingPackages ? (
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Loading plans...</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {packages.map((pkg) => {
                    const selected = selectedPackageId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPackageId(pkg.id)}
                        disabled={status === "pending"}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: selected
                            ? "2px solid var(--color-primary, #1d6f42)"
                            : "1px solid var(--color-border)",
                          background: selected ? "rgba(29,111,66,0.06)" : "transparent",
                          cursor: status === "pending" ? "not-allowed" : "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <span>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem", display: "block" }}>
                            {pkg.name}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            {pkg.is_unlimited
                              ? "Unlimited sales/day"
                              : `${pkg.daily_free_sales} sales/day`}
                            {pkg.session_duration_hours != null && (
                              <> · valid {formatDuration(pkg.session_duration_hours)}</>
                            )}
                          </span>
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                          KES {parseFloat(pkg.unlock_price).toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <input
              type="tel"
              className="form-input"
              placeholder="2547XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={status === "pending"}
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
              disabled={loading || !phone || status === "pending"}
            >
              {loading || status === "pending" ? "Sending STK Push..." : "Pay to Unlock Session"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}