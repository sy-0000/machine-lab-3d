export default function SafetyPage() {
  return (
    <main className="info-page safety-page">
      <div className="info-header">
        <a className="back-link" href="#/">← 返回首頁</a>
        <h1>機械加工實習 · 工安安全規範</h1>
        <p className="subtitle">Machining Safety Standards & Protocols</p>
      </div>

      <div className="info-content">
        <section className="safety-card general-safety">
          <h2>一、基本個人防護裝備 (PPE)</h2>
          <ul>
            <li><strong>防護眼鏡：</strong>進入實習工場全程配戴合格護目鏡，防止高溫切屑或切削液噴濺。</li>
            <li><strong>嚴禁配戴手套：</strong>操作車床、銑床、鑽床等任何旋轉主軸機械時，<strong>絕對禁止配戴棉紗手套</strong>，以防捲入造成重大傷害。</li>
            <li><strong>衣著規範：</strong>穿著合身工作服並扣妥袖口；長髮必須完全收束置於工作帽內；禁止佩戴領帶、項鍊、手錶等飾品。</li>
            <li><strong>安全鞋：</strong>必須穿著防滑鋼頭安全鞋，防止重物掉落砸傷或金屬碎屑刺穿。</li>
          </ul>
        </section>

        <section className="safety-card lathe-safety">
          <h2>二、車床 (Engine Lathe) 操作安全守則</h2>
          <ul>
            <li><strong>夾頭扳手 (Chuck Key)：</strong>夾持或取下工件後，<strong>夾頭扳手必須立即拔下</strong>，切勿留在夾頭孔內，防止啟動時飛出傷人。</li>
            <li><strong>工件夾持：</strong>細長工件伸出夾頭過長時，必須使用尾座頂心 (Tailstock Center) 支撐；確實鎖緊卡爪與刀架。</li>
            <li><strong>手部安全：</strong>主軸運轉中，嚴禁用手觸摸旋轉中的夾頭、工件或切屑；禁止用手直接剎車，應使用煞車腳踏板。</li>
            <li><strong>量測防護：</strong>禁止在工件旋轉時使用游標卡尺或分厘卡進行測量，必須完全停機後方可量測。</li>
          </ul>
        </section>

        <section className="safety-card milling-safety">
          <h2>三、銑床 (Milling Machine) 操作安全守則</h2>
          <ul>
            <li><strong>工件固定：</strong>工件必須牢固夾緊於精密虎鉗或壓板螺栓上；銑削前確認切削方向，避免順銑產生推擠拉動。</li>
            <li><strong>更換刀具：</strong>安裝或拆卸端銑刀、面銑刀時，主軸必須完全切斷電源並落鎖，使用專用扳手確實鎖緊筒夾 (Collet)。</li>
            <li><strong>鐵屑清除：</strong>清除工作臺鐵屑必須使用專用毛刷或鐵屑鉤，嚴禁用手直接抓取或用嘴吹拂。</li>
          </ul>
        </section>

        <section className="safety-card drill-safety">
          <h2>四、鑽床 (Drill Press) 操作安全守則</h2>
          <ul>
            <li><strong>工件夾固：</strong>嚴禁用手直接抓持薄板或工件進行鑽孔，必須使用鑽床專用虎鉗或 C 型夾牢固夾持於工作臺上。</li>
            <li><strong>貫穿防護：</strong>鑽孔即將貫穿底面時，必須減輕進給手柄壓力，以防鑽頭咬住工件造成工件旋轉飛甩。</li>
            <li><strong>鑽夾頭扳手：</strong>安裝鑽頭後立即取下夾頭扳手。</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
