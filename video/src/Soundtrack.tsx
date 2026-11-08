import {Audio} from "@remotion/media";
import {staticFile,useVideoConfig} from "remotion";
export const Soundtrack=()=>{const {fps}=useVideoConfig();return <>
  <Audio name="Upbeat original score · 120 BPM · voice ducking" src={staticFile("music/upbeat-score.mp3")} volume={1} premountFor={fps}/>
  <Audio name="sweep · event" src={staticFile("music/sweep.wav")} from={Math.round(1.5*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(15.717*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(21.392*fps)} volume={0.24} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(32.467*fps)} volume={0.22} premountFor={fps}/>
  <Audio name="sweep · event" src={staticFile("music/sweep.wav")} from={Math.round(43.433*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(63.0*fps)} volume={0.28} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(68.525*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(71.05*fps)} volume={0.45} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(73.74*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(82.635*fps)} volume={0.4} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(93.186*fps)} volume={0.33} premountFor={fps}/>
  <Audio name="sweep · event" src={staticFile("music/sweep.wav")} from={Math.round(102.3*fps)} volume={0.25} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(112.117*fps)} volume={0.28} premountFor={fps}/>
</>;};
