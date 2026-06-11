const axios = require("axios");

async function askGapGPT(prompt) {

  console.log("prompt:",prompt);
  console.log("__________________");
    
  const response = await axios.post(
    `${process.env.GAPGPT_BASE_URL}/chat/completions`,
    {
      model: "gpt-5-nano",
      messages: [
        { role: "user", content: prompt }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.GAPGPT_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );
  return response.data.choices[0].message.content;
}

module.exports = { askGapGPT };
