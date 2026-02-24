import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { ShieldCheck, Navigation, History, Bell, BellOff, Settings, Map as MapIcon } from 'lucide-react';
import { supabase } from './supabaseClient';

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords, 16); }, [coords]);
  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  
  // 親側での設定情報（LocalStorageから読み込み）
  const [parentId, setParentId] = useState(localStorage.getItem('parent_parentId') || '');
  const [childId, setChildId] = useState(localStorage.getItem('parent_childId') || '');
  const [showSettings, setShowSettings] = useState(false);

  // 設定保存関数
  const saveSettings = () => {
    localStorage.setItem('parent_parentId', parentId);
    localStorage.setItem('parent_childId', childId);
    setShowSettings(false);
    alert('親側の設定を保存しました。');
  };

  useEffect(() => {
    if (!isMonitoring || !parentId || !childId) return;

    // Supabase リアルタイム購読（特定の親子ペアのみを監視）
    const channel = supabase
      .channel('realtime-location')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'location_logs' }, 
        (payload) => {
          const newLog = payload.new;
          
          // 設定した親子IDと一致するかチェック
          if (newLog.parent_id === parentId && newLog.child_id === childId) {
            if (newLog.is_active) {
              setChildPos([newLog.latitude, newLog.longitude]);
              setIsDanger(true);
              setHistory(prev => [{ 
                time: new Date().toLocaleTimeString(), 
                status: '⚠️ 危険エリア侵入' 
              }, ...prev].slice(0, 10));
            } else {
              setIsDanger(false);
              setChildPos(null);
              setHistory(prev => [{ 
                time: new Date().toLocaleTimeString(), 
                status: '✅ 安全圏へ移動' 
              }, ...prev].slice(0, 10));
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId, childId]);

  return (
    <div className="min-h-screen bg-indigo-50 font-sans">
      {/* 上部ヘッダー */}
      <div className="bg-indigo-700 p-4 text-white shadow-lg flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldCheck />
          <h1 className="text-xl font-bold font-display">SafeWatch Parent</h1>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-white/20 rounded-full transition"
        >
          <Settings size={24} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 左サイド：コントロールと履歴 */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* 設定パネル（表示/非表示切り替え） */}
          {showSettings && (
            <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-indigo-200 animate-in fade-in zoom-in duration-200">
              <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><Settings size={18}/> 監視対象設定</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 ml-1">自分のID (Parent ID)</label>
                  <input type="text" className="w-full p-2 bg-slate-50 border rounded-lg outline-none" 
                    value={parentId} onChange={e => setParentId(e.target.value)} placeholder="parent001" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 ml-1">見守る子のID (Child ID)</label>
                  <input type="text" className="w-full p-2 bg-slate-50 border rounded-lg outline-none" 
                    value={childId} onChange={e => setChildId(e.target.value)} placeholder="child001" />
                </div>
                <button onClick={saveSettings} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm">設定を適用</button>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Navigation size={18}/> ステータス</h3>
            <div className={`p-4 rounded-2xl mb-4 text-center font-black ${isDanger ? 'bg-red-500 text-white animate-bounce' : 'bg-slate-100 text-slate-500'}`}>
              {isDanger ? '⚠️ エリア侵入中！' : '待機中'}
            </div>
            <button 
              onClick={() => setIsMonitoring(!isMonitoring)} 
              disabled={!parentId || !childId}
              className={`w-full py-4 rounded-xl font-bold transition shadow-lg ${isMonitoring ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
            >
              {isMonitoring ? '監視を停止' : '監視を開始'}
            </button>
            {!parentId && <p className="text-[10px] text-red-500 mt-2 text-center">※設定からIDを入力してください</p>}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History size={18}/> 通知履歴</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((log, i) => (
                <div key={i} className="flex justify-between text-[10px] border-b pb-1">
                  <span className="text-slate-400 font-mono">{log.time}</span>
                  <span className={log.status.includes('⚠️') ? 'text-red-600 font-bold' : 'text-green-600'}>{log.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右メイン：マップ表示 */}
        <div className="lg:col-span-3 relative h-[600px] bg-white rounded-[40px] shadow-2xl border-8 border-white overflow-hidden">
          {(!isMonitoring || !isDanger) && (
            <div className="absolute inset-0 z-[1000] bg-slate-900/10 backdrop-blur-md flex items-center justify-center text-center p-10">
              <div className="bg-white/90 p-8 rounded-3xl shadow-2xl border border-white max-w-sm">
                <MapIcon size={48} className="mx-auto mb-4 text-indigo-500" />
                <h2 className="text-xl font-black text-slate-800 mb-2">
                  {!isMonitoring ? '監視を開始してください' : '見守り待機中'}
                </h2>
                <p className="text-sm text-slate-500">
                  {!isMonitoring 
                    ? '「監視を開始」ボタンを押すと、お子様の状態をリアルタイムでチェックします。' 
                    : 'お子様が危険エリアに入ると、自動的に地図と現在地が表示されます。'}
                </p>
              </div>
            </div>
          )}
          <MapContainer center={[35.0222, 135.9619]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {childPos && (
              <>
                <RecenterMap coords={childPos} />
                <Marker position={childPos} />
                <Circle center={childPos} radius={100} pathOptions={{ color: 'red', dashArray: '5, 10', fillOpacity: 0.1 }} />
              </>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;