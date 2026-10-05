const samples = Array.from({ length: 1000 }, (_, i) => 100 + (i % 50));
const healthState = process.argv[2] || "F";

for (let i = 0; i < 20; i++) {
  const res = await fetch("http://localhost:8080/api/sensor/data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ samples, samplingRate: 1000, healthState }),
  });
  const text = await res.text();
  console.log(res.status, text.slice(0, 200));
  await new Promise((r) => setTimeout(r, 1000));
}