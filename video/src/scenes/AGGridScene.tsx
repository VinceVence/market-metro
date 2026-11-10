import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Evidence} from '../film/Evidence';
import '../video.css';
export const AGGridScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Evidence/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/ag_grid.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Want to see how we got there?",
    "startMs": 250,
    "endMs": 1850,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Open AG Grid.",
    "startMs": 1925,
    "endMs": 3625,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Follow the models, the agent's decisions, the",
    "startMs": 3725,
    "endMs": 6150,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "campaign, and the PayPal receipt.",
    "startMs": 6200,
    "endMs": 8775,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
