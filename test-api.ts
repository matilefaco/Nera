import dotenv from "dotenv";
dotenv.config();

async function runTest(specialtyName) {
  console.log(`\n=== ${specialtyName} ===`);
  const fetch = (await import("node-fetch")).default;
  
  for(let i=0; i<5; i++) {
    try {
      const res = await fetch("http://localhost:3000/api/generate-content", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          specialty: specialtyName,
          name: "Juliana",
          yearsExperience: "5 anos",
          serviceStyle: "Cuidadoso",
          differentials: "Bom atendimento"
        })
      });
      const data = await res.json();
      if(data.headline) {
        console.log(`HL: ${data.headline}`);
        console.log(`BIO: ${data.bio}\n`);
      } else {
        console.log(data);
      }
    } catch(e) {
      console.log(e.message);
    }
  }
}

async function start() {
  await runTest('Nail Designer');
  await runTest('Trancista');
}
start();
