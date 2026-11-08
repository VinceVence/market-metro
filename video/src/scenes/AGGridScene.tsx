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
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-neural/ag_grid.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Judges can follow the whole trail in",
    "startMs": 250,
    "endMs": 2438,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "A G Grid, from model training and",
    "startMs": 2438,
    "endMs": 4406,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "the agent's decision to the PayPal receipt,",
    "startMs": 4406,
    "endMs": 7104,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "instead of taking the result on trust.",
    "startMs": 7104,
    "endMs": 9875,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
