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
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-box" style={{ 
        maxWidth: "640px", 
        width: "95%",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        padding: "28px 28px 24px",
        position: "relative"
      }}>
        {/* Header with icon - NO CLOSE BUTTON */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "12px",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <div style={{ 
            width: "48px", 
            height: "48px", 
            borderRadius: "50%", 
            background: "var(--color-danger-light)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            flexShrink: 0
          }}>
            <i className="bi bi-lock-fill" style={{ fontSize: "1.5rem", color: "var(--color-danger)" }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>Sales Quota Reached</h3>
            <p style={{ margin: "2px 0 0 0", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Unlock your session to continue selling
            </p>
          </div>
          {/* No close button - SaaS modal cannot be dismissed */}
        </div>

        <p style={{ 
          color: "var(--color-text-secondary)", 
          fontSize: "0.85rem", 
          marginBottom: "16px",
          lineHeight: "1.5",
          padding: "10px 14px",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--color-warning)",
          flexShrink: 0
        }}>
          <i className="bi bi-info-circle" style={{ marginRight: "6px", color: "var(--color-warning)" }}></i>
          Your free sales limit is exhausted. Select a plan below and pay via M-Pesa to unlock a new session.
          <span style={{ display: "block", marginTop: "4px", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            <i className="bi bi-exclamation-triangle" style={{ marginRight: "4px" }}></i>
            This action is required to continue using the POS system.
          </span>
        </p>

        {status === "success" ? (
          <div style={{ 
            textAlign: "center",
            padding: "40px 20px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <div style={{ 
              width: "72px", 
              height: "72px", 
              borderRadius: "50%", 
              background: "var(--color-success-light)",
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              margin: "0 auto 12px"
            }}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: "2.8rem", color: "var(--color-success)" }}></i>
            </div>
            <h4 style={{ margin: "0 0 4px 0", color: "var(--color-success-dark)" }}>Session Unlocked!</h4>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", margin: 0 }}>
              Your session has been successfully unlocked. You can now continue selling.
            </p>
          </div>
        ) : (
          <>
            {/* Package selection - scrollable grid */}
            <div style={{ 
              flex: "0 1 auto",
              marginBottom: "16px",
              minHeight: "200px"
            }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: "600",
                  marginBottom: "8px",
                  color: "var(--color-text-secondary)",
                }}
              >
                <i className="bi bi-grid" style={{ marginRight: "4px" }}></i>
                Select a plan (click to choose)
              </label>

              {loadingPackages ? (
                <div style={{ 
                  textAlign: "center", 
                  padding: "30px", 
                  color: "var(--color-text-muted)",
                  fontSize: "0.85rem"
                }}>
                  <div className="loader-spinner" style={{ width: "24px", height: "24px", margin: "0 auto 8px" }}></div>
                  Loading plans...
                </div>
              ) : (
                <div style={{ 
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "10px",
                  maxHeight: "260px",
                  overflowY: "auto",
                  paddingRight: "4px"
                }}>
                  {packages.map((pkg) => {
                    const selected = selectedPackageId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPackageId(pkg.id)}
                        disabled={status === "pending"}
                        style={{
                          textAlign: "center",
                          padding: "16px 12px",
                          borderRadius: "var(--radius-md)",
                          border: selected
                            ? "2px solid var(--color-primary)"
                            : "1px solid var(--color-border)",
                          background: selected ? "var(--color-primary-50)" : "var(--color-surface)",
                          cursor: status === "pending" ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                          opacity: status === "pending" ? 0.6 : 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          minHeight: "100px",
                          justifyContent: "center",
                          boxShadow: selected ? "0 0 0 3px rgba(29,111,66,0.15)" : "none"
                        }}
                        onMouseEnter={(e) => {
                          if (status !== "pending" && !selected) {
                            e.currentTarget.style.borderColor = "var(--color-primary-300)";
                            e.currentTarget.style.background = "var(--color-surface-soft)";
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = "var(--color-border)";
                            e.currentTarget.style.background = "var(--color-surface)";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }
                        }}
                      >
                        <div style={{ 
                          fontWeight: "700", 
                          fontSize: "0.95rem",
                          color: selected ? "var(--color-primary)" : "var(--color-text)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}>
                          {pkg.name}
                          {selected && (
                            <span style={{ 
                              fontSize: "0.7rem",
                              color: "var(--color-success)"
                            }}>
                              <i className="bi bi-check-circle-fill"></i>
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: "1.1rem", 
                          fontWeight: "700",
                          color: "var(--color-primary)"
                        }}>
                          KES {parseFloat(pkg.unlock_price).toFixed(2)}
                        </div>
                        <div style={{ 
                          fontSize: "0.7rem", 
                          color: "var(--color-text-muted)",
                          lineHeight: "1.3"
                        }}>
                          {pkg.is_unlimited
                            ? "♾️ Unlimited sales/day"
                            : `${pkg.daily_free_sales} sales/day`}
                          {pkg.session_duration_hours != null && (
                            <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "2px" }}>
                              🕐 {formatDuration(pkg.session_duration_hours)}
                            </div>
                          )}
                        </div>
                        {selected && (
                          <div style={{ 
                            fontSize: "0.6rem",
                            color: "var(--color-primary)",
                            fontWeight: "600",
                            marginTop: "2px"
                          }}>
                            ✓ Selected
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Phone Input - only show if a package is selected */}
            {selectedPackageId && (
              <div style={{ flexShrink: 0 }}>
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label htmlFor="phoneNumber" style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--color-text-secondary)" }}>
                    <i className="bi bi-phone" style={{ marginRight: "4px" }}></i>
                    M-Pesa Phone Number
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      id="phoneNumber"
                      type="tel"
                      className="form-control"
                      placeholder="2547XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={status === "pending"}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        fontSize: "0.9rem"
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ 
                        padding: "10px 24px",
                        fontSize: "0.85rem",
                        whiteSpace: "nowrap",
                        minWidth: "120px"
                      }}
                      onClick={handleUnlock}
                      disabled={loading || !phone || status === "pending"}
                    >
                      {loading || status === "pending" ? (
                        <>
                          <span className="loader-spinner" style={{ width: "18px", height: "18px", borderWidth: "2px", marginRight: "6px" }}></span>
                          Sending...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-unlock" style={{ marginRight: "6px" }}></i>
                          Unlock
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ 
                    background: "var(--color-danger-light)", 
                    color: "var(--color-danger)",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8rem",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <i className="bi bi-exclamation-circle"></i>
                    {error}
                  </div>
                )}

                {status === "pending" && (
                  <div style={{ 
                    background: "var(--color-primary-50)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    border: "1px solid var(--color-primary-200)"
                  }}>
                    <div className="loader-spinner" style={{ width: "18px", height: "18px", borderWidth: "2px", flexShrink: 0 }}></div>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-primary-dark)" }}>
                      <i className="bi bi-phone-vibrate" style={{ marginRight: "6px" }}></i>
                      Check your phone for the M-Pesa STK push prompt...
                    </p>
                  </div>
                )}

                {!status && !loading && (
                  <p style={{ 
                    fontSize: "0.7rem", 
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                    margin: "8px 0 0 0"
                  }}>
                    <i className="bi bi-shield-check"></i> Secure payment via M-Pesa
                  </p>
                )}
              </div>
            )}

            {/* Show message if no package selected */}
            {!selectedPackageId && !loadingPackages && packages.length > 0 && (
              <div style={{ 
                textAlign: "center",
                padding: "16px",
                background: "var(--color-bg)",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--color-border)",
                flexShrink: 0
              }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  <i className="bi bi-hand-pointer" style={{ marginRight: "6px" }}></i>
                  Please select a plan above to continue
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}