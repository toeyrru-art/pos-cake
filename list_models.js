import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = "AQ.Ab8RN6IHN6GqOx6WfekH-wpd4XbTJ5Y7CHJxXpx4ToEzm0nZ8g";
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(data.models.map(m => m.name));
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
