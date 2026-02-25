import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import { ShieldCheck, History, Settings, Bell } from 'lucide-react';
import L from 'leaflet'; // 距離計算のために追加
import { supabase } from './supabaseClient';
import DangerMapContent from './danger_map';

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 17, { animate: true, duration: 1.5 }); }, [coords, map]);
  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any>(null); // 場所名特定用にGeoJSONを保持
  
  const [parentId, setParentId] = useState(localStorage.getItem('parentId') || '');
  const [childId, setChildId] = useState(localStorage.getItem('childId') || '');
  const [showSettings, setShowSettings] = useState(false);

  // GeoJSONデータの読み込み
  useEffect(() => {
    fetch('/tables/danger_areas.geojson')
      .then(res => res.json())
      .then(setGeoData)
      .catch(err => console.error("GeoData読み込みエラー:", err));
  }, []);

  // 座標から場所名を特定する関数
  // 座標から場所名を特定する関数
  const getLocationName = useCallback((lat: number, lng: number) => {
    if (!geoData || !geoData.features) return "不明な場所";
    
    // 全エリアをループして、現在地がどのエリアの「中心点」に近いか判定
    const found = geoData.features.find((f: any) => {
      // データの形式に合わせて座標取得（Point型かPolygon型かで調整）
      const coords = f.geometry.type === 'Point' 
        ? f.geometry.coordinates 
        : f.geometry.coordinates[0][0]; // Polygonの最初の点

      if (!coords) return false;

      const areaLat = coords[1];
      const areaLng = coords[0];
      const score = f.properties.risk_score || 0;

      // 判定半径の計算（子供側と一致させる）
      let radius = 150 + (score - 0.94) * 1000;
      
      // 距離計算
      const distance = L.latLng(lat, lng).distanceTo([areaLat, areaLng]);
      return distance <= radius;
    });

    // properties.name があればそれを返し、なければ properties.location などを探す
    return found?.properties?.name || found?.properties?.location || "危険エリア";
  }, [geoData]);
  
  useEffect(() => {
    if (!isMonitoring || !parentId || !childId) return;

    const channel = supabase
      .channel('realtime-location')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_logs' }, (payload) => {
        const newLog = payload.new;
        if (newLog.parent_id === parentId && newLog.child_id === childId) {
          const lat = parseFloat(newLog.latitude);
          const lng = parseFloat(newLog.longitude);
          const currentIsActive = newLog.is_active;

          setIsDanger(currentIsActive);
          setChildPos(currentIsActive ? [lat, lng] : null);

          // 場所名の特定
          const locationName = getLocationName(lat, lng);

          setHistory(prev => [{ 
            time: new Date().toLocaleTimeString(), 
            status: currentIsActive ? `⚠️ ${locationName}` : '✅ 安全圏', 
            location: locationName
          }, ...prev].slice(0, 10));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId, childId, getLocationName]);

  return (
    <div className="min-h-screen bg-indigo-50 font-sans pb-10 text-slate-900">
      {/* --- ヘッダー部分は変更なし --- */}
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

        {/* 状態表示パネル */}
        <div className={`p-6 rounded-3xl border shadow-xl transition-all duration-500 ${isDanger ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-700'}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-3 text-lg">
              <Bell size={24} /> 
              {isMonitoring ? (isDanger ? `緊急：${history[0]?.location || '危険エリア'}に進入！` : '見守り中：安全圏にいます') : '監視停止中'}
            </span>
            <button onClick={() => setIsMonitoring(!isMonitoring)} className={`px-8 py-2 rounded-xl font-bold ${isMonitoring ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
              {isMonitoring ? '停止' : '開始'}
            </button>
          </div>
        </div>

        {/* マップ部分 */}
        <div className="relative h-[500px] bg-white rounded-[32px] shadow-xl border-4 border-white overflow-hidden">
          <MapContainer center={[35.0315, 135.7557]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DangerMapContent userPosition={childPos} />
            {childPos && (
              <>
                <RecenterMap coords={childPos} />
                <Circle center={childPos} radius={12} pathOptions={{ color: '#fff', fillColor: '#fff', fillOpacity: 0.4 }} />
                <Circle center={childPos} radius={6} pathOptions={{ fillColor: '#4285F4', fillOpacity: 1, color: '#fff', weight: 2 }} />
              </>
            )}
          </MapContainer>
        </div>

        {/* 履歴部分：ここが場所名になります */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History size={20}/> 履歴</h3>
          <div className="space-y-3">
            {history.map((log, i) => (
              <div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl items-center">
                <div>
                  <span className={`font-bold text-sm ${log.status.includes('⚠️') ? 'text-red-500' : 'text-green-600'}`}>
                    {log.status}
                  </span>
                </div>
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