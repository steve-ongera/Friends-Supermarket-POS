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

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
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
          Dashboard
        </h2>
        <div style={{ 
          fontSize: "0.85rem", 
          color: "var(--color-text-muted)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <i className="bi bi-calendar3"></i>
          <span>Today's Overview</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">
            <i className="bi bi-receipt" style={{ marginRight: "4px" }}></i> 
            Sales Today
          </div>
          <div className="kpi-value">{summary?.sales_count_today ?? "—"}</div>
          <div className="kpi-trend up">
            <i className="bi bi-arrow-up"></i> +12%
          </div>
        </div>
        <div className="kpi-card" style={{ minWidth: "180px" }}>
          <div className="kpi-label">
            <i className="bi bi-cash-coin" style={{ marginRight: "4px" }}></i> 
            Revenue Today
          </div>
          <div className="kpi-value" style={{ 
            fontSize: "1.5rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            {formatCurrency(summary?.revenue_today)}
          </div>
          <div className="kpi-trend up">
            <i className="bi bi-arrow-up"></i> +8%
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            <i className="bi bi-exclamation-triangle" style={{ marginRight: "4px" }}></i> 
            Low Stock Items
          </div>
          <div className="kpi-value">{summary?.low_stock_count ?? "—"}</div>
          <div className="kpi-trend down">
            <i className="bi bi-arrow-down"></i> -3
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            <i className="bi bi-unlock" style={{ marginRight: "4px" }}></i> 
            Active Sessions
          </div>
          <div className="kpi-value">{summary?.active_sessions ?? "—"}</div>
          <div className="kpi-trend up">
            <i className="bi bi-arrow-up"></i> +2
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            <i className="bi bi-lock" style={{ marginRight: "4px" }}></i> 
            Locked Sessions
          </div>
          <div className="kpi-value">{summary?.locked_sessions ?? "—"}</div>
          <div className="kpi-trend down">
            <i className="bi bi-arrow-down"></i> -1
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Line chart: revenue trend over last 14 days */}
        <div className="card">
          <div className="card-header">
            <h3>
              <i className="bi bi-graph-up" style={{ marginRight: "8px" }}></i> 
              Revenue Trend (Last 14 Days)
            </h3>
            <span className="card-action">
              <i className="bi bi-calendar-range"></i> Last 14 days
            </span>
          </div>
          {charts ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={charts.sales_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => d.slice(5)} 
                  fontSize={12}
                  stroke="var(--color-text-muted)"
                />
                <YAxis 
                  fontSize={12}
                  stroke="var(--color-text-muted)"
                  tickFormatter={(value) => `KES ${value.toLocaleString()}`}
                />
                <Tooltip 
                  formatter={(value) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1d6f42"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#1d6f42" }}
                  name="Revenue (KES)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              height: "320px",
              color: "var(--color-text-muted)"
            }}>
              <div style={{ textAlign: "center" }}>
                <i className="bi bi-graph-up" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                Loading chart...
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-chart-row">
          {/* Pie chart: payment method breakdown */}
          <div className="card">
            <div className="card-header">
              <h3>
                <i className="bi bi-pie-chart" style={{ marginRight: "8px" }}></i> 
                Payment Method Breakdown
              </h3>
              <span className="card-action">Distribution</span>
            </div>
            {charts && charts.payment_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
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
                  <Tooltip 
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)"
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                height: "300px",
                color: "var(--color-text-muted)"
              }}>
                <div style={{ textAlign: "center" }}>
                  <i className="bi bi-pie-chart" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                  No sales data yet.
                </div>
              </div>
            )}
          </div>

          {/* Bar chart: top selling products */}
          <div className="card">
            <div className="card-header">
              <h3>
                <i className="bi bi-bar-chart" style={{ marginRight: "8px" }}></i> 
                Top 5 Best-Selling Products
              </h3>
              <span className="card-action">This month</span>
            </div>
            {charts && charts.top_products.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.top_products}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="product_name" 
                    fontSize={11} 
                    interval={0} 
                    angle={-15} 
                    textAnchor="end" 
                    height={60}
                    stroke="var(--color-text-muted)"
                  />
                  <YAxis 
                    fontSize={12}
                    stroke="var(--color-text-muted)"
                  />
                  <Tooltip 
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)"
                    }}
                  />
                  <Bar 
                    dataKey="quantity_sold" 
                    fill="#f5a623" 
                    name="Units Sold" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                height: "300px",
                color: "var(--color-text-muted)"
              }}>
                <div style={{ textAlign: "center" }}>
                  <i className="bi bi-bar-chart" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
                  No sales data yet.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}