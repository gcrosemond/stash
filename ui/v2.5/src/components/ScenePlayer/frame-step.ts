import videojs, { VideoJsPlayer } from "video.js";

export interface IFrameStepOptions {
  enabled?: boolean;
  frameRate?: number;
}

export function stepFrames(
  player: VideoJsPlayer,
  frameRate: number | undefined,
  frames: number
): boolean {
  if (!player.paused() || !frameRate || frameRate <= 0) return false;

  const currentTime = player.currentTime();
  const duration = player.duration();
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration)) {
    return false;
  }

  const targetTime = Math.min(
    duration,
    Math.max(0, currentTime + frames / frameRate)
  );
  player.currentTime(targetTime);
  return true;
}

interface FrameStepButtonOptions extends videojs.ComponentOptions {
  direction: "back" | "forward";
  parent: FrameStepPlugin;
}

class FrameStepButton extends videojs.getComponent("Button") {
  private readonly direction: "back" | "forward";
  private readonly parentPlugin: FrameStepPlugin;

  constructor(player: VideoJsPlayer, options: FrameStepButtonOptions) {
    super(player, options);
    this.direction = options.direction;
    this.parentPlugin = options.parent;
    this.addClass(`vjs-frame-step-${this.direction}`);
    this.renderIcon();

    const direction = options.direction === "back" ? "back" : "forward";
    this.controlText(
      `Step ${direction} one frame (hold Shift to step ten frames)`
    );
    this.updateEnabled();

    player.on("play", () => this.updateEnabled());
    player.on("pause", () => this.updateEnabled());
    player.on("loadedmetadata", () => this.updateEnabled());
  }

  buildCSSClass() {
    return `vjs-frame-step-button ${super.buildCSSClass()}`;
  }

  createEl() {
    return super.createEl("button");
  }

  private renderIcon() {
    const el = this.el();
    const placeholder = el.querySelector(".vjs-icon-placeholder");
    if (!placeholder) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 24 24");

    const frame = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    frame.setAttribute("x", "2");
    frame.setAttribute("y", "3");
    frame.setAttribute("width", "20");
    frame.setAttribute("height", "18");
    frame.setAttribute("rx", "1");
    svg.appendChild(frame);

    const arrow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    arrow.setAttribute(
      "d",
      this.direction === "back" ? "M15 8l-4 4 4 4" : "M9 8l4 4-4 4"
    );
    svg.appendChild(arrow);

    placeholder.replaceChildren(svg);
  }

  handleClick(event: Event) {
    const shiftKey = Boolean(
      (event as unknown as { shiftKey?: boolean }).shiftKey
    );
    this.parentPlugin.step(
      (this.direction === "back" ? -1 : 1) * (shiftKey ? 10 : 1)
    );
  }

  public updateEnabled() {
    if (this.parentPlugin.canStep()) {
      this.enable();
    } else {
      this.disable();
    }
  }
}

class FrameStepPlugin extends videojs.getPlugin("plugin") {
  private readonly buttons: FrameStepButton[];
  private enabled: boolean;
  private frameRate?: number;

  constructor(player: VideoJsPlayer, options?: IFrameStepOptions) {
    super(player, options);

    this.enabled = options?.enabled ?? true;
    this.frameRate = options?.frameRate;
    this.buttons = [
      new FrameStepButton(player, {
        direction: "back",
        parent: this,
      }),
      new FrameStepButton(player, {
        direction: "forward",
        parent: this,
      }),
    ];

    player.ready(() => this.ready());
  }

  public setFrameRate(frameRate: number | undefined) {
    this.frameRate = frameRate;
    for (const button of this.buttons) {
      button.updateEnabled();
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    for (const button of this.buttons) {
      button.updateEnabled();
    }
  }

  public canStep() {
    return (
      this.enabled &&
      this.player.paused() &&
      this.frameRate !== undefined &&
      this.frameRate > 0
    );
  }

  public step(frames: number) {
    return stepFrames(this.player, this.frameRate, frames);
  }

  private ready() {
    if (!this.enabled) return;

    const { controlBar } = this.player;
    const fullscreenToggle = controlBar.getChild("fullscreenToggle");

    for (const button of this.buttons) {
      controlBar.addChild(button);
      if (fullscreenToggle) {
        controlBar.el().insertBefore(button.el(), fullscreenToggle.el());
      }
    }
  }
}

videojs.registerComponent("FrameStepButton", FrameStepButton);
videojs.registerPlugin("frameStep", FrameStepPlugin);

declare module "video.js" {
  interface VideoJsPlayer {
    frameStep: () => FrameStepPlugin;
  }

  interface VideoJsPlayerPluginOptions {
    frameStep?: IFrameStepOptions;
  }
}

export default FrameStepPlugin;
