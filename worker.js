
async function verifyAdmin(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");

  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return false;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const decode = (value) => {
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    };

    const header = decode(parts[0]);
    const claims = decode(parts[1]);

    const domain = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");

    if (claims.iss !== `https://${domain}`) return false;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return false;

    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(env.ACCESS_AUD)) return false;

    const certResponse = await fetch(`https://${domain}/cdn-cgi/access/certs`);
    if (!certResponse.ok) return false;

    const certData = await certResponse.json();
    const jwk = certData.keys.find((key) => key.kid === header.kid);
    if (!jwk) return false;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureText = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const signature = Uint8Array.from(
      atob(signatureText.padEnd(Math.ceil(signatureText.length / 4) * 4, "=")),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );

    return valid && Boolean(claims.email);
  } catch {
    return false;
  }
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path.startsWith("/api/")) {
      if (!env.DB) {
        return response({ error: "Database is not configured." }, 500);
      }

      // Public booking enquiry
      if (path === "/api/enquiries" && method === "POST") {
        const data = await readJson(request);

        if (!data || typeof data !== "object") {
          return response({ error: "Invalid request." }, 400);
        }

        const name = String(data.name || "").trim().slice(0, 100);
        const phone = String(data.phone || "").trim().slice(0, 30);
        const property = String(data.property || "").trim().slice(0, 200);
        const checkIn = String(data.date || "").trim().slice(0, 30);
        const guests = String(data.guests || "").trim().slice(0, 100);
        const message = String(data.message || "").trim().slice(0, 2000);

        if (!name || !phone) {
          return response({ error: "Name and phone are required." }, 400);
        }

        await env.DB.prepare(
          `INSERT INTO enquiries
           (customer_name, phone, property, check_in, guests, message)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(name, phone, property, checkIn, guests, message).run();

        return response({ success: true, message: "Enquiry saved." }, 201);
      }

      // Public active property list
      if (path === "/api/properties" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT * FROM properties WHERE active = 1 ORDER BY id DESC"
        ).all();

        return response({ properties: result.results || [] });
      }

      // All remaining API routes require Cloudflare Access authentication
      const authorised = await verifyAdmin(request, env);
      if (!authorised) {
        return response({ error: "Admin access required." }, 401);
      }

      // Admin: view all enquiries
      if (path === "/api/admin/enquiries" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT * FROM enquiries ORDER BY id DESC"
        ).all();

        return response({ enquiries: result.results || [] });
      }

      // Admin: update enquiry status
      if (path.startsWith("/api/admin/enquiries/") && method === "PATCH") {
        const id = Number(path.split("/").pop());
        const data = await readJson(request);
        const status = String(data?.status || "").trim();

        if (!Number.isInteger(id) || id < 1 ||
            !["New", "Contacted", "Confirmed", "Closed"].includes(status)) {
          return response({ error: "Invalid enquiry or status." }, 400);
        }

        await env.DB.prepare(
          "UPDATE enquiries SET status = ? WHERE id = ?"
        ).bind(status, id).run();

        return response({ success: true });
      }

      // Admin: view all properties
      if (path === "/api/admin/properties" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT * FROM properties ORDER BY id DESC"
        ).all();

        return response({ properties: result.results || [] });
      }

      // Admin: add a property
      if (path === "/api/admin/properties" && method === "POST") {
        const data = await readJson(request);

        if (!data || !String(data.name || "").trim()) {
          return response({ error: "Property name is required." }, 400);
        }

        const result = await env.DB.prepare(
          `INSERT INTO properties (name, location, description, price, image_url, active)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          String(data.name).trim().slice(0, 200),
          String(data.location || "").slice(0, 200),
          String(data.description || "").slice(0, 2000),
          String(data.price || "").slice(0, 100),
          String(data.image_url || "").slice(0, 1000),
          data.active === 0 ? 0 : 1
        ).run();

        return response({ success: true, id: result.meta.last_row_id }, 201);
      }

      // Admin: edit or delete a property
      if (path.startsWith("/api/admin/properties/")) {
        const id = Number(path.split("/").pop());

        if (!Number.isInteger(id) || id < 1) {
          return response({ error: "Invalid property ID." }, 400);
        }

        if (method === "PUT") {
          const data = await readJson(request);

          if (!data || !String(data.name || "").trim()) {
            return response({ error: "Property name is required." }, 400);
          }

          await env.DB.prepare(
            `UPDATE properties
             SET name = ?, location = ?, description = ?, price = ?, image_url = ?, active = ?
             WHERE id = ?`
          ).bind(
            String(data.name).trim().slice(0, 200),
            String(data.location || "").slice(0, 200),
            String(data.description || "").slice(0, 2000),
            String(data.price || "").slice(0, 100),
            String(data.image_url || "").slice(0, 1000),
            data.active === 0 ? 0 : 1,
            id
          ).run();

          return response({ success: true });
        }

        if (method === "DELETE") {
          await env.DB.prepare(
            "DELETE FROM properties WHERE id = ?"
          ).bind(id).run();

          return response({ success: true });
        }
      }

      return response({ error: "API route not found." }, 404);
    }

    // Serve the existing website files
    return env.ASSETS.fetch(request);
  }
};
