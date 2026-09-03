import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

// ─── Constants ───────────────────────────────────────────────
const PREFS = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
const GENRES = ["和食","洋食","中華","イタリアン","フレンチ","アジア料理","カフェ・軽食","居酒屋","ラーメン・麺類","焼肉・ステーキ","その他"];
const PRICES = ["〜¥1,000","¥1,000〜¥2,000","¥2,000〜¥3,000","¥3,000〜¥5,000","¥5,000〜"];
const STORAGE_KEY = "veganmenu_draft";

// ─── Fix①: emptyRowをコンポーネント外に移動（再レンダリングで再定義されない）
const makeEmptyRow = () => ({ id: `${Date.now()}-${Math.random()}`, name: "", ingredients: "", description: "" });

// ─── Fix②: Headerをコンポーネント外に移動（毎回再マウントされない）
const Header = ({ storeName, onLogout }) => (
  <div className="bg-green-900 px-6 h-14 flex items-center justify-between shadow no-print">
    <span className="text-white font-bold flex items-center gap-2">🌱 VeganMenu AI</span>
    <div className="flex items-center gap-3">
      <span className="text-green-300 text-xs">{storeName}</span>
      <button onClick={onLogout} className="text-white text-xs border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">リセット</button>
    </div>
  </div>
);

const PRINT_STYLE = `
@media print {
  body { background: white !important; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
.print-only { display: none; }
`;

// ─── Main Component ───────────────────────────────────────────
export default function App() {

  // Auth
  const [view, setView] = useState("dash");
  const [me, setMe] = useState({ storeName: "" });


  // Input method
  const [inputMethod, setInputMethod] = useState("file");

  // File input
  const [file, setFile] = useState(null);
  const [menuData, setMenuData] = useState(null);
  const [fileWarn, setFileWarn] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const fileRef = useRef();

  // Form input
  const [formRows, setFormRows] = useState([makeEmptyRow()]);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  // Conditions & results
  const [genre, setGenre] = useState("");
  const [regional, setRegional] = useState(false);
  const [region, setRegion] = useState("");
  const [price, setPrice] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formErr, setFormErr] = useState("");

  // ─── Row helpers ─────────────────────────────────────────────
  const updateRow = (id, field, val) =>
    setFormRows(rows => rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addRow = () => setFormRows(rows => [...rows, makeEmptyRow()]);
  const removeRow = (id) =>
    setFormRows(rows => rows.length > 1 ? rows.filter(r => r.id !== id) : rows);
  const clearRows = () => setFormRows([makeEmptyRow()]);

  // ─── Auto-save (storage) ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res?.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFormRows(parsed);
            setSavedAt(new Date());
          }
        }
      } catch { /* storage未対応環境では無視 */ }
    })();
  }, []);

  useEffect(() => {
    const hasContent = formRows.some(r => r.name || r.ingredients || r.description);
    if (!hasContent) return;
    setSavedAt("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(formRows));
        setSavedAt(new Date());
      } catch { setSavedAt(null); }
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [formRows]);

  const doLogout = () => {
    setResults(null); setMenuData(null); setFile(null);
    setFormErr(""); setFileWarn("");
    setGenre(""); setPrice(""); setRegional(false); setRegion("");
  };

  // ─── Sample download ──────────────────────────────────────────
  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["メニュー名", "使用食材", "商品説明"],
      ["とんかつ定食", "豚ロース・パン粉・卵・キャベツ・味噌", "サクサクの衣が自慢のボリューム満点定食。ランチ限定。"],
      ["鶏唐揚げ", "鶏もも肉・醤油・みりん・生姜・にんにく・片栗粉", "ジューシーな唐揚げ。単品・定食どちらでも。"],
      ["肉じゃが", "牛肉・じゃがいも・玉ねぎ・にんじん・醤油・みりん・砂糖", "ほっこりした味わいの和風煮物。"],
      ["味噌汁", "豆腐・わかめ・だし・味噌", "定食セットの汁物。"],
      ["チャーハン", "ご飯・卵・ハム・長ネギ・醤油・ごま油・塩・胡椒", "パラパラ食感の中華チャーハン。"],
    ]);
    ws["!cols"] = [{ wch: 16 }, { wch: 36 }, { wch: 36 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "メニュー一覧");
    XLSX.writeFile(wb, "menu_sample.xlsx");
  };

  // ─── File read: Fix③ readAsArrayBuffer（文字化け防止）──────────
  const readFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    setFile(f); setMenuData(null); setFileWarn(""); setFormErr("");
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const rows = raw.filter(r => r.some(c => String(c).trim() !== ""));
        if (rows.length < 2) {
          setFileWarn("データが少なすぎます。メニュー情報が入力されているか確認してください。");
        } else if (rows[0].length < 2) {
          setFileWarn("列が1列のみです。使用食材列を追加すると提案精度が大幅に上がります。");
        }
        setMenuData(rows);
      } catch { setFormErr("ファイルの読み込みに失敗しました。形式を確認してください。"); }
    };
    reader.readAsArrayBuffer(f); // Fix③: binary→array
  };

  // ─── Analyze ─────────────────────────────────────────────────
  const analyze = async () => {
    setFormErr("");
    const hasFile = inputMethod === "file" && menuData && menuData.length > 0;
    const hasForm = inputMethod === "text" && formRows.some(r => r.name.trim() || r.ingredients.trim());
    if (!hasFile && !hasForm) {
      setFormErr(inputMethod === "file" ? "メニューファイルをアップロードしてください" : "メニュー名または食材を1品以上入力してください");
      return;
    }
    if (!genre) { setFormErr("料理ジャンルを選択してください"); return; }
    if (!price) { setFormErr("価格帯を選択してください"); return; }
    if (regional && !region.trim()) { setFormErr("対象地域を入力してください"); return; }

    setLoading(true);
    let menuContent = "";
    let lowInfoNote = false;

    if (inputMethod === "file") {
      menuContent = menuData
        .map(r => r.filter(c => String(c).trim() !== "").join(" | "))
        .filter(l => l.trim() !== "")
        .join("\n");
      if ((menuData[0]?.length ?? 0) < 2) lowInfoNote = true;
    } else {
      const filled = formRows.filter(r => r.name.trim() || r.ingredients.trim());
      menuContent = filled
        .map(r => [r.name, r.ingredients, r.description].filter(v => v.trim()).join(" / "))
        .join("\n");
      if (filled.every(r => !r.ingredients.trim())) lowInfoNote = true;
    }

    const prompt = `あなたはヴィーガンメニュー開発の専門家です。

【店舗条件】
料理ジャンル: ${genre}
地域色: ${regional ? `あり（${region}）` : "なし"}
価格帯: ${price}

【既存メニュー・食材データ】
${menuContent}

【ルール】
- 動物性食材（肉・魚・乳製品・卵・蜂蜜）を完全除外
- 既存の調理器具・食材を最大活用
- 地域色ありの場合はその地域の植物性特産品を積極活用
- 指定価格帯に合わせる
- 食材情報が不足している場合でも必ずメニュー案を出すこと

【出力形式】
以下のJSON形式のみで回答。コードブロック・説明文は一切不要。文字列内に改行・ダブルクォートを含めないこと。

{"menus":[{"name":"メニュー名","concept":"コンセプト2〜3文","ingredients":["食材1","食材2","食材3"],"recipe":["手順1","手順2","手順3","手順4"],"price":"推奨価格","veganPoint":"ヴィーガン対応ポイント"}]}

3〜5品提案してください。`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`APIエラー(${res.status}): ${t.slice(0, 200)}`);
      }
      const d = await res.json();
      if (d.error) throw new Error("APIエラー: " + JSON.stringify(d.error));

      const text = d.content?.find(c => c.type === "text")?.text || "";
      if (!text) throw new Error("AIからの応答が空でした");

      // Fix④: より堅牢なJSONパース（ネストした文字列も安全に処理）
      const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSONが見つかりません: " + cleaned.slice(0, 200));

      // 文字列値内の改行・制御文字を除去（配列内も含む）
      const sanitized = jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F]/g, " ")  // 制御文字
        .replace(/\r?\n/g, " ");                  // 改行

      const parsed = JSON.parse(sanitized);
      if (!parsed.menus || !Array.isArray(parsed.menus)) {
        throw new Error("レスポンスの形式が正しくありません");
      }
      setResults({ ...parsed, lowInfoNote });
      setView("results");
    } catch (e) {
      setFormErr(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => window.print();

  // ─── DASHBOARD VIEW ───────────────────────────────────────────
  if (view === "dash") return (
    <div className="min-h-screen bg-stone-100">
      <Header storeName={me?.storeName} onLogout={doLogout} />
      <div className="max-w-2xl mx-auto px-5 py-8 pb-20">
        <h1 className="text-2xl font-bold text-green-900 mb-1">ヴィーガンメニューを生成</h1>
        <p className="text-sm text-gray-500 mb-6">既存メニューの情報をもとに、AIが最適なヴィーガンメニューを提案します</p>

        {formErr && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm mb-4">{formErr}</div>}

        {/* Input card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-green-900 text-sm mb-4 pb-3 border-b border-stone-100">📋 メニュー情報の入力方法</h2>

          <div className="flex bg-stone-100 rounded-xl p-1 mb-5">
            {[["file", "📂 Excel / CSV"], ["text", "✏️ テキスト入力"]].map(([v, l]) => (
              <button key={v} onClick={() => setInputMethod(v)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${inputMethod === v ? "bg-white text-green-900 font-semibold shadow" : "text-gray-500 hover:text-gray-700"}`}>
                {l}
              </button>
            ))}
          </div>

          {/* File mode */}
          {inputMethod === "file" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">推奨：メニュー名・使用食材・商品説明の3列</p>
                <div className="flex gap-2">
                  <button onClick={downloadSample} className="text-xs text-green-700 border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">⬇ サンプルDL</button>
                  <button onClick={() => setShowGuide(!showGuide)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showGuide ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-stone-50 border-stone-200 text-gray-500 hover:bg-stone-100"}`}>
                    {showGuide ? "▲ 閉じる" : "▼ ガイド"}
                  </button>
                </div>
              </div>

              {showGuide && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-xs text-amber-900">
                  <p className="font-bold mb-2">📌 推奨フォーマット（1行目はヘッダー）</p>
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-amber-200">
                          {["メニュー名", "使用食材", "商品説明"].map(h => (
                            <td key={h} className="border border-amber-300 px-2 py-1 font-bold">{h}</td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white"><td className="border border-amber-200 px-2 py-1">とんかつ定食</td><td className="border border-amber-200 px-2 py-1">豚ロース・パン粉・卵</td><td className="border border-amber-200 px-2 py-1">サクサクの衣が自慢</td></tr>
                        <tr className="bg-amber-50"><td className="border border-amber-200 px-2 py-1">鶏唐揚げ</td><td className="border border-amber-200 px-2 py-1">鶏もも・醤油・生姜</td><td className="border border-amber-200 px-2 py-1">ジューシーな唐揚げ</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-1 text-amber-800">
                    <p>✅ 使用食材列があるとAI精度が大幅向上</p>
                    <p>✅ 列順・列名は自由。AIがデータ全体を読み取ります</p>
                    <p>⚠️ スマホの場合 → Googleスプレッドシートで作成 → .xlsx形式でDL</p>
                  </div>
                </div>
              )}

              <div onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${file ? "border-green-600 bg-green-50" : "border-stone-300 bg-stone-50 hover:border-green-500 hover:bg-green-50"}`}>
                <div className="text-3xl mb-2">{file ? "✅" : "📂"}</div>
                <div className="text-sm font-medium text-gray-600">{file ? file.name : "クリックしてExcel / CSVをアップロード"}</div>
                <div className="text-xs text-gray-400 mt-1">{file ? "クリックして別のファイルに変更" : ".xlsx / .xls / .csv に対応"}</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={readFile} className="hidden" />

              {fileWarn && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800 flex gap-2">
                  <span>⚠️</span><span>{fileWarn}</span>
                </div>
              )}
              {menuData && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-green-700 mb-2">✓ {menuData.length}行を読み込みました（先頭5行プレビュー）</p>
                  <div className="max-h-28 overflow-y-auto border border-stone-200 rounded-lg">
                    <table className="w-full text-xs"><tbody>
                      {menuData.slice(0, 5).map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-stone-50"}>
                          {r.map((c, j) => <td key={j} className="px-2 py-1.5 border-b border-stone-100 text-gray-600 max-w-28 truncate">{String(c)}</td>)}
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Text mode */}
          {inputMethod === "text" && (
            <>
              {formRows.map((row, idx) => (
                <div key={row.id} className="border border-stone-200 rounded-xl p-4 mb-3 bg-stone-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-green-800 bg-green-100 px-2.5 py-1 rounded-full">品目 {idx + 1}</span>
                    {formRows.length > 1 && (
                      <button onClick={() => removeRow(row.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1 rounded-lg transition-colors">✕ 削除</button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">メニュー名</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 bg-white transition-colors"
                        type="text" placeholder="例：とんかつ定食" value={row.name} onChange={e => updateRow(row.id, "name", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        使用食材 <span className="text-green-600 normal-case font-normal">（精度向上に重要）</span>
                      </label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 bg-white transition-colors"
                        type="text" placeholder="例：豚ロース・パン粉・卵・キャベツ・味噌" value={row.ingredients} onChange={e => updateRow(row.id, "ingredients", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        商品説明 <span className="text-gray-400 normal-case font-normal">（任意）</span>
                      </label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 bg-white transition-colors"
                        type="text" placeholder="例：サクサクの衣が自慢のボリューム定食" value={row.description} onChange={e => updateRow(row.id, "description", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addRow} className="w-full py-2.5 border-2 border-dashed border-green-300 rounded-xl text-sm text-green-700 font-medium hover:border-green-500 hover:bg-green-50 transition-all mb-3">
                ＋ メニューを追加
              </button>

              <div className="flex items-center justify-between">
                <button onClick={clearRows} className="text-xs text-gray-400 hover:text-red-500 transition-colors">全クリア</button>
                <span className="text-xs">
                  {savedAt === "saving" && <span className="text-amber-500">保存中...</span>}
                  {savedAt && savedAt !== "saving" && (
                    <span className="text-green-600">✓ 自動保存済み {savedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                  {!savedAt && formRows.some(r => r.name || r.ingredients) && (
                    <span className="text-gray-400">※ 公開後に自動保存が有効になります</span>
                  )}
                </span>
              </div>

              {formRows.every(r => !r.ingredients.trim()) && formRows.some(r => r.name.trim()) && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  ⚠️ 使用食材を入力すると提案精度が大幅に向上します
                </div>
              )}
            </>
          )}
        </div>

        {/* Conditions card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-green-900 text-sm mb-4 pb-3 border-b border-stone-100">⚙️ 提案条件</h2>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">料理ジャンル *</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white mb-4 focus:border-green-500"
            value={genre} onChange={e => setGenre(e.target.value)}>
            <option value="">選択してください</option>
            {GENRES.map(g => <option key={g}>{g}</option>)}
          </select>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">価格帯 *</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white mb-4 focus:border-green-500"
            value={price} onChange={e => setPrice(e.target.value)}>
            <option value="">選択してください</option>
            {PRICES.map(p => <option key={p}>{p}</option>)}
          </select>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">地域色</label>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setRegional(!regional)}
              className={`relative w-11 h-6 rounded-full transition-colors ${regional ? "bg-green-700" : "bg-gray-300"}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${regional ? "left-5" : "left-0.5"}`}></div>
            </button>
            <span className="text-sm text-gray-600">{regional ? "地域色あり" : "地域色なし"}</span>
          </div>
          {regional && (
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500 transition-colors"
              type="text" placeholder="例：石川県・加賀野菜" value={region} onChange={e => setRegion(e.target.value)} />
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
            <div className="w-10 h-10 border-4 border-green-100 border-t-green-700 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-bold text-green-900">AIがヴィーガンメニューを考案中...</p>
            <p className="text-xs text-gray-400 mt-1">食材を分析してレシピを生成しています</p>
          </div>
        ) : (
          <button onClick={analyze} className="w-full py-3.5 bg-gradient-to-r from-green-900 to-green-700 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity">
            🌿 ヴィーガンメニューを生成する
          </button>
        )}
      </div>
    </div>
  );

  // ─── RESULTS VIEW ─────────────────────────────────────────────
  const menus = results?.menus || [];
  return (
    <div className="min-h-screen bg-stone-100">
      <style>{PRINT_STYLE}</style>
      <div className="no-print"><Header storeName={me?.storeName} onLogout={doLogout} /></div>

      {/* 印刷用ヘッダー */}
      <div className="print-only" style={{ padding: "20px 32px 8px", borderBottom: "2px solid #166534" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#166534" }}>🌱 VeganMenu AI — 提案メニュー</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {me?.storeName} | {genre} | {price}{regional ? ` | ${region}` : ""} | {new Date().toLocaleDateString("ja-JP")}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 pb-20">
        <div className="flex items-start justify-between mb-6 no-print">
          <div>
            <h1 className="text-2xl font-bold text-green-900 mb-1">提案メニュー</h1>
            <p className="text-sm text-gray-500">{menus.length}品のヴィーガンメニューを生成しました</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadPDF} className="text-sm text-white bg-green-800 hover:bg-green-900 px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-colors">
              🖨 PDFとして保存
            </button>
            <button onClick={() => { setView("dash"); setFormErr(""); }}
              className="text-sm text-green-700 border border-green-200 bg-white px-4 py-2 rounded-xl hover:bg-green-50 transition-colors">
              ← 再生成
            </button>
          </div>
        </div>

        {results?.lowInfoNote && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-5 flex items-start gap-3 no-print">
            <span>⚠️</span>
            <div>
              <p className="font-semibold text-amber-800 text-sm">情報が少ない状態での提案です</p>
              <p className="text-xs text-amber-700 mt-0.5">使用食材の情報を追加して再生成すると、より具体的な提案が得られます。</p>
            </div>
          </div>
        )}

        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <span className="text-2xl">🌿</span>
          <div>
            <p className="font-semibold text-green-900 text-sm">生成完了</p>
            <p className="text-xs text-gray-500">{genre} | {price}{regional ? ` | 地域色: ${region}` : ""} | 入力: {inputMethod === "file" ? "Excel/CSV" : "テキスト"}</p>
          </div>
        </div>

        {menus.map((m, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm mb-5 overflow-hidden">
            <div className="bg-gradient-to-r from-green-950 to-green-800 px-6 py-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/40 font-bold tracking-widest mb-1">MENU {String(i + 1).padStart(2, "0")}</p>
                <p className="text-xl font-bold text-white leading-snug">{m.name}</p>
              </div>
              <span className="bg-white/15 text-green-200 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap mt-1">{m.price}</span>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 leading-relaxed mb-5 pb-4 border-b border-stone-100">{m.concept}</p>
              <div className="mb-4">
                <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">使用食材</p>
                <div className="flex flex-wrap gap-1.5">
                  {(m.ingredients || []).map((x, j) => (
                    <span key={j} className="bg-green-50 text-green-900 border border-green-200 text-xs px-3 py-1 rounded-full font-medium">{x}</span>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">レシピ</p>
                {(m.recipe || []).map((step, j) => (
                  <div key={j} className="flex gap-2.5 mb-2">
                    <div className="w-5 h-5 bg-green-800 text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">{j + 1}</div>
                    <p className="text-sm text-gray-600 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
              {m.veganPoint && (
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">ヴィーガン対応ポイント</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">🌿 {m.veganPoint}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
