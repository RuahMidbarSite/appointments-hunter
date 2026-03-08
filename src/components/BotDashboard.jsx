import React, { useState, useRef, useEffect } from 'react';
import { CLALIT_GROUPS, CLALIT_SPECIALIZATIONS } from '../scrapers/health/constants/professions';
import { AVAILABLE_CITIES } from '../scrapers/health/constants/cities';
import { AVAILABLE_DOCTORS } from '../scrapers/health/constants/doctors_display';

// קומפוננטה חכמה שתומכת גם ברשימת טקסטים וגם ברשימת אובייקטים
const MultiSelectDropdown = ({ options, selected, onChange, placeholder, isObject = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(opt => {
        const text = isObject ? opt.label : opt;
        return text.includes(searchTerm);
    });

    const toggleOption = (option) => {
        const value = isObject ? option.id : option;
        if (selected.includes(value)) {
            onChange(selected.filter(item => item !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const getSelectedLabels = () => {
        if (selected.length === 0) return <span className="text-gray-400">{placeholder}</span>;
        if (!isObject) return selected.join(', ');
        return selected.map(val => options.find(o => o.id === val)?.label || val).join(', ');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer text-gray-700 focus:bg-white focus:ring-2 focus:ring-purple-500 transition-all min-h-[48px] flex items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="truncate">{getSelectedLabels()}</div>
            </div>
            
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 flex flex-col">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                            placeholder="חפש וסנן..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(option => {
                            const value = isObject ? option.id : option;
                            const label = isObject ? option.label : option;
                            return (
                                <label key={value} className="flex items-center px-3 py-2 hover:bg-purple-50 rounded cursor-pointer transition-colors">
                                    <input 
                                        type="checkbox" 
                                        className="ml-3 accent-purple-600 w-4 h-4"
                                        checked={selected.includes(value)}
                                        onChange={() => toggleOption(option)}
                                    />
                                    <span className="text-sm text-gray-700">{label}</span>
                                </label>
                            );
                        }) : (
                            <div className="p-3 text-sm text-gray-500 text-center">לא נמצאו תוצאות לחיפוש</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function BotDashboard() {
    const [config, setConfig] = useState({
        userId: '', 
        userCode: '', 
        password: '', 
        familyMember: '', 
        selectedCities: ['הרצליה'], 
        selectedDoctors: [], 
        selectedGroup: '32',
        selectedSpecialization: '32',
        endDate: ''
    });

    // משיכת נתונים מה-ENV בטעינת הדף (לצרכי פיתוח)
    useEffect(() => {
        const fetchEnvData = async () => {
            try {
                const response = await fetch('/api/save-config');
                if (response.ok) {
                    const data = await response.json();
                    setConfig(prev => ({
                        ...prev,
                        userId: data.userId || prev.userId,
                        userCode: data.userCode || prev.userCode,
                        password: data.password || prev.password,
                        familyMember: data.familyMember || prev.familyMember
                    }));
                }
            } catch (error) {
                console.error("שגיאה במשיכת נתוני ENV:", error);
            }
        };
        fetchEnvData();
    }, []);

    const [status, setStatus] = useState('idle');
const [showPassword, setShowPassword] = useState(false);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
        setStatus('idle');
    };

    const handleCitiesChange = (newCities) => {
        setConfig(prev => ({ ...prev, selectedCities: newCities }));
        setStatus('idle');
    };

    const handleDoctorsChange = (newDoctors) => {
        setConfig(prev => ({ ...prev, selectedDoctors: newDoctors }));
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
                // הסטטוס נשאר success כדי שהכפתור יישאר ירוק בזמן הריצה
                setStatus('success');
            } else {
                setStatus('idle');
                alert('השרת החזיר שגיאה בהפעלת הבוט');
            }
        } catch (error) {
            console.error('שגיאה:', error);
            setStatus('idle');
            alert('שגיאה בתקשורת עם השרת');
        }
    };
const handleStop = async () => {
        try {
            const response = await fetch('/api/save-config', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' }) 
            });
            
            if (response.ok) {
                // החזרת הסטטוס ל-idle משנה את צבע כפתור החיפוש חזרה לסגול
                setStatus('idle');
                alert('הבוט הופסק בהצלחה 🛑');
            } else {
                alert('השרת החזיר שגיאה בניסיון העצירה');
            }
        } catch (error) {
            console.error('שגיאה בעצירת הבוט:', error);
            alert('שגיאה בתקשורת עם השרת');
        }
    };
    const renderOptions = (data) => {
        if (!data) return null;
        if (Array.isArray(data)) {
            return data.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
            ));
        }
        return Object.entries(data).map(([key, val]) => {
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
                        
                     {/* 1. תעודת זהות */}
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">תעודת זהות</label>
                        <input 
    type="text" 
    name="userId" 
    autoComplete="no-fill-id"
    value={config.userId} 
    onChange={handleChange} 
    placeholder="השאר ריק לשימוש ב-ENV"
    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 transition-all outline-none"
/>
                        </div>

                        {/* 2. קוד משתמש */}
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">קוד משתמש</label>
                            <input 
    type="text" 
    name="userCode" 
    autoComplete="no-fill-code"
    value={config.userCode} 
    onChange={handleChange} 
    placeholder="השאר ריק לשימוש ב-ENV"
    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 transition-all outline-none"
/>
                        </div>

                        {/* 3. סיסמה עם כפתור חשיפה */}
                        <div className="space-y-1 relative">
                            <label className="block text-sm font-semibold text-gray-700">סיסמה</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    name="password" 
                                    value={config.password} 
                                    onChange={handleChange} 
                                    placeholder="השאר ריק לשימוש ב-ENV"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 transition-all outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-600 focus:outline-none"
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>

                        {/* 2. בן/בת משפחה */}
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">שם בן/בת משפחה (אופציונלי)</label>
                            <input 
                                type="text" 
                                name="familyMember" 
                                value={config.familyMember} 
                                onChange={handleChange}
                                placeholder="למשל: יובל (השאר ריק עבורך)"
                                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            />
                        </div>

                        {/* 3. סוג שירות */}
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

                        {/* 4. התמחות */}
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

                        {/* 5. ערים לסריקה */}
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">ערים לסריקה</label>
                            <MultiSelectDropdown 
                                options={AVAILABLE_CITIES} 
                                selected={config.selectedCities} 
                                onChange={handleCitiesChange} 
                                placeholder="בחר ערים מהרשימה..." 
                            />
                        </div>

                        {/* 6. רופאים מועדפים */}
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-gray-700">רופאים מועדפים (אופציונלי)</label>
                            <MultiSelectDropdown 
                                options={AVAILABLE_DOCTORS} 
                                selected={config.selectedDoctors} 
                                onChange={handleDoctorsChange} 
                                placeholder="בחר רופאים (או השאר ריק לכולם)..." 
                                isObject={true}
                            />
                        </div>

                        {/* 7. תאריך יעד אחרון (רוחב מלא) */}
                        <div className="space-y-1 md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700">תאריך יעד אחרון (אופציונלי)</label>
                            <input 
                                type="date" 
                                name="endDate" 
                                value={config.endDate} 
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 mt-6 border-t border-gray-100 flex gap-4">
                        <button 
                            onClick={handleSearch} 
                            disabled={status === 'loading'}
                            className={`flex-1 py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all transform hover:-translate-y-0.5
                                ${status === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 
                                  status === 'success' ? 'bg-green-500 hover:bg-green-600 shadow-green-200' : 
                                  'bg-purple-600 hover:bg-purple-700 shadow-purple-200'}
                            `}
                        >
                            {status === 'loading' ? 'מפעיל בוט...' : 
                             status === 'success' ? 'הבוט החל לסרוק! 🚀' : 
                             'חפש תור עכשיו'}
                        </button>

                        <button 
                            onClick={handleStop}
                            className="w-1/3 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all transform hover:-translate-y-0.5"
                        >
                            עצור בוט
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}