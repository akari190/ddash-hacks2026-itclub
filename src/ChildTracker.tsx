import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import { Shield, AlertTriangle, Settings, User, Activity } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './supabaseClient';

// --- 1. CSSスタイルの注入（脈動アニメーションと方位ビーム） ---
const injectStyles = () => {
  if (document.getElementById('tracker-styles')) return;
  const style = document.createElement('style');
  style.id = 'tracker-styles';
  style.innerHTML = `
    .pulse {
      width: 20px; height: 20px;
      border-radius: 50%;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(66, 133, 244, 0.4);
      animation: pulse-animation 2s infinite;
    }
    @keyframes pulse-animation {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }
    .direction-beam {
      position: absolute;
      top: 50%; left: 50%;
      width: 0; height: 0;
      border-left: 15px solid transparent;
      border-right: 15px solid transparent;
      border-bottom: 35px solid rgba(66, 133, 244, 0.3);
      margin-left: -15px;
      margin-top: -40px;
      transform-origin: bottom center;
    }
    .user-dot {
      width: 14px; height: 14px;
      background-color: #4285F4;
      border: 2px solid white;
      border-radius: 50%;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 5px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(style);
};

// --- 2. 危険レベルに応じた色の設定 ---
const getLevelStyle = (level: string) => {
  switch (level) {
    case 'high': return { color: '#ef4444' };
    case 'medium': return { color: '#f97316' };
    case 'low': return { color: '#eab308' };
    default: return { color: '#64748b' };
  }
};

// --- 3. 地図の自動ズーム制御コンポーネント ---
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords, 16); }, [coords]);
  return null;
};

const ChildTracker = () => {
  // ステート管理
  const [isTracking, setIsTracking] = useState(!!(localStorage.getItem('childId') && localStorage.getItem('parentId')));
  const [position, setPosition] = useState<[number, number]>([35.0222, 135.9619]); // 初期位置：草津駅
  const [heading, setHeading] = useState<number | null>(null); // デバイスの向き
  const [dangerZones, setDangerZones] = useState([]);
  const [activeZone, setActiveZone] = useState<any>(null);
  const [checkCount, setCheckCount] = useState(0);
  
  // 設定情報
  const [childId, setChildId] = useState(localStorage.getItem('childId') || '');
  const [parentId, setParentId] = useState(localStorage.getItem('parentId') || '');
  const [showSettings, setShowSettings] = useState(false);

  // 初回実行：スタイル注入とデータ取得
  useEffect(() => {
    injectStyles();
    fetch('/public/tables/danger_zones.json')
      .then(res => res.json())
      .then(json => setDangerZones(json.data))
      .catch(err => console.error("データ読み込みエラー:", err));
  }, []);

  // 方位センサーの監視（スマホの向きを取得）
  useEffect(() => {
    if (!isTracking) return;
    const handleOrientation = (e: any) => {
      const alpha = e.webkitCompassHeading || e.alpha;
      if (alpha !== null) setHeading(alpha);
    };
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isTracking]);

  // Supabase送信ロジック
  const sendLocation = useCallback(async (lat: number, lng: number, isActive: boolean) => {
    if (!childId || !parentId) return;
    await supabase.from('location_logs').insert([{ 
      child_id: childId, parent_id: parentId, latitude: lat, longitude: lng, is_active: isActive 
    }]);
  }, [childId, parentId]);

  // 位置情報の監視ループ
  useEffect(() => {
    let interval: number;
    if (isTracking) {
      interval = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
          setCheckCount(prev => prev + 1);

          // 危険エリア判定
          const foundZone = dangerZones.find((zone: any) => 
            L.latLng(latitude, longitude).distanceTo([zone.latitude, zone.longitude]) <= zone.radius
          );

          if (foundZone && !activeZone) {
            setActiveZone(foundZone);
            sendLocation(latitude, longitude, true);
          } else if (!foundZone && activeZone) {
            sendLocation(latitude, longitude, false);
            setActiveZone(null);
          }
        }, (err) => console.error(err), { enableHighAccuracy: true });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isTracking, dangerZones, activeZone, sendLocation]);

  // 現在地用カスタムアイコン（Markerに使用）
  const locationIcon = L.divIcon({
    className: 'custom-location-icon',
    html: `
      <div class="pulse"></div>
      <div class="direction-beam" style="transform: rotate(${heading || 0}deg); display: ${heading !== null ? 'block' : 'none'};"></div>
      <div class="user-dot"></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const saveSettings = () => {
    localStorage.setItem('childId', childId);
    localStorage.setItem('parentId', parentId);
    setShowSettings(false);
    if (childId && parentId) setIsTracking(true);
    alert('設定を保存しました。');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      {/* ヘッダー */}
      <div className="bg-green-600 p-4 shadow-lg flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Shield size={24} />
          <h1 className="text-xl font-bold">SafeWatch Child</h1>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-full">
          <Settings size={24} />
        </button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 設定パネル */}
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-green-200">
            <h3 className="font-bold mb-4">デバイス設定</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Child ID" className="w-full p-3 bg-slate-50 border rounded-xl" value={childId} onChange={e => setChildId(e.target.value)} />
              <input type="text" placeholder="Parent ID" className="w-full p-3 bg-slate-50 border rounded-xl" value={parentId} onChange={e => setParentId(e.target.value)} />
              <button onClick={saveSettings} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">保存</button>
            </div>
          </div>
        )}

        {/* ユーザー情報 */}
        <div className="flex gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm flex-1 flex items-center gap-3">
            <User size={16} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-600">{childId || '未設定'}</span>
          </div>
          <div className="bg-white p-3 rounded-2xl shadow-sm flex-1 flex items-center gap-3">
            <Activity size={16} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-600">Check: {checkCount}</span>
          </div>
        </div>

        {/* ステータス */}
        <div className={`p-6 rounded-3xl shadow-xl transition-all ${activeZone ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 font-bold">現在の状態</p>
              <h2 className="text-2xl font-black">{isTracking ? (activeZone ? '⚠️ 危険エリア内' : '✅ 正常に動作中') : '💤 停止中'}</h2>
            </div>
            {activeZone ? <AlertTriangle size={32} /> : <Shield size={32} className="text-green-600" />}
          </div>
        </div>

        {/* マップ */}
        <div className="h-80 rounded-3xl overflow-hidden shadow-lg border-4 border-white relative">
          <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap coords={position} />

            {/* 危険エリアの円 */}
            {dangerZones.map((zone: any) => {
              const lat = parseFloat(zone.latitude);
              const lng = parseFloat(zone.longitude);
              const rad = parseFloat(zone.radius);
              const style = getLevelStyle(zone.danger_level);
              if (isNaN(lat) || isNaN(lng)) return null;
            
              return (
                <Circle 
                  key={zone.id} 
                  center={[lat, lng]} 
                  radius={rad} 
                  pathOptions={{ color: style.color, fillColor: style.color, fillOpacity: 0.4, weight: 3 }} 
                >
                  <Popup>
                    <div className="text-center font-bold">
                      <p className="text-red-600">⚠️ {zone.incident_type}</p>
                      <p className="text-xs">{zone.name}</p>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {/* 現在地のMarker（ビーム＋脈動） */}
            <Marker position={position} icon={locationIcon} zIndexOffset={1000} />

          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default ChildTracker;