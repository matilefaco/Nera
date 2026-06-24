import express from "express";
import fetch from "node-fetch";

async function test() {
  console.log("Testing POST /api/notify...");
  
  // This will fail with 401 without token, but it WILL hit the server!
  // If we get 401, it means the route exists and is reachable.
  // If we get 404, it means the route doesn't exist.
  const res = await fetch("http://localhost:3000/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "TEST", payload: {} })
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text);
}

test().catch(console.error);
