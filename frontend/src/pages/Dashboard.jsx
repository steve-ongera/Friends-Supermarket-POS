import React, { useEffect, useState } from "react";
import { getDashboardSummary } from "../services/api";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getDashboardSummary().then((res) => setSummary(res.data));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div className="kpi-card">
          <div className="kpi-label"><i className="bi bi-receipt"></i> Sales Today</div>
          <div className="kpi-value">{summary?.sales_count_today ?? "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><i className="bi bi-cash-coin"></i> Revenue Today</div>
          <div className="kpi-value">KES {summary?.revenue_today ?? "0.00"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><i className="bi bi-exclamation-triangle"></i> Low Stock Items</div>
          <div className="kpi-value">{summary?.low_stock_count ?? "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><i className="bi bi-unlock"></i> Active Sessions</div>
          <div className="kpi-value">{summary?.active_sessions ?? "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><i className="bi bi-lock"></i> Locked Sessions</div>
          <div className="kpi-value">{summary?.locked_sessions ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}