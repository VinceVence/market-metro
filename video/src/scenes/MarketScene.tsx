import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Merchant} from '../film/Merchant';
import '../video.css';
export const MarketScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Merchant/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/market.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "The doors are open.", "startMs": 250, "endMs": 1550, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "The shelves are ready.", "startMs": 1600, "endMs": 3000, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "But some shoppers have gone quiet.", "startMs": 3050, "endMs": 5200, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Meet Form and Function, a furniture shop", "startMs": 5300, "endMs": 7710, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "inside our simulated Market Metro.", "startMs": 7785, "endMs": 10135, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
