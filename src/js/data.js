        const DB = {
            // ----- 【お菓子カテゴリ】 -----
            "snacks_root": {
                id: "snacks_root", title: "お菓子の派閥", type: "分散型", parentId: null,
                desc: "世の中に無数にあるお菓子の好み。多様性が保たれている宇宙。",
                bubbles: [
                    { id: "kinoko_takenoko", name: "きのこたけのこ論争", size: 60, color: 0xffaaaa, htmlColor: "#ffaaaa", pos: [0, 0, 0], childId: "kinoko_takenoko_group" },
                    { id: "pocky", name: "ポッキー派", size: 25, color: 0xaa2222, htmlColor: "#aa2222", pos: [5, 4, -2], childId: null },
                    { id: "potato", name: "ポテチ派", size: 15, color: 0xddaa55, htmlColor: "#ddaa55", pos: [-6, -3, 2], childId: null }
                ]
            },
            "kinoko_takenoko_group": {
                id: "kinoko_takenoko_group", title: "きのこ派 vs たけのこ派", type: "双極対立型", parentId: "snacks_root",
                desc: "大きな意見が対立しており、その間の距離が遠い状態。エコーチェンバーが起きやすい型。",
                bubbles: [
                    { id: "kinoko", name: "きのこの山", size: 45, color: 0xffaa00, htmlColor: "#ffaa00", pos: [-5, 1, 0], childId: "kinoko_detail", desc: "サクサクのクラッカーとチョコの絶妙なバランスを愛する派閥。独立志向が強い。" },
                    { id: "takenoko", name: "たけのこの里", size: 48, color: 0x55cc22, htmlColor: "#55cc22", pos: [5, -1, 0], childId: null, desc: "クッキー生地のほろほろ感とチョコの一体感を至高とする派閥。結束力が高い。" },
                    { id: "kikori", name: "木こりの切り株", size: 7, color: 0xaa6633, htmlColor: "#aa6633", pos: [0, 4, -4], childId: null, desc: "争いを避ける第三の勢力。平和主義者。" }
                ]
            },
            "kinoko_detail": {
                id: "kinoko_detail", title: "きのこの山の魅力", type: "連鎖型", parentId: "kinoko_takenoko_group",
                desc: "きのこ派の中でも、何に魅力を感じているかが細分化されている状態。",
                bubbles: [
                    { id: "choco", name: "チョコの量が適正", size: 40, color: 0x552200, htmlColor: "#552200", pos: [-3, 2, 1], childId: null, desc: "チョコの純粋な味を楽しむ層。" },
                    { id: "biscuit", name: "クラッカーの食感", size: 35, color: 0xddaa77, htmlColor: "#ddaa77", pos: [4, -1, -2], childId: null, desc: "食感重視。持ち手が汚れない点も評価。" },
                    { id: "separate", name: "分けて食べられる", size: 25, color: 0xffcc88, htmlColor: "#ffcc88", pos: [0, -4, 2], childId: null, desc: "チョコとクラッカーを分解して食べる異端だが一定数いる層。" }
                ]
            },

            // ----- 【ライトノベルカテゴリ】 (復活データ) -----
            "novels_root": {
                id: "novels_root", title: "ライトノベルのジャンル", type: "階層型", parentId: null,
                desc: "様々なジャンルが乱立する宇宙。",
                bubbles: [
                    { id: "narou_group", name: "なろう系", size: 45, color: 0x4488ff, htmlColor: "#4488ff", pos: [0, 0, 0], childId: "narou_group" },
                    { id: "romcom", name: "ラブコメ", size: 35, color: 0xff88aa, htmlColor: "#ff88aa", pos: [-5, 3, 2], childId: null },
                    { id: "sf", name: "SF", size: 20, color: 0xaaaaaa, htmlColor: "#aaaaaa", pos: [4, -4, -1], childId: null }
                ]
            },
            "narou_group": {
                id: "narou_group", title: "好きななろう小説", type: "多極型", parentId: "novels_root",
                desc: "意見が複数に分かれ、それぞれが一定の規模を持って散らばっている状態。",
                bubbles: [
                    { id: "slime", name: "転生したらスライム...", size: 30, color: 0x4488ff, htmlColor: "#4488ff", pos: [-4, 2, 1], childId: "slime_detail", desc: "国造り要素と無双感を愛する巨大派閥。" },
                    { id: "mushoku", name: "無職転生", size: 28, color: 0xff5555, htmlColor: "#ff5555", pos: [4, 1, -2], childId: null, desc: "重厚なストーリーと成長を描く作品を好む層。" },
                    { id: "hellmode", name: "ヘルモード", size: 22, color: 0x9933ff, htmlColor: "#9933ff", pos: [-1, -3, 2], childId: null, desc: "やり込み要素やゲーム的バランスを好む層。" },
                    { id: "honduki", name: "本好きの下剋上", size: 20, color: 0x44ccaa, htmlColor: "#44ccaa", pos: [2, 4, 3], childId: null, desc: "内政と緻密な世界観設定を愛好する層。" }
                ]
            },
            "slime_detail": {
                id: "slime_detail", title: "転スラの魅力", type: "一極集中型", parentId: "narou_group",
                desc: "特定の要素が圧倒的な支持を得ている状態。",
                bubbles: [
                    { id: "rimuru", name: "リムルが可愛い", size: 70, color: 0x4488ff, htmlColor: "#4488ff", pos: [0, 0, 0], childId: null, desc: "主人公のキャラクター性に惹かれる圧倒的多数派。" },
                    { id: "build", name: "国造り要素", size: 20, color: 0x44ccaa, htmlColor: "#44ccaa", pos: [5, 2, -2], childId: null, desc: "シミュレーションゲーム的な発展を楽しむ層。" },
                    { id: "battle", name: "バトル", size: 10, color: 0xff5555, htmlColor: "#ff5555", pos: [-4, -3, 1], childId: null, desc: "爽快な戦闘シーンを求める層。" }
                ]
            },

            // ----- 【食事カテゴリ】 (復活データ) -----
            "foods_root": {
                id: "foods_root", title: "食事の好み", type: "分散型", parentId: null,
                desc: "和洋中さまざまな食の宇宙。",
                bubbles: [
                    { id: "staple", name: "主食", size: 60, color: 0xffffff, htmlColor: "#ffffff", pos: [0, 0, 0], childId: "staple_group" },
                    { id: "meat", name: "肉", size: 25, color: 0xff4444, htmlColor: "#ff4444", pos: [5, -2, 2], childId: null },
                    { id: "veg", name: "野菜", size: 15, color: 0x44ff44, htmlColor: "#44ff44", pos: [-4, 4, -1], childId: null }
                ]
            },
            "staple_group": {
                id: "staple_group", title: "日本の主食", type: "一極集中型", parentId: "foods_root",
                desc: "1つの巨大なバブルが支配的で、他の意見が極端に少ない状態。無意識の前提になりやすい型。",
                bubbles: [
                    { id: "rice", name: "お米", size: 75, color: 0xffffff, htmlColor: "#ffffff", pos: [0, 0, 0], childId: "rice_detail", desc: "日本人のDNAに刻まれた圧倒的多数派。これが普通だと思っている。" },
                    { id: "bread", name: "パン", size: 18, color: 0xddaa55, htmlColor: "#ddaa55", pos: [7, 2, -2], childId: null, desc: "朝食を中心に一定の勢力を誇るが、米には及ばない。" },
                    { id: "noodle", name: "麺類", size: 7, color: 0xffffaa, htmlColor: "#ffffaa", pos: [-5, -3, 3], childId: null, desc: "手軽さを求める層。" }
                ]
            },
            "rice_detail": {
                id: "rice_detail", title: "お米の食べ方", type: "連鎖型", parentId: "staple_group",
                desc: "圧倒的多数派の中にも、多様な派閥が存在する。",
                bubbles: [
                    { id: "plain", name: "白米そのまま", size: 40, color: 0xffffff, htmlColor: "#ffffff", pos: [-2, 2, 0], childId: null, desc: "米本来の甘みを味わう過激派。" },
                    { id: "furikake", name: "ふりかけ", size: 35, color: 0xffaaaa, htmlColor: "#ffaaaa", pos: [3, -1, 1], childId: null, desc: "味の多様性を求める層。" },
                    { id: "tamago", name: "卵かけご飯", size: 25, color: 0xffff44, htmlColor: "#ffff44", pos: [0, -3, -2], childId: null, desc: "TKGの完成度を信仰する熱狂的な層。" }
                ]
            }
        };

        // API失敗時も中央カテゴリの全バブルから下位層へ進めるよう、
        // 固定DBに不足している詳細グループを補完する。
        function ensureFallbackChildGroups() {
            Object.values(DB).forEach(group => {
                if (!group.parentId) return;
                const parent = DB[group.parentId];
                if (!parent || parent.parentId !== null) return;
                group.bubbles.forEach((bubble, index) => {
                    const existing = bubble.childId && DB[bubble.childId];
                    if (existing && existing.parentId === group.id) return;
                    const childId = `${group.id}__detail_${index + 1}`;
                    const baseColor = Number(bubble.color) || colorFromText(String(bubble.name));
                    DB[childId] = {
                        id: childId,
                        title: `${bubble.name}の詳細`,
                        type: '分散型',
                        parentId: group.id,
                        desc: `${bubble.name}に対する主な評価や理由を細分化したバブル群です。`,
                        bubbles: [
                            { id: `${childId}__related`, name: `${bubble.name}に関連する具体例`, size: 40, color: baseColor, htmlColor: `#${baseColor.toString(16).padStart(6, '0')}`, pos: [-3, 2, 1], childId: null, desc: `${bubble.name}に属する具体的な選択肢。` },
                            { id: `${childId}__faction`, name: `${bubble.name}の代表的な派閥`, size: 35, color: baseColor ^ 0x222222, htmlColor: `#${(baseColor ^ 0x222222).toString(16).padStart(6, '0')}`, pos: [3, -1, -1], childId: null, desc: `${bubble.name}に近い代表的な分類。` },
                            { id: `${childId}__alternative`, name: `${bubble.name}に近い選択肢`, size: 25, color: baseColor ^ 0x444444, htmlColor: `#${(baseColor ^ 0x444444).toString(16).padStart(6, '0')}`, pos: [0, -3, 2], childId: null, desc: `${bubble.name}と比較できる下位選択肢。` }
                        ]
                    };
                    bubble.childId = childId;
                });
            });
        }

        ensureFallbackChildGroups();

        // APIで生成したDBを画面遷移ロジックから透過的に利用するための参照。
        let activeDB = DB;

