async function testSpecialty(specialtyName) {
  console.log(`\n== ${specialtyName.toUpperCase()} ==`);
  const results = [];
  
  for(let i=0; i<3; i++) {
    try {
      const payload = {
        name: `Teste${i}`,
        specialty: specialtyName,
        yearsExperience: "5 anos",
        serviceStyle: ["Rápido", "Prático"],
        differentials: ["Agilidade", "Foco no resultado"]
      };

      const res = await fetch('http://localhost:3000/api/generate-content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer FAKE_TOKEN' // maybe it requires auth? we will see
        },
        body: JSON.stringify(payload)
      });
      
      const txt = await res.text();
      try {
        const json = JSON.parse(txt);
        console.log(`[Bio ${i}] STATUS=${res.status} => ${json.bio || json.error || txt}`);
      } catch(e) {
        console.log(`[Bio ${i}] STATUS=${res.status} JSON ERROR => TXT='${txt}'`);
      }
    } catch (e) {
      console.error('Fetch err:', e.message);
    }
  }
}

async function main() {
  await testSpecialty('Lash Designer');
  await testSpecialty('Manicure');
  await testSpecialty('Cabeleireira');
}

main();
