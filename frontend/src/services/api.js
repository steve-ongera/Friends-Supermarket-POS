import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

// Restore token on load
const existingToken = localStorage.getItem("access_token");
if (existingToken) setAuthToken(existingToken);

// --- Auto-refresh access token on 401 ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
          localStorage.setItem("access_token", res.data.access);
          setAuthToken(res.data.access);
          original.headers["Authorization"] = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/* ============================================================
   AUTH
   ============================================================ */
export const registerSupermarket = (data) => api.post("/auth/register/", data);
export const loginUser = (data) => api.post("/auth/login/", data);
export const refreshToken = (refresh) => api.post("/auth/refresh/", { refresh });
export const getMe = () => api.get("/auth/me/");

/* ============================================================
   SUPERMARKET / SUBSCRIPTION
   ============================================================ */
export const getSupermarket = () => api.get("/supermarket/");
export const updateSupermarket = (data) => api.patch("/supermarket/", data);
export const getPackages = () => api.get("/packages/");
export const getSubscription = () => api.get("/subscription/");

/* ============================================================
   STAFF
   ============================================================ */
export const getStaff = () => api.get("/staff/");
export const createStaff = (data) => api.post("/staff/", data);
export const updateStaff = (id, data) => api.patch(`/staff/${id}/`, data);
export const deleteStaff = (id) => api.delete(`/staff/${id}/`);

/* ============================================================
   SALES SESSIONS (quota / lock state)
   ============================================================ */
export const getCurrentSession = () => api.get("/sessions/current/");
export const getSessions = () => api.get("/sessions/");

/* ============================================================
   M-PESA PAYMENTS
   ============================================================ */
export const initiateSTKPush = (data) => api.post("/payments/stk-push/", data);
export const getPaymentStatus = (referenceCode) =>
  api.get(`/payments/status/${referenceCode}/`);

/* ============================================================
   CATEGORIES
   ============================================================ */
export const getCategories = () => api.get("/categories/");
export const createCategory = (data) => api.post("/categories/", data);
export const updateCategory = (id, data) => api.patch(`/categories/${id}/`, data);
export const deleteCategory = (id) => api.delete(`/categories/${id}/`);

/* ============================================================
   SUPPLIERS
   ============================================================ */
export const getSuppliers = () => api.get("/suppliers/");
export const createSupplier = (data) => api.post("/suppliers/", data);
export const updateSupplier = (id, data) => api.patch(`/suppliers/${id}/`, data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}/`);

/* ============================================================
   PRODUCTS / INVENTORY
   ============================================================ */
export const getProducts = (params) => api.get("/products/", { params });
export const getProduct = (id) => api.get(`/products/${id}/`);
export const createProduct = (data) => api.post("/products/", data);
export const updateProduct = (id, data) => api.patch(`/products/${id}/`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}/`);
export const lookupProductByBarcode = (barcode) => api.get(`/products/lookup/${barcode}/`);
export const adjustStock = (productId, data) =>
  api.post(`/products/${productId}/adjust-stock/`, data);
export const getStockMovements = (params) => api.get("/stock-movements/", { params });

/* ============================================================
   SALES / POS
   ============================================================ */
export const getSales = (params) => api.get("/sales/", { params });
export const getSale = (id) => api.get(`/sales/${id}/`);
export const createSale = (data) => api.post("/sales/create/", data);
export const voidSale = (id) => api.post(`/sales/${id}/void/`);

/* ============================================================
   DASHBOARD
   ============================================================ */
export const getDashboardSummary = () => api.get("/dashboard/summary/");