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
        phonePrefix: { type: String },
        phoneSuffix: { type: String },
        areaPriority: [{ type: String }]
    },

    // הגדרות תזמון ולולאה (השדות שהיו חסרים)
    endDate: { type: String },
    loopFrequency: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    
    // שדות ניהול כלליים של התבנית
    templateName: { type: String, required: true },
    saveDate: { type: String },
    saveTime: { type: String },
    lastFoundDate: { type: String },
    lastBestFound: { type: String },
    activeEngines: [{ type: String }]
}, { timestamps: true });

// מניעת דריסה אם המודל כבר נטען
module.exports = mongoose.models.MorSearchTemplate || mongoose.model('MorSearchTemplate', morSearchTemplateSchema);