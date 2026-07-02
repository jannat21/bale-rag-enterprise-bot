const OpenAI = require('openai');
require("dotenv").config();

// اگر از ES Module استفاده می‌کنید: import OpenAI from 'openai';

const metis_api_key = process.env.METISAI_APIKEY; // کلید API خود را جایگزین کنید

const client = new OpenAI({
    apiKey: metis_api_key,
    baseURL: 'https://api.metisai.ir/openai/v1',
});

async function main() {
    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'what time is it?' }],
            max_tokens: 100,
        });
        console.log(response.choices[0].message.content);
    } catch (error) {
        console.error('خطا:', error);
    }
}

main();