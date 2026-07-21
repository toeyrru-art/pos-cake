import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = "AQ.Ab8RN6IHN6GqOx6WfekH-wpd4XbTJ5Y7CHJxXpx4ToEzm0nZ8g";
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("hello");
    console.log("Success:", result.response.text());
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
