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
        from={Math.round(6.883 * fps)}
        volume={0.35}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(19.233 * fps)}
        volume={0.22}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(28.133 * fps)}
        volume={0.3}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(45.767 * fps)}
        volume={0.28}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(51.292 * fps)}
        volume={0.35}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(53.817 * fps)}
        volume={0.45}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(56.507 * fps)}
        volume={0.3}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(65.401 * fps)}
        volume={0.4}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(76.133 * fps)}
        volume={0.33}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(85.433 * fps)}
        volume={0.25}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(95.25 * fps)}
        volume={0.28}
        premountFor={fps}
      />
    </>
  );
};
