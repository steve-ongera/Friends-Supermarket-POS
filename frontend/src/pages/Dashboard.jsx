import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import { getDashboardSummary, getDashboardCharts } from "../services/api";

const PIE_COLORS = ["#1d6f42", "#f5a623", "#3b82f6", "#e03131"];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    getDashboardSummary().then((res) => setSummary(res.data));
    getDashboardCharts().then((res) => setCharts(res.data));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginTop: 16,
          marginBottom: 28,
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

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        {/* Line chart: revenue trend over last 14 days */}
        <div className="card">
          <h3><i className="bi bi-graph-up"></i> Revenue Trend (Last 14 Days)</h3>
          {charts ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={charts.sales_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => `KES ${value}`} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1d6f42"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Revenue (KES)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "var(--color-text-muted)" }}>Loading chart...</p>
          )}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          className="dashboard-chart-row"
        >
          {/* Pie chart: payment method breakdown */}
          <div className="card">
            <h3><i className="bi bi-pie-chart"></i> Payment Method Breakdown</h3>
            {charts && charts.payment_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={charts.payment_breakdown}
                    dataKey="count"
                    nameKey="payment_method"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ payment_method, count }) => `${payment_method}: ${count}`}
                  >
                    {charts.payment_breakdown.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: "var(--color-text-muted)" }}>No sales data yet.</p>
            )}
          </div>

          {/* Bar chart: top selling products */}
          <div className="card">
            <h3><i className="bi bi-bar-chart"></i> Top 5 Best-Selling Products</h3>
            {charts && charts.top_products.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.top_products}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="product_name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="quantity_sold" fill="#f5a623" name="Units Sold" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: "var(--color-text-muted)" }}>No sales data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}