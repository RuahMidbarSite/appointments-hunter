const mongoose = require('mongoose');

const ScanGroupSchema = new mongoose.Schema({
    groupName: { type: String, required: true, unique: true },
    templates: [mongoose.Schema.Types.Mixed], // שומר את כל התבניות שבתוך הקבוצה
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ScanGroup || mongoose.model('ScanGroup', ScanGroupSchema);