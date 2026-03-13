const mongoose = require('mongoose');

const SearchTemplateSchema = new mongoose.Schema({
    templateName: { type: String, required: true, unique: true },
    userId: String,
    userCode: String,
    password: String,
    familyMember: String,
    loginMode: { type: String, default: 'password' },
    selectedGroup: String,
    selectedSpecialization: String,
    selectedCities: [String],
    selectedDoctors: [String],
    selectedDoctorNames: [String],
    includeSurrounding: { type: Boolean, default: true },
    insuranceType: { type: String, default: 'הכל' },
    endDate: String,
    loopFrequency: String,
    startTime: String,
    endTime: String,
    // השדות החדשים
    saveDate: String, // יום.חודש
    saveTime: String, // שעה:דקה
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.SearchTemplate || mongoose.model('SearchTemplate', SearchTemplateSchema, 'search_templates');