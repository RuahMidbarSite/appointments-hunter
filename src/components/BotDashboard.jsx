import React, { useState } from 'react';
import { CLALIT_GROUPS, CLALIT_SPECIALIZATIONS } from '../scrapers/health/constants/professions';

export default function BotDashboard() {
    const [config, setConfig] = useState({
        userId: '',
        city: 'הרצליה',
        selectedGroup: '32',
        selectedSpecialization: '32',
        startDate: '',
        endDate: ''
    });

    const [status, setStatus] = useState('idle');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
        setStatus('idle');
    };

    const handleSearch = async () => {
        setStatus('loading');
        try {
            const response = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (response.ok) {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (error) {
            console.error('שגיאה:', error);
            setStatus('idle');
        }
    };

    // פונקציית עזר חכמה שיודעת לקרוא גם מערכים וגם אובייקטים
    const renderOptions = (data) => {
        if (!data) return null;
        
        // אם זה מערך של אובייקטים
        if (Array.isArray(data)) {
            return data.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
            ));
        }
        
        // אם זה אובייקט
        return Object.entries(data).map(([key, val]) => {
            // שולף את הערכים בהתאם למבנה הנתונים שלך
            const valueId = typeof val === 'object' ? val.id : key;
            const valueName = typeof val === 'object' ? val.name : val;
            return <option key={key} value={valueId}>{valueName}</option>;
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-purple-800 to-purple-600 p-6 text-white text-center">
                    <h1 className="text-3xl font-bold tracking-tight mb-1">צייד התורים</h1>
                    <p className="text-purple-100 text-sm">מערכת סריקה חכמה לכללית</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">תעודת זהות</label>
                            <input 
                                type="text" 
                                name="userId" 
                                value={config.userId} 
                                onChange={handleChange} 
                                placeholder="הכנס תעודת זהות"
                                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">עיר / יישוב</label>
                            <input 
                                type="text" 
                                name="city" 
                                value={config.city} 
                                onChange={handleChange}
                                placeholder="למשל: תל אביב"
                                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">סוג שירות</label>
                            <select 
                                name="selectedGroup" 
                                value={config.selectedGroup} 
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            >
                                {renderOptions(CLALIT_GROUPS)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">התמחות</label>
                            <select 
                                name="selectedSpecialization" 
                                value={config.selectedSpecialization} 
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            >
                                {CLALIT_SPECIALIZATIONS[config.selectedGroup] ? 
                                    renderOptions(CLALIT_SPECIALIZATIONS[config.selectedGroup]) : 
                                    <option value="">בחר קבוצה קודם</option>
                                }
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 mt-6 border-t border-gray-100">
                        <button 
                            onClick={handleSearch} 
                            disabled={status === 'loading'}
                            className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all transform hover:-translate-y-0.5
                                ${status === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 
                                  status === 'success' ? 'bg-green-500 hover:bg-green-600 shadow-green-200' : 
                                  'bg-purple-600 hover:bg-purple-700 shadow-purple-200'}
                            `}
                        >
                            {status === 'loading' ? 'מפעיל בוט...' : 
                             status === 'success' ? 'הבוט החל לסרוק! 🚀' : 
                             'חפש תור עכשיו'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}