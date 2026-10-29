import video from "@/assets/fundo-azul.mp4.asset.json";
import feixe from "@/assets/feixe-azul.webp.asset.json";

/** Moving blue background for the login and password screens. Image shows while the video loads. */
export function VideoBackground() {
  return (
    <video
      className="pointer-events-none absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
      src={video.url}
      poster={feixe.url}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden
    />
  );
}
