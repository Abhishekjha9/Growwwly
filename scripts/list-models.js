const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

async function listModels() {
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Using the REST API endpoint manually if the SDK doesn't have listModels
    // wait, @google/genai has client.models.list() maybe?
    // Let's use standard fetch to be safe
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log(data.models.map(m => m.name));
  } catch (err) {
    console.error("Error:", err);
  }
}

listModels();
