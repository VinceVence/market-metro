import { Audio } from "@remotion/media";
import { staticFile, useVideoConfig } from "remotion";
export const Soundtrack = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio
        name="Upbeat original score · 120 BPM · voice ducking"
        src={staticFile("music/upbeat-score.mp3")}
        volume={1}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(3.43 * fps)}
        volume={0.1317430253663076}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(15.75 * fps)}
        volume={0.329357563415769}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(18.225 * fps)}
        volume={0.2258451863422416}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(37.2 * fps)}
        volume={0.20702475414705482}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(55.133 * fps)}
        volume={0.28230648292780197}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(75.6 * fps)}
        volume={0.2634860507326152}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(86.7 * fps)}
        volume={0.329357563415769}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(89.7 * fps)}
        volume={0.42345972439170304}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(92.43 * fps)}
        volume={0.28230648292780197}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(101.1 * fps)}
        volume={0.376408643903736}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(116.731 * fps)}
        volume={0.31053713122058224}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(135.333 * fps)}
        volume={0.235255402439835}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(150.017 * fps)}
        volume={0.2634860507326152}
        premountFor={fps}
      />
    </>
  );
};
