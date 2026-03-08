const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'config.json');

const setBotStatus = (status) => {
    try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        cfg.botStatus = status; // 'active' או 'idle'
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    } catch (e) {
        console.error("Error updating bot status:", e);
    }
};

async function waitMinutes(minutes) {
    const ms = minutes * 60 * 1000;
    const checkStep = 5000; // בודק כל 5 שניות אם המשתמש עצר את הבוט
    for (let i = 0; i < ms; i += checkStep) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!cfg.runInLoop) return false; // המשתמש כיבה את הלולאה בדשבורד
        await new Promise(resolve => setTimeout(resolve, checkStep));
    }
    return true;
}

module.exports = { setBotStatus, waitMinutes };