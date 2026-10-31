using MachineYard.Core;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 機台聲音：用 Core 的 MachineSynth 即時合成（沒有任何音檔），經串流 AudioClip 播放，3D 音源放在機台中央上方 1 m
    /// （與網站相同的 (0, 1.0, 0)）。轉速 → 馬達聲；切削次數增加 → 切削聲；軸移動 → 手輪喀聲；刀尖壓入工件／撞夾頭 → 警告聲。
    /// 機台被停用（換機台）時音源自動停止。
    /// </summary>
    public class MachineAudio : MonoBehaviour
    {
        public LatheMachine machine; public LatheCuttingController lathe; public HeadMachining head;
        public bool muted;
        MachineSynth synth; AudioSource src; double lastSum; int lastCuts; bool wasUnsafe, started;

        void Start()
        {
            int sr = AudioSettings.outputSampleRate;
            synth = new MachineSynth(machine.Config != null ? machine.Config.machineId : "lathe", sr);
            var go = new GameObject("MachineAudio"); go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.up;
            src = go.AddComponent<AudioSource>();
            // 一秒的單聲道串流片段，循環播放；回呼在音訊執行緒填資料
            src.clip = AudioClip.Create("MachineSynth", sr, 1, sr, true, data => synth.Render(data, 1));
            src.loop = true; src.spatialBlend = 1f; src.minDistance = 1.2f; src.maxDistance = 25f; src.volume = 1f;
            src.Play(); started = true;
        }

        void Update()
        {
            if (!started || !machine.Ready) return;
            synth.SetMuted(muted);
            synth.SetState(machine.Spindle.Rpm);
            int cuts = lathe != null ? lathe.CutCount : head != null ? head.CutCount : 0;
            if (cuts > lastCuts) synth.OnCut();
            lastCuts = cuts;
            double sum = 0; foreach (var v in machine.Axes.Offsets.Values) sum += v;
            synth.OnAxisMoved(System.Math.Abs(sum - lastSum) * 1000.0, Time.time);
            lastSum = sum;
            bool u = (lathe != null && lathe.Unsafe) || (head != null && head.Unsafe);
            if (u && !wasUnsafe) synth.Warn();
            wasUnsafe = u;
        }
    }
}
