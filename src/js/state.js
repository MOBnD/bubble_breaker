        // ==========================================
        // === 2. 状態管理 (変数の定義) ===
        // ==========================================
        let state = {
            screen: 'INPUT',       // 現在表示している画面名（INPUT, GROUP, SINGLE, ANALYSIS, DETAIL）
            groupId: null,         // 現在表示しているバブル群（親）のID
            bubbleId: null,        // 選択されている個別バブル（子）のID
            groupData: null,       // バブル群の詳細データオブジェクト
            bubbleData: null,      // 個別バブルの詳細データオブジェクト
            analysisCardType: null // 現在開いている分析カード
        };
        let focusEntryGroupId = null;
        let focusEntryBubbleId = null;
        let explorerMode = localStorage.getItem('bubblebreaker.explorerMode') === 'on';
        
        let isDiving = false;          // ワープアニメーション中かどうかの判定フラグ
        let diveStartTime = 0;         // ワープ開始時の時間（アニメーションの進行度計算用）
        let diveVelocity = 0;          // ワープの進行速度
        let isZoomingIntoGroup = false;// ワープ終了後、遠距離から目的のバブル群にズームインする演出中かどうかのフラグ

