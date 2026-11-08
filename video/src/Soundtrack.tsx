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
        from={Math.round(1.5 * fps)}
        volume={0.3}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(6.683 * fps)}
        volume={0.35}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(19.2 * fps)}
        volume={0.22}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(30.167 * fps)}
        volume={0.3}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(49.733 * fps)}
        volume={0.28}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(55.258 * fps)}
        volume={0.35}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(57.783 * fps)}
        volume={0.45}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(60.473 * fps)}
        volume={0.3}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(69.368 * fps)}
        volume={0.4}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(80.1 * fps)}
        volume={0.33}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(89.4 * fps)}
        volume={0.25}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(99.217 * fps)}
        volume={0.28}
        premountFor={fps}
      />
    </>
  );
};
