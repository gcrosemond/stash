import React, { useMemo, useRef, useState } from "react";
import {
  faCompressArrowsAlt,
  faCrosshairs,
  faExpandArrowsAlt,
  faLocationArrow,
  faPlus,
  faRepeat,
  faStepBackward,
  faStepForward,
  faWaveSquare,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { useMovieEditor } from "./MovieEditorContext";
import { virtualSceneColor } from "./virtualSceneColor";

const MAX_ZOOM = 16;
const SCROLL_ZOOM_STEP = 0.1;

const formatTimelineTime = (seconds: number) => {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatZoom = (zoom: number) => Number(zoom.toFixed(2)).toString();

export const VirtualScenesPanel: React.FC = () => {
  const {
    duration,
    audioWaveform,
    waveformStatus,
    setWaveformAvailable,
    timelineScenes,
    draft,
    selectedID,
    currentTime,
    selectScene,
    moveBoundary,
    seek,
    addScene,
    preview,
    loopSelected,
    generateWaveform,
    generatingWaveform,
  } = useMovieEditor();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end">();
  const [zoom, setZoom] = useState(1);
  const [timelineStart, setTimelineStart] = useState(0);

  const visibleDuration = duration > 0 ? duration / zoom : 0;
  const maxTimelineStart = Math.max(0, duration - visibleDuration);
  const visibleStart = Math.max(0, Math.min(timelineStart, maxTimelineStart));
  const visibleEnd = visibleStart + visibleDuration;
  const clampTimelineStart = (value: number) =>
    Math.max(0, Math.min(value, maxTimelineStart));
  const centerTimelineOn = (seconds: number, nextZoom = zoom) => {
    const nextDuration = duration > 0 ? duration / nextZoom : 0;
    setTimelineStart(
      Math.max(0, Math.min(seconds - nextDuration / 2, duration - nextDuration))
    );
  };
  const timelineTicks = useMemo(() => {
    if (visibleDuration <= 0) return [];
    const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
    const interval = intervals.find((value) => value >= visibleDuration / 7) ?? intervals.at(-1)!;
    const first = Math.ceil(visibleStart / interval) * interval;
    const ticks: number[] = [];
    for (let value = first; value <= visibleEnd; value += interval) ticks.push(value);
    return ticks;
  }, [visibleDuration, visibleEnd, visibleStart]);
  const boundaries = useMemo(
    () =>
      [...new Set(timelineScenes.flatMap((item) => [
        item.start_seconds ?? 0,
        item.end_seconds ?? 0,
      ]))].sort((a, b) => a - b),
    [timelineScenes]
  );
  const previousBoundary = [...boundaries]
    .reverse()
    .find((boundary) => boundary < currentTime - 0.01);
  const nextBoundary = boundaries.find(
    (boundary) => boundary > currentTime + 0.01
  );

  const secondsAtPointer = (
    event: React.PointerEvent | React.MouseEvent
  ) => {
    const bounds = timelineRef.current?.getBoundingClientRect();
    if (!bounds || visibleDuration <= 0) return undefined;
    const fraction = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width)
    );
    return visibleStart + fraction * visibleDuration;
  };
  const position = (seconds: number) =>
    `${((seconds - visibleStart) / Math.max(visibleDuration, 1)) * 100}%`;
  const rangeStyle = (start: number, end: number) => {
    const clippedStart = Math.max(start, visibleStart);
    const clippedEnd = Math.min(end, visibleEnd);
    return {
      left: position(clippedStart),
      width: `${Math.max(
        0.35,
        ((clippedEnd - clippedStart) / Math.max(visibleDuration, 1)) * 100
      )}%`,
    };
  };
  const isVisible = (start: number, end: number) =>
    end > visibleStart && start < visibleEnd;
  const isHandleClick = (event: React.MouseEvent) =>
    event.target instanceof Element &&
    !!event.target.closest(".movie-timeline-handle");
  const seekAtPointer = (event: React.MouseEvent) => {
    const seconds = secondsAtPointer(event);
    if (seconds === undefined) return;
    seek(seconds);
  };
  const pan = (direction: number) =>
    setTimelineStart(
      clampTimelineStart(visibleStart + direction * visibleDuration * 0.75)
    );
  const fitTimelineToScene = () => {
    if (!draft || duration <= 0) return;
    const sceneDuration = Math.max(draft.end - draft.start, Number.EPSILON);
    const nextZoom = Math.max(
      1,
      Math.min(MAX_ZOOM, Math.floor((duration / sceneDuration) * 100) / 100)
    );
    setZoom(nextZoom);
    centerTimelineOn((draft.start + draft.end) / 2, nextZoom);
  };
  const beginBoundaryDrag = (
    boundary: "start" | "end",
    event: React.PointerEvent<HTMLSpanElement>
  ) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(boundary);
  };
  const dragBoundary = (
    boundary: "start" | "end",
    event: React.PointerEvent<HTMLSpanElement>
  ) => {
    const seconds = secondsAtPointer(event);
    if (seconds !== undefined) moveBoundary(boundary, seconds, event.altKey);
  };
  const endBoundaryDrag = (
    event: React.PointerEvent<HTMLSpanElement>
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(undefined);
  };

  return (
    <div
      className="movie-timeline"
      title="Click to seek. Scroll to pan when zoomed; hold Shift and scroll up or down to zoom. Select a scene to edit it. Drag an edge to trim; hold Option or Alt while dragging to allow overlap."
    >
      <div className="movie-timeline-controls">
        <div className="movie-timeline-actions">
          <button
            type="button"
            className="movie-timeline-control"
            title="Previous scene boundary"
            aria-label="Previous scene boundary"
            disabled={previousBoundary === undefined}
            onClick={() => seek(previousBoundary ?? 0)}
          >
            <Icon icon={faStepBackward} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title="Next scene boundary"
            aria-label="Next scene boundary"
            disabled={nextBoundary === undefined}
            onClick={() => seek(nextBoundary ?? duration)}
          >
            <Icon icon={faStepForward} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title="Add virtual scene at player position"
            aria-label="Add virtual scene at player position"
            onClick={addScene}
          >
            <Icon icon={faPlus} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title="Seek to selected virtual scene"
            aria-label="Seek to selected virtual scene"
            disabled={!draft}
            onClick={preview}
          >
            <Icon icon={faLocationArrow} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title="Loop selected virtual scene"
            aria-label="Loop selected virtual scene"
            disabled={!draft}
            onClick={loopSelected}
          >
            <Icon icon={faRepeat} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title="Fit timeline to movie"
            aria-label="Fit timeline to movie"
            onClick={() => {
              setZoom(1);
              setTimelineStart(0);
            }}
          >
            <Icon icon={faCompressArrowsAlt} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title="Fit timeline to selected scene"
            aria-label="Fit timeline to selected scene"
            disabled={!draft}
            onClick={fitTimelineToScene}
          >
            <Icon icon={faExpandArrowsAlt} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title="Center timeline on player position"
            aria-label="Center timeline on player position"
            disabled={duration <= 0}
            onClick={() => centerTimelineOn(currentTime)}
          >
            <Icon icon={faCrosshairs} />
          </button>
          <button
            type="button"
            className="movie-timeline-control"
            title={generatingWaveform ? "Generating audio waveform" : "Generate or regenerate audio waveform"}
            aria-label="Generate or regenerate audio waveform"
            disabled={generatingWaveform}
            onClick={() => void generateWaveform()}
          >
            {generatingWaveform ? "…" : <Icon icon={faWaveSquare} />}
          </button>
        </div>
        <button
          type="button"
          className="movie-timeline-control"
          title="Pan timeline backward"
          aria-label="Pan timeline backward"
          onClick={() => pan(-1)}
        >
          ‹
        </button>
        <label>
          Zoom
          <input
            aria-label="Timeline zoom"
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              const visibleCenter = visibleStart + visibleDuration / 2;
              setZoom(nextZoom);
              centerTimelineOn(visibleCenter, nextZoom);
            }}
          />
          <span>{formatZoom(zoom)}x</span>
        </label>
        {waveformStatus && (
          <span className="movie-timeline-waveform-status">{waveformStatus}</span>
        )}
        <button
          type="button"
          className="movie-timeline-control"
          title="Pan timeline forward"
          aria-label="Pan timeline forward"
          onClick={() => pan(1)}
        >
          ›
        </button>
      </div>
      <div className="movie-timeline-ruler" aria-hidden="true">
        {timelineTicks.map((tick) => (
          <span key={tick} style={{ left: position(tick) }}>
            {formatTimelineTime(tick)}
          </span>
        ))}
      </div>
      <div
        ref={timelineRef}
        className="movie-timeline-track"
        onWheel={(event) => {
          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY;
          if (event.shiftKey) {
            event.preventDefault();
            if (event.deltaY === 0) return;
            const nextZoom = Math.max(
              1,
              Math.min(
                MAX_ZOOM,
                Math.round((zoom + Math.sign(event.deltaY) * SCROLL_ZOOM_STEP) * 100) / 100
              )
            );
            if (nextZoom === zoom) return;
            const visibleCenter = visibleStart + visibleDuration / 2;
            setZoom(nextZoom);
            centerTimelineOn(visibleCenter, nextZoom);
            return;
          }
          if (zoom <= 1) return;
          event.preventDefault();
          setTimelineStart(
            clampTimelineStart(visibleStart + (delta / 300) * visibleDuration)
          );
        }}
        onClick={(event) => {
          if (!dragging && !isHandleClick(event)) seekAtPointer(event);
        }}
      >
        {audioWaveform && (
          <img
            className="movie-timeline-waveform"
            src={audioWaveform}
            alt=""
            onLoad={() => setWaveformAvailable(true)}
            onError={() => setWaveformAvailable(false)}
            style={{
              width: `${(duration / Math.max(visibleDuration, 1)) * 100}%`,
              left: `${-(visibleStart / Math.max(visibleDuration, 1)) * 100}%`,
            }}
          />
        )}
        {timelineScenes.map((item, index) => {
          const start = item.start_seconds ?? 0;
          const end = item.end_seconds ?? start;
          if (!isVisible(start, end)) return null;
          const selected = selectedID === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`movie-timeline-scene ${selected ? "selected" : ""}`}
              style={{
                ...rangeStyle(start, end),
                backgroundColor: virtualSceneColor(index),
                opacity: selected ? 0.52 : 0.38,
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (isHandleClick(event)) return;
                selectScene(item);
                seekAtPointer(event);
              }}
              title={`${item.title || "Untitled virtual scene"}: ${start.toFixed(3)} - ${end.toFixed(3)}`}
            >
              {selected && draft && (
                <>
                  <span
                    className="movie-timeline-handle start"
                    role="slider"
                    aria-label="Virtual scene start"
                    tabIndex={0}
                    onPointerDown={(event) => beginBoundaryDrag("start", event)}
                    onPointerMove={(event) => dragBoundary("start", event)}
                    onPointerUp={endBoundaryDrag}
                    onPointerCancel={endBoundaryDrag}
                    onLostPointerCapture={() => setDragging(undefined)}
                  />
                  <span
                    className="movie-timeline-handle end"
                    role="slider"
                    aria-label="Virtual scene end"
                    tabIndex={0}
                    onPointerDown={(event) => beginBoundaryDrag("end", event)}
                    onPointerMove={(event) => dragBoundary("end", event)}
                    onPointerUp={endBoundaryDrag}
                    onPointerCancel={endBoundaryDrag}
                    onLostPointerCapture={() => setDragging(undefined)}
                  />
                </>
              )}
            </button>
          );
        })}
        {draft && !draft.id && isVisible(draft.start, draft.end) && (
          <div
            className="movie-timeline-draft"
            style={rangeStyle(draft.start, draft.end)}
          />
        )}
        {currentTime >= visibleStart && currentTime <= visibleEnd && (
          <div
            className="movie-timeline-playhead"
            style={{ left: position(currentTime) }}
          />
        )}
      </div>
    </div>
  );
};
