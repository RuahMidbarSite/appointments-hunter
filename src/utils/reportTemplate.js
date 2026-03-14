export const generateReportHtml = (logs, familyMember) => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    
    let appointmentsFound = 0;
    const doctorsCount = {};
    const cityCount = {};
    const hoursCount = {};

    const logEntries = safeLogs.map(line => {
        const currentLine = String(line || '');
        const isFound = currentLine.includes('נמצא תור') || currentLine.includes('✅');
        const isScan = currentLine.includes('סבב סריקה') || currentLine.includes('🔄');
        
        if (isFound) {
            appointmentsFound++;
            
            // חילוץ עיר
            const cityMatch = currentLine.match(/עיר:\s*([^|]+)/);
            if (cityMatch) {
                const cityName = cityMatch[1].trim();
                cityCount[cityName] = (cityCount[cityName] || 0) + 1;
            }

            // חילוץ רופא
            const docMatch = currentLine.match(/רופא:\s*([^|]+)/);
            if (docMatch) {
                const docName = docMatch[1].trim();
                doctorsCount[docName] = (doctorsCount[docName] || 0) + 1;
            }

            // חילוץ שעה למפת חום
            const timeMatch = currentLine.match(/(\d{1,2}):\d{2}:\d{2}/);
            if (timeMatch) {
                const hour = timeMatch[1].padStart(2, '0');
                hoursCount[hour] = (hoursCount[hour] || 0) + 1;
            }
        }

        // עיצוב שורת לוג בודדת
        if (isFound) {
            return `
                <div class="p-4 mb-3 rounded-2xl border-2 bg-green-50 border-green-200 shadow-sm">
                    <div class="flex justify-between items-start">
                        <span class="text-2xl">🎯</span>
                        <span class="text-xs font-mono text-gray-400">${currentLine.split(']')[0].replace('[', '')}</span>
                    </div>
                    <div class="mt-2 text-green-900 font-bold text-lg">${currentLine.split(']')[1] || currentLine}</div>
                </div>`;
        }
        return ''; // אנחנו לא מציגים את הסריקות הריקות כדי למנוע רשימות ארוכות
    }).join('');

    // בניית ויזואליזציה של שעות
    const heatMapHtml = Object.entries(hoursCount).length > 0 ? `
        <div class="mb-8">
            <h3 class="text-xl font-black text-gray-700 mb-4">⏰ התפלגות מציאת תורים לפי שעות</h3>
            <div class="flex items-end gap-1 h-32 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                ${Array.from({length: 24}).map((_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    const count = hoursCount[hour] || 0;
                    const height = count > 0 ? Math.max((count / appointmentsFound) * 100, 10) : 0;
                    return `<div class="flex-1 bg-teal-500 rounded-t-sm" style="height: ${height}%" title="${hour}:00 - ${count} תורים"></div>`;
                }).join('')}
            </div>
            <div class="flex justify-between text-[10px] text-gray-400 mt-2 px-1">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
            </div>
        </div>
    ` : '';

    return `
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="p-6 bg-slate-50 font-sans text-right">
            <div class="max-w-3xl mx-auto bg-white p-8 shadow-xl rounded-[2.5rem] border border-gray-100">
                <div class="mb-10 text-center">
                    <h1 class="text-4xl font-black text-gray-900">📊 סיכום צייד התורים</h1>
                    <p class="text-teal-600 font-bold mt-2">דוח פעילות עבור: ${familyMember || 'כל המשפחה'}</p>
                </div>
                
                <div class="grid grid-cols-3 gap-4 mb-10">
                    <div class="bg-teal-600 text-white p-5 rounded-3xl text-center shadow-lg shadow-teal-100">
                        <div class="text-sm opacity-80">תורים נמצאו</div>
                        <div class="text-4xl font-black">${appointmentsFound}</div>
                    </div>
                    <div class="bg-indigo-600 text-white p-5 rounded-3xl text-center shadow-lg shadow-indigo-100">
                        <div class="text-sm opacity-80">ערים נסרקו</div>
                        <div class="text-4xl font-black">${Object.keys(cityCount).length}</div>
                    </div>
                    <div class="bg-amber-500 text-white p-5 rounded-3xl text-center shadow-lg shadow-amber-100">
                        <div class="text-sm opacity-80">רופאים זמינים</div>
                        <div class="text-4xl font-black">${Object.keys(doctorsCount).length}</div>
                    </div>
                </div>

                ${heatMapHtml}

                <h3 class="text-xl font-black text-gray-700 mb-4">🏆 הממצאים הכי טובים</h3>
                <div class="space-y-2">
                    ${logEntries || '<div class="text-center py-10 text-gray-400">טרם נמצאו תורים שתואמים את הקריטריונים</div>'}
                </div>
            </div>
        </body></html>`;
};