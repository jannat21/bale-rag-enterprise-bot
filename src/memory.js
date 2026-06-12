const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

async function addToMemory(chatId, role, content) {
  const key = `chat:${chatId}`;
  await redis.lpush(key, JSON.stringify({ role, content, timestamp: Date.now() }));
  await redis.ltrim(key, 0, 9); // حداکثر ۱۰ پیام
  await redis.expire(key, 3600); // 1 ساعت
}

async function getMemory(chatId, maxTokens = 2000) {
  const items = await redis.lrange(`chat:${chatId}`, 0, -1);
  const history = items.map(JSON.parse).reverse();
  // محاسبه توکن (تخمینی: 1 توکن ≈ 0.75 کلمه در فارسی)
  let tokens = 0;
  const filtered = [];
  for (let i = history.length-1; i >= 0; i--) {
    const item = history[i];
    const approxTokens = (item.content.length / 2.5); // تخمین فارسی
    if (tokens + approxTokens > maxTokens) break;
    tokens += approxTokens;
    filtered.unshift(item);
  }
  return filtered;
}

module.exports = { addToMemory, getMemory };