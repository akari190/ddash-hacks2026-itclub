import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { ShieldCheck, History, Settings, Bell, MapPin, Navigation } from 'lucide-react';
import { supabase } from './supabaseClient';

const getLevelStyle = (level: string) => {
  switch (level) {
    case 'high': return { color: '#ef4444', label: '高', bg: 'bg-red-500' };
    case 'medium': return { color: '#f97316', label: '中', bg: 'bg-orange-500' };
    case 'low': return { color: '#eab308', label: '低', bg: 'bg-yellow-500' };
    default: return { color: '#64748b', label: '不明', bg: 'bg-slate-500' };
  }
};

// 自動追従コンポーネント
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 17, { animate: true, duration: 1.5 });
    }
  }, [coords, map]);
  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [dangerZones, setDangerZones] = useState<any[]>([]); // 危険エリア保持用

  const [parentId, setParentId] = useState(localStorage.getItem('parent_parentId') || '');
  const [childId, setChildId] = useState(localStorage.getItem('parent_childId') || '');
  const [showSettings, setShowSettings] = useState(false);

  // 1. 危険エリアデータを読み込む (ChildTrackerと同じ処理)
  useEffect(() => {
    fetch('/public/tables/danger_zones.json')
      .then(res => res.json())
      .then(json => setDangerZones(json.data))
      .catch(err => console.error("エリアデータ読み込みエラー:", err));
  }, []);

  // 2. リアルタイム監視
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
            setHistory(prev => [{ 
              time: new Date().toLocaleTimeString(), 
              status: '⚠️ 危険エリア進入', 
              lat: newLog.latitude, 
              lng: newLog.longitude 
            }, ...prev].slice(0, 10));
          } else {
            setIsDanger(false);
            setChildPos(null);
            setHistory(prev => [{ 
              time: new Date().toLocaleTimeString(), 
              status: '✅ 安全圏へ移動', 
              lat: null, lng: null 
            }, ...prev].slice(0, 10));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId, childId]);

  const saveSettings = () => {
    localStorage.setItem('parent_parentId', parentId);
    localStorage.setItem('parent_childId', childId);
    setShowSettings(false);
    alert('設定を保存しました。');
  };

  return (
    <div className="min-h-screen bg-indigo-50 font-sans pb-10">
      <div className="bg-indigo-700 p-4 text-white shadow-lg flex justify-between items-center text-white">
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
        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isDanger ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-700'}`}>
          <span className="font-bold flex items-center gap-2">
            <Bell size={18} /> {isMonitoring ? (isDanger ? '緊急：危険エリアに進入しました！' : '見守り中：安全圏にいます') : '監視停止中'}
          </span>
          <button onClick={() => setIsMonitoring(!isMonitoring)} className={`px-6 py-2 rounded-xl font-bold text-sm ${isMonitoring ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
            {isMonitoring ? '監視停止' : '監視開始'}
          </button>
        </div>

        {/* マップ */}
        <div className="relative h-[500px] bg-white rounded-[32px] shadow-xl border-4 border-white overflow-hidden">
          <MapContainer center={[35.0222, 135.9619]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {/* --- 危険エリアの円を描画 (ChildTrackerと同じ) --- */}
            {dangerZones.map((zone: any) => {
              const lat = parseFloat(zone.latitude);
              const lng = parseFloat(zone.longitude);
              const rad = parseFloat(zone.radius);
              if (isNaN(lat) || isNaN(lng)) return null;

              const style = getLevelStyle(zone.danger_level);

              return (
                <Circle 
                  key={zone.id} 
                  center={[lat, lng]} 
                  radius={rad} 
                  pathOptions={{ 
                    color: style.color, 
                    fillColor: style.color, 
                    fillOpacity: 0.2,
                    weight: 2 
                  }} 
                >
                  <Popup minWidth={220}>
                    <div className="p-1 font-sans">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-800">{zone.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap ${style.bg}`}>
                          Lv: {style.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                          {zone.incident_type}
                        </span>
                      </div>
                
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border-l-2 border-slate-300">
                        {zone.description}
                      </p>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {/* 子供の現在地（危険時のみ） */}
            {isDanger && childPos && (
              <>
                <RecenterMap coords={childPos} />
                <Circle center={childPos} radius={12} pathOptions={{ color: 'rgba(255, 255, 255, 0.8)', fillColor: '#ffffff', fillOpacity: 0.3, weight: 1 }} />
                <Circle center={childPos} radius={6} pathOptions={{ fillColor: '#4285F4', fillOpacity: 1, color: '#ffffff', weight: 2 }} />
              </>
            )}
          </MapContainer>
          
          {isDanger && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
              <Navigation size={12} fill="white" /> 自動追尾中
            </div>
          )}
        </div>

        {/* 履歴 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History size={20}/> 履歴</h3>
          <div className="space-y-3">
            {history.map((log, i) => (
              <div key={i} className="flex flex-col gap-1 p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-xl transition">
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-sm ${log.status.includes('⚠️') ? 'text-red-500' : 'text-green-600'}`}>{log.status}</span>
                  <span className="text-slate-400 font-mono text-xs">{log.time}</span>
                </div>
                {log.lat && (
                  <div className="flex items-center gap-1 text-indigo-500 text-xs mt-1">
                    <MapPin size={12} className="text-slate-400" />
                    <a href={`https://www.google.com/maps?q=${log.lat},${log.lng}`} target="_blank" rel="noreferrer" className="hover:underline">Googleマップで表示</a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;