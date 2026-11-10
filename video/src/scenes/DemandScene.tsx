import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Quiet} from '../film/Quiet';
import '../video.css';
export const DemandScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Quiet/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/problem.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Could AI help him figure it out,",
    "startMs": 250,
    "endMs": 2250,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "and bring those customers back?",
    "startMs": 2300,
    "endMs": 4275,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Meet Market Metro: a simulated commerce world",
    "startMs": 5075,
    "endMs": 8350,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "where AI agents learn from shopper behavior,",
    "startMs": 8400,
    "endMs": 11450,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "build campaigns, and show what happens next.",
    "startMs": 11525,
    "endMs": 14800,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
