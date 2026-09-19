export default function PartTooltip({part,interaction}) {
 if(!part)return null;
 return <div className="part-tooltip" role="tooltip" style={{left:Math.max(8,Math.min(interaction.x+18,window.innerWidth-250)),top:Math.max(8,Math.min(interaction.y+20,window.innerHeight-135))}}><strong>{part.label}</strong><small>{part.type==='detent'?'左鍵逆時針 −45°｜右鍵順時針 +45°；端點停止':part.bidirectional?'左鍵外撥正轉，右鍵內撥反轉；同向再點停止':part.type==='index'?'點一下：刀座往右轉 45°':part.type==='emergency'?'踩下：主軸逐漸停止，可直接重新啟動':part.springReturn?'按住下降，放開自動回位':part.type==='wheel'?'左鍵按住：負向旋轉｜右鍵按住：正向旋轉':'點擊切換主軸啟動／停止'}</small><small>{part.springReturn?'觸控：可直接長按握柄，或使用面板按鈕':part.type==='wheel'?'觸控：先點選，再使用面板左右旋轉按鈕':'觸控：點一下操作'}</small>{part.needsCalibration&&<small>進給比例待校正，需選擇教學模式</small>}</div>;
}
