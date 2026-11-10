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
    "text": "Could AI help bring those customers back?",
    "startMs": 250,
    "endMs": 2875,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Meet Market Metro: a simulated commerce environment",
    "startMs": 3275,
    "endMs": 7025,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "where agents observe shoppers, train models, and",
    "startMs": 7100,
    "endMs": 10175,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "test campaigns.",
    "startMs": 10225,
    "endMs": 11650,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Then we measure whether those decisions actually",
    "startMs": 11725,
    "endMs": 14100,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "help.",
    "startMs": 14150,
    "endMs": 14900,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
