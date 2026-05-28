import { fetch } from 'undici';

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

      const res = await fetch('http://localhost:3000/api/analytics/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const json = await res.json();
      console.log(`[Bio ${i}] => ${json.bio || json.error}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}

async function main() {
  await testSpecialty('Lash Designer');
  await testSpecialty('Manicure');
  await testSpecialty('Cabeleireira');
}

main();
