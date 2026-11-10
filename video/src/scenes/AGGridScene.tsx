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
    "text": "Follow the evidence in AG Grid: trained",
    "startMs": 250,
    "endMs": 2827,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "models, agent decisions, and the PayPal receipt.",
    "startMs": 2827,
    "endMs": 6576,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Open a checkpoint to see what the",
    "startMs": 6576,
    "endMs": 8685,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "agent knew, chose, and verified.",
    "startMs": 8685,
    "endMs": 11340,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
