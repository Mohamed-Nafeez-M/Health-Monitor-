const samples = Array.from({ length: 1000 }, (_, i) => 100 + (i % 50));
const healthState = process.argv[2] || "F";

const res = await fetch("http://localhost:8080/api/sensor/data", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ samples, samplingRate: 1000, healthState }),
});
const json = await res.json();
console.log(res.status, json.healthState, json.connectionStatus);