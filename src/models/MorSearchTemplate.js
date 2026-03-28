const mongoose = require('mongoose');

const morSearchTemplateSchema = new mongoose.Schema({
    // פרטי התחברות
    userId: { type: String, required: true },
    userCode: { type: String },
    password: { type: String },
    familyMember: { type: String },
    email: { type: String },
    loginMode: { type: String, default: 'password' },
    
    // הגדרות ספציפיות למכון מור
   morSettings: {
        useManualPath: { type: Boolean, default: false },
        targetReferral: { type: String },
        insuranceType: { type: String },
        category: { type: String },
        subCategory: { type: String }, // השדה שהיה חסר לתת-קטגוריה
        targetOrgan: { type: String }, // השדה שהיה חסר לאיבר/סוג הבדיקה
        phonePrefix: { type: String },
        phoneSuffix: { type: String },
        areaPriority: [{ type: String }]
    },

    // הגדרות תזמון ולולאה
    endDate: { type: String },
    loopFrequency: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    
    // שדות ניהול ותוצאות סריקה (הוספת שדות מפורטים)
    templateName: { type: String, required: true },
    saveDate: { type: String },
    saveTime: { type: String },
    lastFoundDate: { type: String },
    lastBestFound: { type: String },
    bestBranch: { type: String }, // המקום/סניף
    bestDate: { type: String },   // תאריך התור
    bestTime: { type: String },   // שעת התור
    provider: { type: String, default: 'MACHON_MOR' },
    activeEngines: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.models.MorSearchTemplate || mongoose.model('MorSearchTemplate', morSearchTemplateSchema);