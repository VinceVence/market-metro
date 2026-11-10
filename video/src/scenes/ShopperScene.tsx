import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Return} from '../film/Return';
import '../video.css';
export const ShopperScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Return/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/shopper.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Then we follow the campaign into the",
    "startMs": 250,
    "endMs": 1875,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "market.",
    "startMs": 1925,
    "endMs": 2875,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Day thirty five.",
    "startMs": 2950,
    "endMs": 4325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "A shopper who hasn't purchased in sixteen",
    "startMs": 4400,
    "endMs": 6525,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "days receives a recommendation.",
    "startMs": 6575,
    "endMs": 8975,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "A ninety six dollar side table catches",
    "startMs": 9050,
    "endMs": 11400,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "their interest.",
    "startMs": 11450,
    "endMs": 12400,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "They buy it.",
    "startMs": 12450,
    "endMs": 13550,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The next day, it arrives.",
    "startMs": 13625,
    "endMs": 15625,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Under fixed rules, that same request went",
    "startMs": 15675,
    "endMs": 18200,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "unfilled.",
    "startMs": 18275,
    "endMs": 19350,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
