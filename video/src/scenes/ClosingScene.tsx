import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Ending} from '../film/Ending';
import '../video.css';
export const ClosingScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Ending/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/close.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "Market Metro.", "startMs": 250, "endMs": 1350, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Agentic commerce that learns, and shows its", "startMs": 1425, "endMs": 3685, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "work.", "startMs": 3735, "endMs": 4385, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
