const { DataTypes } = require("sequelize");
const { sequelize } = require("./chatHistory"); // از اتصال قبلی استفاده می‌کنیم

const DocumentChunk = sequelize.define("DocumentChunk", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    source: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "نام فایل یا منبع",
    },
    embedding: {
        type: DataTypes.TEXT, // MySQL 8.0+ می‌تواند JSON یا TEXT باشد
        allowNull: false,
        get() {
            const raw = this.getDataValue("embedding");
            return raw ? JSON.parse(raw) : [];
        },
        set(value) {
            this.setDataValue("embedding", JSON.stringify(value));
        },
    },
    tokens: {
        type: DataTypes.TEXT, // برای ذخیره لیست توکن‌های قطعه
        allowNull: true,
        get() {
            const raw = this.getDataValue("tokens");
            return raw ? JSON.parse(raw) : [];
        },
        set(value) {
            this.setDataValue("tokens", JSON.stringify(value));
        },
    },
    metadata: {
        type: DataTypes.JSON, // برای اطلاعات اضافی مثل page number
        allowNull: true,
    },
}, {
    tableName: "document_chunks",
    timestamps: true, // createdAt, updatedAt خودکار
    indexes: [
        { fields: ["source"] },
        { fields: ["createdAt"] },
    ],
});

module.exports = { DocumentChunk };