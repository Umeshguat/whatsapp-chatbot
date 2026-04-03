const BASE_URL = process.env.API_BASE_URL || "https://apiten.bindassdealdigital.com";

const apiClient = {
  async get(endpoint) {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
  },

  async post(endpoint, data) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("API Error Response:", JSON.stringify(err, null, 2));
      const msg = err.message || err.error || (err.errors ? JSON.stringify(err.errors) : null) || `API error: ${res.status} ${res.statusText}`;
      throw new Error(msg);
    }
    return res.json();
  },

  async getBuffer(endpoint) {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};

module.exports = apiClient;
