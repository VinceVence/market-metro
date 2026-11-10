import {Audio} from "@remotion/media";
import {staticFile,useVideoConfig} from "remotion";
export const Soundtrack=()=>{const {fps}=useVideoConfig();return <>
  <Audio name="Upbeat original score · 86 BPM · voice ducking" src={staticFile("music/upbeat-score.mp3")} volume={1} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(0.4*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(1.04*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="riser · event" src={staticFile("music/riser.wav")} from={Math.round(3.365*fps)} volume={0.16} premountFor={fps}/>
  <Audio name="hit · event" src={staticFile("music/hit.wav")} from={Math.round(4.915*fps)} volume={0.22} premountFor={fps}/>
  <Audio name="steps · event" src={staticFile("music/steps.wav")} from={Math.round(7.785*fps)} volume={0.4} premountFor={fps}/>
  <Audio name="page · event" src={staticFile("music/page.wav")} from={Math.round(6.165*fps)} volume={0.6} premountFor={fps}/>
  <Audio name="pop · event" src={staticFile("music/pop.wav")} from={Math.round(16.985*fps)} volume={0.52} premountFor={fps}/>
  <Audio name="pop · event" src={staticFile("music/pop.wav")} from={Math.round(18.06*fps)} volume={0.32} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(19.817*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(22.842*fps)} volume={0.24} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(36.733*fps)} volume={0.22} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(75.859*fps)} volume={0.28} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(83.225*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(89.6*fps)} volume={0.45} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(92.375*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(100.635*fps)} volume={0.4} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(113.402*fps)} volume={0.33} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(143.283*fps)} volume={0.28} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(34.633*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(81.8*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(111.7*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(34.233*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(34.673*fps)} volume={0.08} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(54.8*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(55.24*fps)} volume={0.08} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(66.5*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(66.94*fps)} volume={0.08} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(81.4*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(81.84*fps)} volume={0.08} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(96.733*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(97.173*fps)} volume={0.08} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(111.3*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(111.74*fps)} volume={0.08} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(130.933*fps)} volume={0.12} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(131.373*fps)} volume={0.08} premountFor={fps}/>
</>;};
