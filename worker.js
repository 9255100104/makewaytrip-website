
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function base64urlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  );
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createSession(env) {
  const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;

  const payload = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ exp: expiresAt }))
  );

  const key = await getSigningKey(env.SESSION_SECRET);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload)
    )
  );

  return `${payload}.${base64urlEncode(signature)}`;
}

async function verifyAdmin(request, env) {
  try {
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      return false;
    }

    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)__Host-mwt_admin=([^;]+)/);

    if (!match) return false;

    const parts = match[1].split(".");
    if (parts.length !== 2) return false;

    const key = await getSigningKey(env.SESSION_SECRET);
    const signature = base64urlDecode(parts[1]);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(parts[0])
    );

    if (!valid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(parts[0]))
    );

    return Number.isInteger(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function isSameOrigin(request, url) {
  return request.headers.get("Origin") === url.origin;
}

function sessionCookie(token) {
  return `__Host-mwt_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

function clearSessionCookie() {
  return "__Host-mwt_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

async function comparePassword(input, expected) {
  const encoder = new TextEncoder();
  const a = encoder.encode(input);
  const b = encoder.encode(expected);

  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let i = 0; i < length; i++) {
    difference |= (a[i] || 0) ^ (b[i] || 0);
  }

  return difference === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Admin login
    if (path === "/api/admin/login" && method === "POST") {
      if (!isSameOrigin(request, url)) {
        return jsonResponse({ error: "Invalid request origin." }, 403);
      }

      if (
        !env.ADMIN_PASSWORD ||
        !env.SESSION_SECRET ||
        env.SESSION_SECRET.length < 32
      ) {
        return jsonResponse(
          { error: "Admin security is not configured correctly." },
          500
        );
      }

      const data = await readJson(request);
      const password = typeof data?.password === "string"
        ? data.password
        : "";

      if (
        !password ||
        password.length > 1024 ||
        !(await comparePassword(password, env.ADMIN_PASSWORD))
      ) {
        return jsonResponse({ error: "Incorrect password." }, 401);
      }

      const token = await createSession(env);

      return jsonResponse(
        { success: true },
        200,
        { "Set-Cookie": sessionCookie(token) }
      );
    }

    // Check login session
    if (path === "/api/admin/session" && method === "GET") {
      return jsonResponse({
        authenticated: await verifyAdmin(request, env)
      });
    }

    // Admin logout
    if (path === "/api/admin/logout" && method === "POST") {
      if (!isSameOrigin(request, url)) {
        return jsonResponse({ error: "Invalid request origin." }, 403);
      }

      return jsonResponse(
        { success: true },
        200,
        { "Set-Cookie": clearSessionCookie() }
      );
    }

    // Protect the admin dashboard page
    if (path === "/admin.html" && method === "GET") {
      if (!(await verifyAdmin(request, env))) {
        return Response.redirect(
          new URL("/admin-login.html", url).toString(),
          302
        );
      }
    }

    // All API routes
    if (path.startsWith("/api/")) {
      if (!env.DB) {
        return jsonResponse({ error: "Database is not configured." }, 500);
      }

      // Public booking enquiry
      if (path === "/api/enquiries" && method === "POST") {
        const data = await readJson(request);

        if (!data || typeof data !== "object") {
          return jsonResponse({ error: "Invalid request." }, 400);
        }

        const name = String(data.name || "").trim().slice(0, 100);
        const phone = String(data.phone || "").trim().slice(0, 30);
        const property = String(data.property || "").trim().slice(0, 200);
        const checkIn = String(data.date || "").trim().slice(0, 30);
        const guests = String(data.guests || "").trim().slice(0, 100);
        const message = String(data.message || "").trim().slice(0, 2000);

        if (!name || !phone) {
          return jsonResponse(
            { error: "Name and phone are required." },
            400
          );
        }

        await env.DB.prepare(
          `INSERT INTO enquiries
           (customer_name, phone, property, check_in, guests, message)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(name, phone, property, checkIn, guests, message).run();

        return jsonResponse(
          { success: true, message: "Enquiry saved." },
          201
        );
      }

      // Public active property list
      if (path === "/api/properties" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT * FROM properties WHERE active = 1 ORDER BY id DESC"
        ).all();

        return jsonResponse({ properties: result.results || [] });
      }

      // Protect all remaining API routes
      const authorised = await verifyAdmin(request, env);

      if (!authorised) {
        return jsonResponse({ error: "Admin login required." }, 401);
      }

      // Protect admin changes against cross-origin requests
      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        !isSameOrigin(request, url)
      ) {
        return jsonResponse({ error: "Invalid request origin." }, 403);
      }

      // Admin: view enquiries
      if (path === "/api/admin/enquiries" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT * FROM enquiries ORDER BY id DESC"
        ).all();

        return jsonResponse({ enquiries: result.results || [] });
      }

      // Admin: update enquiry status
      if (path.startsWith("/api/admin/enquiries/") && method === "PATCH") {
        const id = Number(path.split("/").pop());
        const data = await readJson(request);
        const status = String(data?.status || "").trim();

        if (
          !Number.isInteger(id) ||
          id < 1 ||
          !["New", "Contacted", "Confirmed", "Closed"].includes(status)
        ) {
          return jsonResponse(
            { error: "Invalid enquiry or status." },
            400
          );
        }

        await env.DB.prepare(
          "UPDATE enquiries SET status = ? WHERE id = ?"
        ).bind(status, id).run();

        return jsonResponse({ success: true });
      }

      // Admin: view all properties
      if (path === "/api/admin/properties" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT * FROM properties ORDER BY id DESC"
        ).all();

        return jsonResponse({ properties: result.results || [] });
      }

      // Admin: add a property
      if (path === "/api/admin/properties" && method === "POST") {
        const data = await readJson(request);

        if (!data || !String(data.name || "").trim()) {
          return jsonResponse(
            { error: "Property name is required." },
            400
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO properties
           (name, location, description, price, image_url, active)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          String(data.name).trim().slice(0, 200),
          String(data.location || "").slice(0, 200),
          String(data.description || "").slice(0, 2000),
          String(data.price || "").slice(0, 100),
          String(data.image_url || "").slice(0, 1000),
          data.active === 0 ? 0 : 1
        ).run();

        return jsonResponse(
          { success: true, id: result.meta.last_row_id },
          201
        );
      }

      // Admin: edit or delete a property
      if (path.startsWith("/api/admin/properties/")) {
        const id = Number(path.split("/").pop());

        if (!Number.isInteger(id) || id < 1) {
          return jsonResponse({ error: "Invalid property ID." }, 400);
        }

        if (method === "PUT") {
          const data = await readJson(request);

          if (!data || !String(data.name || "").trim()) {
            return jsonResponse(
              { error: "Property name is required." },
              400
            );
          }

          await env.DB.prepare(
            `UPDATE properties
             SET name = ?, location = ?, description = ?, price = ?,
                 image_url = ?, active = ?
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

          return jsonResponse({ success: true });
        }

        if (method === "DELETE") {
          await env.DB.prepare(
            "DELETE FROM properties WHERE id = ?"
          ).bind(id).run();

          return jsonResponse({ success: true });
        }
      }

      return jsonResponse({ error: "API route not found." }, 404);
    }

    // Serve website files
    if (!env.ASSETS) {
      return new Response("Website assets binding is unavailable.", {
        status: 500
      });
    }

    return env.ASSETS.fetch(request);
  }
};
