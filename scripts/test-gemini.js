const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

const GEMINI_MODEL = "gemini-3.6-flash";

async function test() {
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // basic test
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: "hello",
    });
    
    console.log("Success:", response.text);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
