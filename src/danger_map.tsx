import React, { useState, useEffect } from 'react';
import { TileLayer, Circle, Popup, useMap } from 'react-leaflet';

// スコアに応じた色の決定（ここは変更なし）
const getDangerColor = (s: number) => {
  return s > 0.945 ? '#800026' : 
         s > 0.943 ? '#BD0026' : 
         s > 0.941 ? '#E31A1C' : 
                     '#FC4E2A';
};

// 【重要】現実世界の「メートル」としての半径を計算
const riskToRealRadius = (risk: number, isNight: boolean) => {
  // 基礎半径を150mとし、スコアによって変動させる例
  // スコア0.94を基準に、1スコアあたり500mの影響力を持たせる
  const baseRadius = 150; 
  let radius = baseRadius + (risk - 0.94) * 1000;

  // 夜間かつ高リスクなら範囲を広げる（例：1.5倍）
  if (isNight && risk > 0.943) {
    radius *= 1.5;
  }
  return radius;
};

const RecenterMap = ({ coords }: { coords: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 16, { animate: true });
  }, [coords, map]);
  return null;
};

interface DangerMapProps {
  userPosition?: [number, number] | null;
}

const DangerMapContent: React.FC<DangerMapProps> = ({ userPosition }) => {
  const [geoData, setGeoData] = useState<any>(null);
  const currentHour = new Date().getHours();
  const isNight = currentHour >= 20 || currentHour < 5;

  useEffect(() => {
    fetch('/public/tables/danger_areas.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("データ読み込みエラー:", err));
  }, []);

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {userPosition && <RecenterMap coords={userPosition} />}

      {geoData && geoData.features && geoData.features.map((feature: any, idx: number) => {
        const score = feature.properties.risk_score || 0;
        let center: [number, number] | null = null;

        try {
          if (feature.geometry.type === "Polygon") {
            const firstCoord = feature.geometry.coordinates[0][0];
            center = [firstCoord[1], firstCoord[0]];
          } else if (feature.geometry.type === "Point") {
            center = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
          }
        } catch (e) { return null; }

        if (!center) return null;

        // メートル単位の半径
        const realRadius = riskToRealRadius(score, isNight);
        const color = getDangerColor(score);

        return (
          <Circle
            key={`danger-${idx}`}
            center={center}
            radius={realRadius} // ← ここが「メートル」として扱われます
            pathOptions={{
              fillColor: color,
              color: (isNight && score > 0.943) ? "#480a0a" : color,
              weight: isNight ? 2 : 1,
              fillOpacity: isNight ? 0.6 : 0.3,
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center' }}>
                <b style={{ color: color }}>危険エリア</b><br />
                {/* 警戒半径: {Math.round(realRadius)}m<br /> */}
                リスクスコア: {score.toFixed(4)}
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
};

export default DangerMapContent;