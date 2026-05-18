export class PlayerController {
  seek(video: HTMLVideoElement, time: number): void {
    video.currentTime = time;
  }
}
