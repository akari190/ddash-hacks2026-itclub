import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import { Shield, AlertTriangle, Settings, User, Activity, Play, Square } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './supabaseClient';
import DangerMapContent from './danger_map';

// --- 地図の自動ズーム制御 ---
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, 16);
  }, [coords]);
  return null;
};

const ChildTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<[number, number]>([35.031558, 135.755747]); 
  const [geoData, setGeoData] = useState<any>(null);
  const [activeZone, setActiveZone] = useState<any>(null);
  const [checkCount, setCheckCount] = useState(0);
  
  const [childId, setChildId] = useState(localStorage.getItem('childId') || '');
  const [parentId, setParentId] = useState(localStorage.getItem('parentId') || '');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch('/tables/danger_areas.geojson')
      .then(res => res.json())
      .then(setGeoData)
      .catch(err => console.error("GeoData読み込みエラー:", err));
  }, []);

  // Supabase送信関数
  const sendLocation = useCallback(async (lat: number, lng: number, isActive: boolean) => {
    if (!childId || !parentId) return;
    const { error } = await supabase
      .from('location_logs')
      .insert([{ 
        child_id: childId, 
        parent_id: parentId, 
        latitude: lat, 
        longitude: lng, 
        is_active: isActive 
      }]);

    if (error) console.error("DB送信失敗:", error.message);
    else console.log("DB送信成功:", { lat, lng, isActive });
  }, [childId, parentId]);

  // 判定ロジック
  const checkDanger = useCallback((lat: number, lng: number) => {
    if (!geoData) return null;
    const isNight = new Date().getHours() >= 20 || new Date().getHours() < 5;

    return geoData.features.find((f: any) => {
      const score = f.properties.risk_score || 0;
      const center = f.geometry.coordinates[0][0]; 
      let radius = 150 + (score - 0.94) * 1000;
      if (isNight && score > 0.943) radius *= 1.5;
      return L.latLng(lat, lng).distanceTo([center[1], center[0]]) <= radius;
    });
  }, [geoData]);

  // 追跡ループ
  useEffect(() => {
    if (!isTracking) return;

    const interval = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        setCheckCount(c => c + 1);

        const found = checkDanger(latitude, longitude);
        const isInDanger = !!found;
        setActiveZone(found ? found.properties : null);

        sendLocation(latitude, longitude, isInDanger);
      }, (err) => console.error(err), { enableHighAccuracy: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [isTracking, checkDanger, sendLocation]);

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans text-slate-900">
      {/* ヘッダー */}
      <div className="bg-green-600 p-4 shadow-lg flex justify-between items-center text-white">
        <div className="flex items-center gap-2"><Shield /><h1 className="text-xl font-bold">SafeWatch Child</h1></div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-full"><Settings /></button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 設定パネル */}
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-green-200 space-y-3">
            <input placeholder="Child ID" className="w-full p-3 bg-slate-50 border rounded-xl" value={childId} onChange={e => setChildId(e.target.value)} />
            <input placeholder="Parent ID" className="w-full p-3 bg-slate-50 border rounded-xl" value={parentId} onChange={e => setParentId(e.target.value)} />
            <button onClick={() => { 
              localStorage.setItem('childId', childId); 
              localStorage.setItem('parentId', parentId); 
              setShowSettings(false); 
            }} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">保存</button>
          </div>
        )}

        {/* ステータスカード */}
        <div className={`p-6 rounded-3xl shadow-xl transition-all duration-500 ${activeZone ? 'bg-red-500 text-white animate-pulse' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 font-bold">現在の状態</p>
              <h2 className="text-2xl font-black">{isTracking ? (activeZone ? '⚠️ 危険エリア内' : '✅ 正常に見守り中') : '💤 停止中'}</h2>
            </div>
            {activeZone ? <AlertTriangle size={32} /> : <Shield size={32} className="text-green-600" />}
          </div>
        </div>

        {/* マップエリア */}
        <div className="h-80 rounded-[40px] overflow-hidden shadow-lg border-4 border-white relative">
          <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DangerMapContent userPosition={position} />
            <RecenterMap coords={position} />

            {/* 親側と同じデザインの現在地表示 */}
            {position && (
              <>
                {/* 外側の白い波紋（親側: radius 12 を少し大きくして視認性アップ） */}
                <Circle 
                  center={position} 
                  radius={15} 
                  pathOptions={{ color: '#fff', fillColor: '#fff', fillOpacity: 0.4, weight: 1 }} 
                />
                {/* 内側の青いドット（親側: radius 6 準拠） */}
                <Circle 
                  center={position} 
                  radius={7} 
                  pathOptions={{ fillColor: '#4285F4', fillOpacity: 1, color: '#fff', weight: 2 }} 
                />
              </>
            )}
          </MapContainer>
        </div>

        {/* 操作ボタン */}
        <button 
          onClick={() => setIsTracking(!isTracking)} 
          disabled={!childId || !parentId}
          className={`w-full py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${isTracking ? 'bg-slate-800 text-white' : 'bg-green-500 text-white'}`}
        >
          {isTracking ? <><Square size={20} /> 見守りを停止</> : <><Play size={20} /> 見守りを開始</>}
        </button>
      </div>
    </div>
  );
};

export default ChildTracker;