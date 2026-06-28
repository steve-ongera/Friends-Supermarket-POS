import React, { useEffect, useState } from "react";
import { getSupermarket, updateSupermarket } from "../services/api";

export default function Settings() {
  const [form, setForm] = useState({ name: "", location: "", phone_number: "", email: "", kra_pin: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSupermarket().then((res) => setForm(res.data));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateSupermarket(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2>Business Settings</h2>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 480, display: "grid", gap: 12 }}>
        <label>Business Name</label>
        <input name="name" value={form.name || ""} onChange={handleChange} />

        <label>Location</label>
        <input name="location" value={form.location || ""} onChange={handleChange} />

        <label>Phone Number</label>
        <input name="phone_number" value={form.phone_number || ""} onChange={handleChange} />

        <label>Email</label>
        <input name="email" value={form.email || ""} onChange={handleChange} />

        <label>KRA PIN</label>
        <input name="kra_pin" value={form.kra_pin || ""} onChange={handleChange} />

        <button className="btn btn-primary" type="submit">Save Changes</button>
        {saved && <p style={{ color: "var(--color-success)" }}>Saved successfully!</p>}
      </form>
    </div>
  );
}