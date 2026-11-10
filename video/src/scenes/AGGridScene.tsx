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
    "text": "Don't take our word for it.",
    "startMs": 250,
    "endMs": 2320,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "AG Grid lets judges inspect the entire",
    "startMs": 2320,
    "endMs": 4687,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "journey: trained models, agent decisions, campaign outcomes",
    "startMs": 4687,
    "endMs": 8605,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "and the native PayPal receipt.",
    "startMs": 8605,
    "endMs": 10972,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Open any checkpoint and follow the evidence.",
    "startMs": 10972,
    "endMs": 14225,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
