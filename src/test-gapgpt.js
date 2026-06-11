require("dotenv").config();
const axios = require("axios");

async function main() {
  try {
    const response = await axios.post(
      `${process.env.GAPGPT_BASE_URL}/chat/completions`,
      {
        model: "gpt-4o",
        messages: [
          { role: "user", content: "سلام!" }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GAPGPT_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    console.log(response.data.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
  }
}

main();
