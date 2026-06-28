import React, { useEffect, useState } from "react";
import { getSubscription, getPackages } from "../services/api";

export default function Subscription() {
  const [subscription, setSubscription] = useState(null);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    getSubscription().then((res) => setSubscription(res.data));
    getPackages().then((res) => setPackages(res.data.results || res.data));
  }, []);

  return (
    <div>
      <h2>Subscription & Billing</h2>

      {subscription && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Current Package: {subscription.package_detail?.name}</h3>
          <p>Free sales per day/session: <strong>{subscription.package_detail?.daily_free_sales}</strong></p>
          <p>Unlock price: <strong>KES {subscription.package_detail?.unlock_price}</strong></p>
        </div>
      )}

      <h3>Available Packages</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {packages.map((p) => (
          <div className="card" key={p.id}>
            <h4>{p.name}</h4>
            <p style={{ color: "var(--color-text-muted)" }}>{p.description}</p>
            <p>{p.daily_free_sales} free sales/day</p>
            <p>KES {p.unlock_price} to unlock new session</p>
          </div>
        ))}
      </div>
    </div>
  );
}