import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { ShieldCheck, Navigation, History, Settings, Bell, Map as MapIcon } from 'lucide-react';
import { supabase } from './supabaseClient';

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 16); }, [coords]);
  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  
  // 設定ステート
  const [parentId, setParentId] = useState(localStorage.getItem('parent_parentId') || '');
  const [childId, setChildId] = useState(localStorage.getItem('parent_childId') || '');
  const [showSettings, setShowSettings] = useState(false);

  const saveSettings = () => {
    localStorage.setItem('parent_parentId', parentId);
    localStorage.setItem('parent_childId', childId);
    setShowSettings(false);
    alert('設定を保存しました。');
  };

  useEffect(() => {
    if (!isMonitoring || !parentId || !childId) return;

    const channel = supabase
      .channel('realtime-location')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_logs' }, (payload) => {
        const newLog = payload.new;
        if (newLog.parent_id === parentId && newLog.child_id === childId) {
          if (newLog.is_active) {
            setChildPos([newLog.latitude, newLog.longitude]);
            setIsDanger(true);
            setHistory(prev => [{ time: new Date().toLocaleTimeString(), status: '⚠️ 危険エリア進入' }, ...prev].slice(0, 10));
          } else {
            setIsDanger(false);
            setChildPos(null);
            setHistory(prev => [{ time: new Date().toLocaleTimeString(), status: '✅ 安全圏へ移動' }, ...prev].slice(0, 10));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId, childId]);

  return (
    <div className="min-h-screen bg-indigo-50 font-sans pb-10">
      <div className="bg-indigo-700 p-4 text-white shadow-lg flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck /> SafeWatch Parent</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-full transition"><Settings /></button>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* 設定パネル */}
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-indigo-200">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Settings size={18}/> 監視設定</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" className="p-3 bg-slate-50 border rounded-xl" value={parentId} onChange={e => setParentId(e.target.value)} placeholder="保護者ID" />
              <input type="text" className="p-3 bg-slate-50 border rounded-xl" value={childId} onChange={e => setChildId(e.target.value)} placeholder="お子様ID" />
            </div>
            <button onClick={saveSettings} className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-xl font-bold">設定を保存</button>
          </div>
        )}

        {/* 状況バー */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDanger ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-700'}`}>
          <span className="font-bold flex items-center gap-2">
            <Bell size={18} /> {isMonitoring ? (isDanger ? '緊急：危険エリアに進入しました！' : '見守り中：安全圏にいます') : '監視停止中'}
          </span>
          <button onClick={() => setIsMonitoring(!isMonitoring)} className={`px-6 py-2 rounded-xl font-bold text-sm ${isMonitoring ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
            {isMonitoring ? '監視停止' : '監視開始'}
          </button>
        </div>

        {/* マップ：常に表示 */}
        <div className="relative h-[500px] bg-white rounded-[32px] shadow-xl border-4 border-white overflow-hidden">
          <MapContainer center={[35.0222, 135.9619]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {/* マップ内：子供の位置を表示する部分 */}
            {isDanger && childPos && (
              <>
                <RecenterMap coords={childPos} />
                
                {/* 1. 外側の細い白い縁取り（Googleマップ風の光沢感） */}
                <Circle 
                  center={childPos} 
                  radius={12}  // 半径をぐっと小さく（約10-12m）
                  pathOptions={{ 
                    color: 'rgba(255, 255, 255, 0.8)', // ほぼ白の細い線
                    fillColor: '#ffffff', 
                    fillOpacity: 0.3,                 // 非常に薄い白
                    weight: 1 
                  }} 
                />
            
                {/* 2. メインの青いドット */}
                <Circle 
                  center={childPos} 
                  radius={6}   // ドット本体
                  pathOptions={{ 
                    fillColor: '#4285F4',  // Google Maps Blue
                    fillOpacity: 1,        // 不透明
                    weight: 2              // 縁をくっきり
                  }} 
                />
              </>
            )}
          </MapContainer>
          {!isDanger && isMonitoring && (
            <div className="absolute top-4 right-4 bg-white/80 px-4 py-2 rounded-full shadow text-xs font-bold text-indigo-600 z-[1000]">
              プライバシー保護：GPS非表示中
            </div>
          )}
        </div>

        {/* 履歴 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History size={20}/> 履歴</h3>
          <div className="space-y-2">
            {history.map((log, i) => (
              <div key={i} className="flex justify-between text-sm p-2 border-b border-slate-50 last:border-0">
                <span className="text-slate-400 font-mono">{log.time}</span>
                <span className={`font-bold ${log.status.includes('⚠️') ? 'text-red-500' : 'text-green-600'}`}>{log.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;