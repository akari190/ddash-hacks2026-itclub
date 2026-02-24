:::mermaid
graph TD
    %% 外部データ層
    subgraph External_Intelligence ["1. 外部インテリジェンス層 (Data Sources)"]
        direction TB
        Police[警察庁: 犯罪オープンデータ<br/>分析・統計的リスク]
        Mail[警視庁: 配信メール速報<br/>抽出・直近のリスク]
        OSM[OpenStreetMap<br/>地図タイル情報]
    end

    %% クラウド・バックエンド層
    subgraph Backend_Cloud ["2. クラウド・バックエンド層 (Supabase)"]
        direction TB
        DB[(PostgreSQL)]
        Realtime[Supabase Realtime Engine<br/>WebSocketによる超低遅延同期]
        Auth[ID照合システム<br/>Child ID / Parent ID Matching]
        
        DB --> Realtime
        Auth -.->|アクセス制御| DB
    end

    %% フロントエンド層
    subgraph Frontend_App ["3. アプリケーション層 (React / Leaflet)"]
        direction LR
        
        %% 子端末
        subgraph Child_App ["お子様端末 (Tracker)"]
            GPS[Navigator.geolocation API<br/>高精度モード]
            Edge[エッジ・ジオフェンシング<br/>危険エリア進入判定]
        end

        %% 親端末
        subgraph Parent_App ["保護者端末 (Dashboard)"]
            Map[React-Leaflet Map View]
            FlyTo[自動追従機能<br/>FlyTo Animation]
            Visual[リスク可視化<br/>Lv別カラーレンダリング]
        end
    end

    %% データの流れ
    Police & Mail -->|解析結果| Edge
    Police & Mail -->|マップ描画用| Visual
    OSM -.->|タイル提供| Child_App & Parent_App
    
    GPS --> Edge
    Edge -->|座標 + 進入フラグ| Auth
    Auth --> DB
    
    Realtime -->|プッシュ配信| Map
    Map --> FlyTo
    Map --> Visual

    %% スタイリング
    style External_Intelligence fill:#f8fafc,stroke:#64748b,stroke-width:2px
    style Backend_Cloud fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style Frontend_App fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style DB fill:#3ecf8e,color:#fff
    style Realtime fill:#3ecf8e,color:#fff
:::