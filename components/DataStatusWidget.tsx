import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';

export const DataStatusWidget = ({ className = "" }: { className?: string }) => {
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    // Initial random offset to make it look like it was updated recently but not exact second
    useEffect(() => {
        setLastUpdated(new Date(Date.now() - 1000 * 60 * 5)); // 5 mins ago initially
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        // Simulate network request
        setTimeout(() => {
            setLastUpdated(new Date());
            setRefreshing(false);
        }, 800);
    };

    return (
        <div className={`p-3 bg-emerald-900/30 rounded-lg border border-emerald-700/50 backdrop-blur-sm ${className}`}>
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-emerald-200 opacity-90">Trạng thái dữ liệu</span>
                <button 
                    onClick={handleRefresh} 
                    className={`text-emerald-300 hover:text-white transition p-1 rounded-full hover:bg-emerald-800 ${refreshing ? 'animate-spin' : ''}`} 
                    title="Cập nhật"
                >
                    <Icon name="refresh" size={12} />
                </button>
            </div>
            <div className="flex items-center text-green-400 font-bold text-xs mb-1">
                <Icon name="check" size={12} className="mr-1.5" /> Đã cập nhật
            </div>
            <div className="text-[10px] text-emerald-300/70 font-mono tracking-wide">
                {lastUpdated.toLocaleTimeString('vi-VN')} {lastUpdated.toLocaleDateString('vi-VN')}
            </div>
        </div>
    );
};