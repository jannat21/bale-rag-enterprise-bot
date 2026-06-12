const { Sequelize, DataTypes } = require("sequelize");

// اتصال به MySQL (اطلاعات را از env بگیرید)
const sequelize = new Sequelize(
    process.env.DB_NAME || "bale_bot",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
        host: process.env.DB_HOST || "localhost",
        dialect: "mysql",
        logging: false, // لاگ کوئری‌ها (در production false)
    }
);

// تعریف مدل پیام
const ChatMessage = sequelize.define("ChatMessage", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    chatId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "chat_id",
    },
    role: {
        type: DataTypes.ENUM("user", "assistant"),
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "created_at",
    },
}, {
    tableName: "chat_history",
    timestamps: false, // خودمان createdAt را مدیریت می‌کنیم
    indexes: [
        {
            fields: ["chat_id", "created_at"],
        },
    ],
});

// تابع برای ذخیره یک پیام
async function saveMessage(chatId, role, content) {
    await ChatMessage.create({
        chatId,
        role,
        content,
    });
}

// تابع برای دریافت تاریخچه اخیر (مثلاً N پیام آخر)
async function getRecentHistory(chatId, limit = 6) {
    const messages = await ChatMessage.findAll({
        where: { chatId },
        order: [["createdAt", "DESC"]],
        limit,
    });
    return messages.reverse(); // برگردان به ترتیب قدیم به جدید
}

async function getRelevantHistory(chatId, limit = 4) {
    // فقط جفت‌های (user, assistant) را که assistant پاسخ غیر از "اطلاعات کافی..." داده بردار
    const messages = await ChatMessage.findAll({
        where: { chatId },
        order: [["createdAt", "DESC"]],
        limit: limit * 2 // چون user+assistant
    });
    const filtered = [];
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === "assistant" &&
            !messages[i].content.includes("اطلاعات کافی") &&
            !messages[i].content.includes("پیدا نشد")) {
            // جفت قبلی کاربر را هم اضافه کن
            if (messages[i + 1] && messages[i + 1].role === "user") {
                filtered.unshift(messages[i + 1], messages[i]);
            }
        }
    }
    return filtered.slice(0, limit);
}

// همگام‌سازی جدول (در صورت عدم وجود)
async function initDatabase() {
    try {
        await sequelize.authenticate();
        console.log("✅ MySQL connected");
        await ChatMessage.sync({ alter: true });
        console.log("✅ Chat history table synced");
    } catch (err) {
        console.error("❌ DB error:", err.message);
        process.exit(1);
    }
}

module.exports = {
    initDatabase,
    saveMessage,
    getRecentHistory,
    getRelevantHistory,
    sequelize,
};