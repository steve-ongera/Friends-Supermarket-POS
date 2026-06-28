import React, { useEffect, useState } from "react";
import {
  getSubscription,
  getPackages,
  updateSupermarket,
  initiateSTKPush,
  getPaymentStatus,
} from "../services/api";
import api from "../services/api";

// PATCH /subscription/ isn't exported from services/api.js yet — add it
// inline here using the shared `api` axios instance instead of duplicating
// the whole file. (Move this into api.js as `updateSubscription` if you
// prefer keeping all endpoints centralized there.)
const updateSubscription = (data) => api.patch("/subscription/", data);

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // ~2 minutes

export default function Subscription() {
  const [subscription, setSubscription] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Upgrade flow state ---
  const [upgradingPackageId, setUpgradingPackageId] = useState(null); // which card is mid-flow
  const [upgradeStatus, setUpgradeStatus] = useState(null); // null | "sending" | "pending" | "success" | "failed"
  const [upgradeError, setUpgradeError] = useState("");
  const [phone, setPhone] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    return Promise.all([
      getSubscription().then((res) => setSubscription(res.data)),
      getPackages().then((res) => setPackages(res.data.results || res.data)),
    ]).finally(() => setLoading(false));
  };

  // Calculate days remaining
  const getDaysRemaining = () => {
    if (!subscription?.end_date) return null;
    const end = new Date(subscription.end_date);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  // Get status pill class
  const getStatusPill = (status) => {
    switch(status) {
      case "ACTIVE": return "success";
      case "EXPIRED": return "danger";
      case "TRIAL": return "warning";
      default: return "neutral";
    }
  };

  // --- Upgrade flow ---

  const startUpgrade = (pkg) => {
    setUpgradingPackageId(pkg.id);
    setUpgradeStatus(null);
    setUpgradeError("");
    setPhone("");
    setPendingPayment(null);
  };

  const cancelUpgrade = () => {
    setUpgradingPackageId(null);
    setUpgradeStatus(null);
    setUpgradeError("");
    setPendingPayment(null);
  };

  const handleSendUpgradePush = async (pkg) => {
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneDigits) {
      setUpgradeError("Enter the phone number to pay from.");
      return;
    }

    setUpgradeStatus("sending");
    setUpgradeError("");

    try {
      const res = await initiateSTKPush({
        phone_number: phone,
        amount: pkg.unlock_price,
        purpose: "SUBSCRIPTION",
      });
      setPendingPayment(res.data.payment);
      setUpgradeStatus("pending");
      pollUpgradePayment(res.data.payment.reference_code, pkg);
    } catch (err) {
      setUpgradeStatus("failed");
      setUpgradeError(
        err.response?.data?.detail || "Could not send the M-Pesa prompt. Check the number and try again."
      );
    }
  };

  const pollUpgradePayment = (referenceCode, pkg, attempt = 0) => {
    setTimeout(async () => {
      try {
        const res = await getPaymentStatus(referenceCode);
        const payment = res.data;
        setPendingPayment(payment);

        if (payment.status === "SUCCESS") {
          // Payment confirmed — now actually activate the new package.
          try {
            await updateSubscription({ package: pkg.id, is_active: true });
            setUpgradeStatus("success");
            await loadData();
            setTimeout(() => {
              setUpgradingPackageId(null);
              setUpgradeStatus(null);
            }, 1500);
          } catch {
            setUpgradeStatus("failed");
            setUpgradeError(
              "Payment succeeded but activating the new package failed. Please contact support — you will not be charged again."
            );
          }
          return;
        }

        if (payment.status === "FAILED" || payment.status === "CANCELLED") {
          setUpgradeStatus("failed");
          setUpgradeError(payment.result_desc || "Payment failed or was cancelled.");
          return;
        }

        if (attempt + 1 >= MAX_POLL_ATTEMPTS) {
          setUpgradeError(
            "Still waiting on confirmation. If you completed the payment, give it a moment and check again."
          );
          return;
        }

        pollUpgradePayment(referenceCode, pkg, attempt + 1);
      } catch {
        if (attempt + 1 >= MAX_POLL_ATTEMPTS) {
          setUpgradeError("Lost connection while checking payment status.");
        } else {
          pollUpgradePayment(referenceCode, pkg, attempt + 1);
        }
      }
    }, POLL_INTERVAL_MS);
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
          <i className="bi bi-credit-card" style={{ marginRight: "8px" }}></i>
          Subscription & Billing
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span className="pill info">
            <i className="bi bi-boxes"></i> {packages.length} packages available
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "60px 20px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Loading subscription details...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Current Subscription */}
          {subscription && (
            <div className="card" style={{ marginBottom: "24px" }}>
              <div className="card-header">
                <h3>
                  <i className="bi bi-check-circle" style={{ color: "var(--color-success)" }}></i>
                  Current Subscription
                </h3>
                <span className={`pill ${getStatusPill(subscription.is_active ? "ACTIVE" : "EXPIRED")}`}>
                  <i className={`bi ${subscription.is_active ? "bi-check-circle" : "bi-exclamation-circle"}`}></i>
                  {subscription.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>

              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                gap: "20px",
                marginTop: "8px"
              }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                    <i className="bi bi-box"></i> Package
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                    {subscription.package_detail?.name || "N/A"}
                  </div>
                  {subscription.package_detail?.description && (
                    <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                      {subscription.package_detail.description}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                    <i className="bi bi-arrow-up-circle"></i> Free Sales / Day
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--color-primary)" }}>
                    {subscription.package_detail?.is_unlimited
                      ? "Unlimited"
                      : subscription.package_detail?.daily_free_sales ?? "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                    <i className="bi bi-unlock"></i> Unlock Price
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--color-accent)" }}>
                    {formatCurrency(subscription.package_detail?.unlock_price)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: "600" }}>
                    <i className="bi bi-calendar-check"></i> Days Remaining
                  </div>
                  <div style={{ 
                    fontSize: "1.1rem", 
                    fontWeight: "700",
                    color: getDaysRemaining() > 7 ? "var(--color-success)" : "var(--color-danger)"
                  }}>
                    {getDaysRemaining() !== null ? (
                      <>
                        {getDaysRemaining()} days
                        {getDaysRemaining() <= 7 && (
                          <span style={{ 
                            fontSize: "0.75rem", 
                            fontWeight: "600",
                            color: "var(--color-danger)",
                            display: "block"
                          }}>
                            <i className="bi bi-exclamation-triangle"></i> Renew soon!
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              {/* Subscription progress bar */}
              {subscription.end_date && subscription.start_date && (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    marginBottom: "4px"
                  }}>
                    <span>
                      <i className="bi bi-calendar-plus"></i> {new Date(subscription.start_date).toLocaleDateString()}
                    </span>
                    <span>
                      <i className="bi bi-calendar-x"></i> {new Date(subscription.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ 
                    width: "100%", 
                    height: "8px", 
                    background: "var(--color-bg)",
                    borderRadius: "var(--radius-full)",
                    overflow: "hidden"
                  }}>
                    <div style={{ 
                      width: `${Math.min(100, Math.max(0, ((new Date() - new Date(subscription.start_date)) / (new Date(subscription.end_date) - new Date(subscription.start_date))) * 100))}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, var(--color-primary), var(--color-accent))`,
                      borderRadius: "var(--radius-full)",
                      transition: "width 0.5s ease"
                    }}></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Available Packages */}
          <div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "16px"
            }}>
              <h3 style={{ 
                fontSize: "1.1rem", 
                fontWeight: "600", 
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <i className="bi bi-grid"></i>
                Available Packages
              </h3>
              <span className="pill neutral">
                {packages.length} packages
              </span>
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", 
              gap: "20px"
            }}>
              {packages.length === 0 ? (
                <div className="card" style={{ 
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--color-text-muted)"
                }}>
                  <i className="bi bi-boxes" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                  No packages available.
                </div>
              ) : (
                packages.map((p) => {
                  const isCurrent = subscription?.package_detail?.id === p.id;
                  const isUpgrading = upgradingPackageId === p.id;

                  return (
                    <div className="card" key={p.id} style={{ 
                      border: isCurrent ? `2px solid var(--color-primary)` : "1px solid var(--color-border-light)",
                      position: "relative"
                    }}>
                      {isCurrent && (
                        <div style={{ 
                          position: "absolute",
                          top: "-10px",
                          right: "16px",
                          background: "var(--color-primary)",
                          color: "#fff",
                          padding: "2px 12px",
                          borderRadius: "var(--radius-full)",
                          fontSize: "0.7rem",
                          fontWeight: "600"
                        }}>
                          <i className="bi bi-check-circle"></i> Current
                        </div>
                      )}
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "flex-start",
                        marginBottom: "12px"
                      }}>
                        <h4 style={{ 
                          margin: 0,
                          fontSize: "1.1rem",
                          fontWeight: "700"
                        }}>
                          {p.name}
                        </h4>
                        <span className="pill info">
                          {p.is_unlimited ? "Unlimited" : `${p.daily_free_sales} free/day`}
                        </span>
                      </div>
                      <p style={{ 
                        color: "var(--color-text-muted)", 
                        fontSize: "0.9rem",
                        margin: "0 0 16px 0"
                      }}>
                        {p.description || "No description available"}
                      </p>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "12px",
                        borderTop: "1px solid var(--color-border-light)"
                      }}>
                        <div>
                          <span style={{ 
                            fontSize: "0.75rem", 
                            color: "var(--color-text-muted)", 
                            fontWeight: "600"
                          }}>
                            Unlock Price
                          </span>
                          <div style={{ 
                            fontSize: "1.2rem", 
                            fontWeight: "700",
                            color: "var(--color-accent)"
                          }}>
                            {formatCurrency(p.unlock_price)}
                          </div>
                        </div>
                        {!isUpgrading && (
                          <button 
                            className={`btn ${isCurrent ? "btn-secondary" : "btn-primary"}`}
                            disabled={isCurrent}
                            onClick={() => startUpgrade(p)}
                            style={{ 
                              fontSize: "0.85rem",
                              padding: "8px 16px"
                            }}
                          >
                            {isCurrent ? (
                              <>
                                <i className="bi bi-check-circle"></i> Active
                              </>
                            ) : (
                              <>
                                <i className="bi bi-arrow-right-circle"></i> Subscribe
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Inline M-Pesa upgrade flow for this card */}
                      {isUpgrading && (
                        <div
                          style={{
                            marginTop: "14px",
                            paddingTop: "14px",
                            borderTop: "1px solid var(--color-border-light)",
                          }}
                        >
                          {upgradeStatus === "success" ? (
                            <div style={{ textAlign: "center", color: "var(--color-success)", fontWeight: 600, fontSize: "0.88rem" }}>
                              <i className="bi bi-check-circle-fill" style={{ marginRight: 6 }}></i>
                              Subscription activated!
                            </div>
                          ) : upgradeStatus === "pending" ? (
                            <div>
                              <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", marginBottom: "10px" }}>
                                <i className="bi bi-phone-vibrate"></i> Waiting for payment confirmation on {phone}...
                              </p>
                              {upgradeError && (
                                <p style={{ color: "var(--color-danger)", fontSize: "0.78rem", marginBottom: "8px" }}>
                                  {upgradeError}
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={cancelUpgrade}
                                className="btn btn-secondary"
                                style={{ width: "100%", fontSize: "0.8rem", padding: "7px" }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="tel"
                                placeholder="2547XXXXXXXX"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                disabled={upgradeStatus === "sending"}
                                style={{
                                  width: "100%",
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid var(--color-border)",
                                  fontSize: "0.85rem",
                                  marginBottom: "8px",
                                }}
                              />
                              {upgradeError && (
                                <p style={{ color: "var(--color-danger)", fontSize: "0.78rem", marginBottom: "8px" }}>
                                  {upgradeError}
                                </p>
                              )}
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  type="button"
                                  onClick={cancelUpgrade}
                                  className="btn btn-secondary"
                                  style={{ flex: 1, fontSize: "0.8rem", padding: "7px" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendUpgradePush(p)}
                                  disabled={upgradeStatus === "sending" || !phone}
                                  className="btn btn-primary"
                                  style={{ flex: 1, fontSize: "0.8rem", padding: "7px" }}
                                >
                                  {upgradeStatus === "sending" ? "Sending..." : "Pay & Activate"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Subscription benefits */}
          {subscription && (
            <div style={{ 
              marginTop: "24px",
              padding: "20px",
              background: "var(--color-primary-50)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-primary-light)"
            }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px",
                flexWrap: "wrap"
              }}>
                <i className="bi bi-info-circle" style={{ 
                  fontSize: "1.5rem", 
                  color: "var(--color-primary)" 
                }}></i>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--color-primary-dark)" }}>
                    Need more sales?
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>
                    Upgrade your package or unlock additional sales when you reach your daily limit.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}