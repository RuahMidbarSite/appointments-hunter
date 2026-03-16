import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    const reportPath = path.join(process.cwd(), 'reports_history.log');
    
    if (!fs.existsSync(reportPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send('<h2 style="text-align:center; font-family:sans-serif; margin-top:50px;">טרם נמצאו נתונים בלוג</h2>');
    }

    try {
        const fileContent = fs.readFileSync(reportPath, 'utf8');
        const lines = fileContent.trim().split('\n').reverse();
        
        let appointmentsFound = 0;
        const citiesCount = {};
        const groupCount = {}; 
        const hoursCount = {};

        const logEntriesHtml = lines.map(line => {
            if (line.includes('נמצא תור:')) {
                appointmentsFound++;
                
                // פונקציית חילוץ גמישה לרווחים וסימנים
                const extract = (key) => {
                    const regex = new RegExp(`${key}:\\s*([^|\\n]+)`);
                    const match = line.match(regex);
                    return match ? match[1].trim() : null;
                };

                const city = extract('עיר');
                let group = extract('תחום');

                // גיבוי לשורות שאין בהן את המילה "תחום" (שורות ישנות)
                if (!group) {
                    const docName = extract('רופא');
                    if (docName) {
                        if (docName.includes('דאבוש') || docName.includes('פינחסוב')) group = 'אורתופדיה';
                        else if (docName.includes('שיף')) group = 'אורולוגיה';
                        else if (docName.includes('אבו עצב')) group = 'ניירולוגיה';
                    }
                }
                
                if (city) citiesCount[city] = (citiesCount[city] || 0) + 1;

                if (group) {
                    groupCount[group] = (groupCount[group] || 0) + 1;
                } else {
                    groupCount['כללי/אחר'] = (groupCount['כללי/אחר'] || 0) + 1;
                }

                // --- תיקון: חילוץ שעה נכון ---
                // הפורמט בלוג הוא: [14.3.2026, 11:23:45]
                // הביטוי הישן יכל לתפוס ספרות מהתאריך (כגון "26" מ-"2026")
                // הביטוי החדש מחפש את השעה *אחרי* הפסיק שבתוך הסוגריים המרובעים
                const hourMatch = line.match(/\[\d{1,2}[./]\d{1,2}[./]\d{4},\s*(\d{1,2}):\d{2}:\d{2}/);
                if (hourMatch) {
                    const hour = hourMatch[1].padStart(2, '0');
                    hoursCount[hour] = (hoursCount[hour] || 0) + 1;
                }

                const content = line.includes(']') ? line.split(']')[1].trim() : line;
                return `<div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:12px; margin-bottom:8px; font-family:sans-serif; font-size:14px; color:#14532d;">
                            <b>🎯</b> ${content}
                        </div>`;
            }
            return '';
        }).join('');

        const groupStatsHtml = Object.entries(groupCount).length > 0 
            ? Object.entries(groupCount).sort((a,b) => b[1]-a[1]).map(([name, count]) => `
                <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-family:sans-serif;">
                    <span style="font-weight:bold; color:#334155;">${name}</span>
                    <span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:8px; font-weight:900; font-size:13px;">${count}</span>
                </div>`).join('')
            : '<p style="text-align:center; color:#94a3b8; font-family:sans-serif; padding:20px;">אין נתוני תחומים — הנתונים ייצברו מהסריקה הבאה</p>';

        const heatMapHtml = Object.entries(hoursCount).sort().map(([h, c]) => `
            <div style="margin-bottom:8px; display:flex; align-items:center; gap:10px; font-family:sans-serif;">
                <span style="width:40px; font-weight:bold; color:#64748b; font-size:12px;">${h}:00</span>
                <div style="flex:1; background:#f1f5f9; height:8px; border-radius:10px; overflow:hidden;">
                    <div style="width:${Math.min((c/appointmentsFound)*100*2.5, 100)}%; background:#0d9488; height:100%;"></div>
                </div>
                <span style="font-weight:bold; color:#0d9488; font-size:12px;">${c}</span>
            </div>`).join('');

        const htmlContent = `
            <html dir="rtl" lang="he">
            <head><meta charset="UTF-8"><title>דוח פעילות</title></head>
            <body style="background:#f1f5f9; padding:20px; font-family:sans-serif; text-align:right;">
                <div style="max-width:800px; margin:0 auto; background:white; padding:40px; border-radius:30px; border:1px solid #e2e8f0; position:relative;">
                    <button onclick="window.print()" style="position:absolute; left:40px; top:40px; background:#005a4c; color:white; border:none; padding:10px 20px; border-radius:12px; font-weight:bold; cursor:pointer;" class="no-print">🖨️ שמור PDF</button>
                    <style>@media print {.no-print {display:none} body {padding:0}}</style>
                    <h1 style="color:#0f172a; margin-bottom:30px;">📋 דוח פעילות</h1>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; margin-bottom:30px; text-align:center; color:white;">
                        <div style="background:#00a896; padding:20px; border-radius:20px;">
                            <div style="font-size:12px;">תורים</div><div style="font-size:30px; font-weight:900;">${appointmentsFound}</div>
                        </div>
                        <div style="background:#4f46e5; padding:20px; border-radius:20px;">
                            <div style="font-size:12px;">ערים</div><div style="font-size:30px; font-weight:900;">${Object.keys(citiesCount).length}</div>
                        </div>
                        <div style="background:#f59e0b; padding:20px; border-radius:20px;">
                            <div style="font-size:12px;">תחומים</div><div style="font-size:30px; font-weight:900;">${Object.keys(groupCount).length}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:25px; margin-bottom:30px;">
                        <div style="background:#f8fafc; padding:20px; border-radius:20px; border:1px solid #e2e8f0;">
                            <h3 style="margin-top:0; color:#1e293b;">⏰ שעות זהב</h3>
                            ${heatMapHtml}
                        </div>
                        <div style="background:white; padding:20px; border-radius:20px; border:1px solid #e2e8f0;">
                            <h3 style="margin-top:0; color:#1e293b;">📈 לפי תחום</h3>
                            ${groupStatsHtml}
                        </div>
                    </div>
                    
                    <h3 style="color:#1e293b;">📜 היסטוריה</h3>
                    <div style="max-height:400px; overflow-y:auto;">${logEntriesHtml}</div>
                </div>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlContent);
    } catch (e) { 
        return res.status(500).send("Error generating report"); 
    }
}