import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { ShieldCheck, History, Settings, Bell, MapPin } from 'lucide-react';
import { supabase } from './supabaseClient';
import DangerMapContent from './danger_map';

// --- 地図の自動追従 ---
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 17, { animate: true, duration: 1.5 });
  }, [coords, map]);
  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false); // これが子供側からの is_active
  const [history, setHistory] = useState<any[]>([]);
  
  const [parentId, setParentId] = useState(localStorage.getItem('parentId') || '');
  const [childId, setChildId] = useState(localStorage.getItem('childId') || '');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!isMonitoring || !parentId || !childId) return;

    const channel = supabase
      .channel('realtime-location')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_logs' }, (payload) => {
        const newLog = payload.new;
        
        if (newLog.parent_id === parentId && newLog.child_id === childId) {
          const lat = parseFloat(newLog.latitude);
          const lng = parseFloat(newLog.longitude);
          const currentIsActive = newLog.is_active; // 子供側の判定結果

          // 1. 判定結果を「最優先」でセット
          setIsDanger(currentIsActive);

          // 2. 座標をセット（判定がtrueなら表示、falseなら隠す）
          if (currentIsActive) {
            setChildPos([lat, lng]);
          } else {
            setChildPos(null);
          }

          // 3. 履歴を追加
          setHistory(prev => [{ 
            time: new Date().toLocaleTimeString(), 
            status: currentIsActive ? '⚠️ 危険エリア進入' : '✅ 安全圏へ移動', 
            lat, lng 
          }, ...prev].slice(0, 10));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId, childId]);

  return (
    <div className="min-h-screen bg-indigo-50 font-sans pb-10 text-slate-900">
      <div className="bg-indigo-700 p-4 text-white shadow-lg flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck /> SafeWatch Parent</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-full transition"><Settings /></button>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-indigo-200">
            <div className="grid grid-cols-2 gap-4">
              <input className="p-3 bg-slate-50 border rounded-xl" value={parentId} onChange={e => setParentId(e.target.value)} placeholder="保護者ID" />
              <input className="p-3 bg-slate-50 border rounded-xl" value={childId} onChange={e => setChildId(e.target.value)} placeholder="お子様ID" />
            </div>
            <button onClick={() => { localStorage.setItem('parentId', parentId); localStorage.setItem('childId', childId); setShowSettings(false); }} className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-xl font-bold">保存</button>
          </div>
        )}

        {/* 判定フラグ (isDanger) をそのまま文字に反映 */}
        <div className={`p-6 rounded-3xl border shadow-xl transition-all duration-500 ${isDanger ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-700'}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-3 text-lg">
              <Bell size={24} /> 
              {isMonitoring ? (isDanger ? '緊急：危険エリアに進入しました！' : '見守り中：安全圏にいます') : '監視停止中'}
            </span>
            <button onClick={() => setIsMonitoring(!isMonitoring)} className={`px-8 py-2 rounded-xl font-bold ${isMonitoring ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
              {isMonitoring ? '停止' : '開始'}
            </button>
          </div>
        </div>

        <div className="relative h-[500px] bg-white rounded-[32px] shadow-xl border-4 border-white overflow-hidden">
          <MapContainer center={[35.0315, 135.7557]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DangerMapContent userPosition={childPos} />

            {/* 子供の表示 */}
            {childPos && (
              <>
                <RecenterMap coords={childPos} />
                <Circle center={childPos} radius={12} pathOptions={{ color: '#fff', fillColor: '#fff', fillOpacity: 0.4 }} />
                <Circle center={childPos} radius={6} pathOptions={{ fillColor: '#4285F4', fillOpacity: 1, color: '#fff', weight: 2 }} />
              </>
            )}
          </MapContainer>

          {/* 警告表示 */}
          {!isDanger && isMonitoring && (
            <div className="absolute top-4 right-4 bg-white/90 px-4 py-2 rounded-full shadow-sm text-xs font-bold text-indigo-600 z-[1000] border border-indigo-100 flex items-center gap-2">
              <ShieldCheck size={14} /> プライバシー保護：安全圏のためGPS非表示
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History size={20}/> 履歴</h3>
          <div className="space-y-3">
            {history.map((log, i) => (
              <div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl items-center">
                <span className={`font-bold text-sm ${log.status.includes('⚠️') ? 'text-red-500' : 'text-green-600'}`}>{log.status}</span>
                <span className="text-slate-400 font-mono text-xs">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;