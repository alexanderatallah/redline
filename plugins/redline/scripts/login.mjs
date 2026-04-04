#!/usr/bin/env node

/**
 * OpenRouter OAuth PKCE login flow.
 * Opens browser, receives callback on localhost:3000, exchanges code for API key.
 */

import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const code_verifier = Buffer.from(array).toString("base64url");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code_verifier),
  );
  const code_challenge = Buffer.from(digest).toString("base64url");
  return { code_verifier, code_challenge };
}

async function login() {
  const { code_verifier, code_challenge } = await generatePKCE();
  const callbackUrl = "http://localhost:3000/callback";

  let resolveCode;
  const codePromise = new Promise((res) => { resolveCode = res; });

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost:3000");
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (code) {
        resolveCode(code);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body style="font-family:system-ui;text-align:center;padding:60px">
          <h1>Authenticated!</h1>
          <p>You can close this tab and return to your terminal.</p>
        </body></html>`);
        return;
      }
      res.writeHead(400);
      res.end("Missing code parameter");
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(3000, "127.0.0.1");

  const authUrl =
    `https://openrouter.ai/auth` +
    `?callback_url=${encodeURIComponent(callbackUrl)}` +
    `&code_challenge=${code_challenge}` +
    `&code_challenge_method=S256`;

  console.log(`Opening browser for authentication...\n\n  ${authUrl}\n`);

  try {
    if (process.platform === "darwin") execSync(`open "${authUrl}"`);
    else if (process.platform === "win32") execSync(`start "${authUrl}"`);
    else execSync(`xdg-open "${authUrl}"`);
  } catch {
    // Browser open failed — user can copy the URL
  }

  console.log("Waiting for callback...");
  const code = await codePromise;
  server.close();

  const resp = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier,
      code_challenge_method: "S256",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Key exchange failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const key = data.key;
  const masked = key.length > 10 ? key.slice(0, 6) + "..." + key.slice(-4) : "****";

  console.log(`\nAuthenticated! Key: ${masked}`);
  console.log(`\nSet this in your environment:\n  export OPENROUTER_API_KEY="${key}"\n`);
  console.log(`Or configure it in the plugin settings with /redline:setup`);

  return { key, user_id: data.user_id };
}

login().catch((err) => {
  console.error(`Login failed: ${err.message}`);
  process.exit(1);
});
