import fetch from "node-fetch";

async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: "testuid1",
        name: "Joelma Soares Rolim",
        email: "mamaifood23@gmail.com",
        plan: "free"
      })
    });
    console.log("STATUS:", res.status);
    const json = await res.json().catch(() => null);
    console.log("BODY:", json);
  } catch(e) {
    console.error(e);
  }
}
run();
