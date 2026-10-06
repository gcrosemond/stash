import React, { useEffect, useState } from "react";
import { Button, Form, ListGroup } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import { faPlayCircle } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import TextUtils from "src/utils/text";
import { lazyComponent } from "src/utils/lazyComponent";
import { useMovieEditor } from "./MovieEditorContext";
import { virtualSceneColor } from "./virtualSceneColor";

const GenerateDialog = lazyComponent(
  () => import("../../Dialogs/GenerateDialog")
);

const formatSeconds = (value?: number | null) =>
  value == null ? "-" : TextUtils.secondsToTimestamp(value, true);

const parseTimestamp = (value: string) => {
  const seconds = TextUtils.timestampToSeconds(value.trim());
  return seconds !== null && Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : undefined;
};

const TimeInput: React.FC<{
  seconds: number;
  onCommit: (seconds: number) => void;
}> = ({ seconds, onCommit }) => {
  const [value, setValue] = useState(formatSeconds(seconds));

  useEffect(() => setValue(formatSeconds(seconds)), [seconds]);

  const commit = () => {
    const parsed = parseTimestamp(value);
    if (parsed === undefined) {
      setValue(formatSeconds(seconds));
      return;
    }
    onCommit(parsed);
  };

  return (
    <Form.Control
      type="text"
      inputMode="decimal"
      value={value}
      title="Use seconds, MM:SS, or HH:MM:SS.mmm"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
};

export const MovieScenesPanel: React.FC = () => {
  const history = useHistory();
  const [selectedSceneIDs, setSelectedSceneIDs] = useState<Set<string>>(
    new Set()
  );
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const {
    scenes,
    draft,
    selectedID,
    loading,
    saving,
    selectScene,
    addScene,
    clearSelection,
    updateDraft,
    moveBoundary,
    save,
    remove,
    preview,
    generateCover,
    captureBoundary,
  } = useMovieEditor();

  useEffect(() => {
    const available = new Set(scenes.map((scene) => scene.id));
    setSelectedSceneIDs((selected) => {
      const next = new Set(
        [...selected].filter((sceneID) => available.has(sceneID))
      );
      return next.size === selected.size ? selected : next;
    });
  }, [scenes]);

  const toggleSelected = (sceneID: string) => {
    setSelectedSceneIDs((selected) => {
      const next = new Set(selected);
      if (next.has(sceneID)) next.delete(sceneID);
      else next.add(sceneID);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedSceneIDs((selected) =>
      selected.size === scenes.length
        ? new Set()
        : new Set(scenes.map((scene) => scene.id))
    );
  };

  if (loading)
    return <div className="p-3 text-muted">Loading virtual scenes...</div>;

  return (
    <div className="movie-scenes-panel">
      <div className="p-2 d-flex justify-content-between align-items-center">
        <strong>Virtual scenes</strong>
        <div className="d-flex align-items-center">
          {!!scenes.length && (
            <Form.Check
              className="mr-2 mb-0 movie-scenes-select-all"
              id="movie-scenes-select-all"
              label="Select all"
              checked={selectedSceneIDs.size === scenes.length}
              onChange={toggleAll}
            />
          )}
          <Button
            className="mr-2"
            size="sm"
            variant="primary"
            disabled={!selectedSceneIDs.size}
            onClick={() => setIsGenerateDialogOpen(true)}
          >
            Generate
            {selectedSceneIDs.size ? ` (${selectedSceneIDs.size})` : ""}
          </Button>
          <Button size="sm" onClick={addScene}>
            Add scene
          </Button>
        </div>
      </div>
      <ListGroup variant="flush">
        {scenes.map((item, index) => (
          <ListGroup.Item
            key={item.id}
            action
            active={selectedID === item.id}
            className="movie-scene-list-item"
            style={{ borderLeftColor: virtualSceneColor(index) }}
            onClick={() => selectScene(item)}
          >
            <div className="d-flex align-items-center">
              <Form.Check
                className="mr-2 movie-scene-select"
                checked={selectedSceneIDs.has(item.id)}
                aria-label={`Select ${item.title || `virtual scene ${index + 1}`}`}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleSelected(item.id)}
              />
              {item.paths.screenshot ? (
                <img
                  className="movie-scene-cover mr-2"
                  src={item.paths.screenshot}
                  alt=""
                />
              ) : (
                <div className="movie-scene-cover movie-scene-cover-placeholder mr-2" />
              )}
              <div className="text-truncate">
                <div className="font-weight-bold text-truncate">
                  {index + 1}. {item.title || "Untitled virtual scene"}
                </div>
                <small>
                  {formatSeconds(item.start_seconds)} -{" "}
                  {formatSeconds(item.end_seconds)}
                </small>
              </div>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
      {!scenes.length && !draft && (
        <div className="p-3 text-muted">
          Add a virtual scene to begin cutting this movie.
        </div>
      )}
      {draft && (
        <Form
          className="movie-scene-inspector p-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Form.Group>
            <Form.Label>Title</Form.Label>
            <div className="d-flex align-items-center">
              <Form.Control
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                placeholder="Optional"
              />
              <Button
                className="minimal ml-2"
                type="button"
                disabled={!draft.id}
                title={
                  draft.id
                    ? "Open virtual scene"
                    : "Create the virtual scene before opening it"
                }
                onClick={() => draft.id && history.push(`/scenes/${draft.id}`)}
              >
                <Icon icon={faPlayCircle} />
              </Button>
            </div>
          </Form.Group>
          <div className="d-flex">
            <Form.Group className="mr-2 flex-fill">
              <Form.Label>Start</Form.Label>
              <TimeInput
                seconds={draft.start}
                onCommit={(seconds) => moveBoundary("start", seconds)}
              />
              <Button
                className="mt-1"
                size="sm"
                type="button"
                variant="outline-secondary"
                onClick={() => captureBoundary("start")}
              >
                Use player position
              </Button>
            </Form.Group>
            <Form.Group className="flex-fill">
              <Form.Label>End</Form.Label>
              <TimeInput
                seconds={draft.end}
                onCommit={(seconds) => moveBoundary("end", seconds)}
              />
              <Button
                className="mt-1"
                size="sm"
                type="button"
                variant="outline-secondary"
                onClick={() => captureBoundary("end")}
              >
                Use player position
              </Button>
            </Form.Group>
          </div>
          <Form.Group>
            <Form.Label>Cover</Form.Label>
            <div className="movie-scene-cover-preview">
              {draft.id &&
              scenes.find((item) => item.id === draft.id)?.paths.screenshot ? (
                <img
                  src={
                    scenes.find((item) => item.id === draft.id)?.paths
                      .screenshot ?? ""
                  }
                  alt="Selected virtual scene cover"
                />
              ) : (
                <div className="movie-scene-cover-placeholder">
                  Cover will be generated from the selected position.
                </div>
              )}
            </div>
            <Button
              className="mt-2"
              size="sm"
              type="button"
              variant="outline-secondary"
              disabled={!draft.id || saving}
              title={
                draft.id
                  ? undefined
                  : "Save the virtual scene before generating its cover."
              }
              onClick={() => void generateCover()}
            >
              Generate cover at player position
            </Button>
          </Form.Group>
          <div className="d-flex flex-wrap">
            <Button
              className="mr-2 mb-2"
              size="sm"
              type="button"
              variant="outline-secondary"
              onClick={preview}
            >
              Preview
            </Button>
            <Button
              className="mr-2 mb-2"
              size="sm"
              type="button"
              variant="outline-secondary"
              onClick={clearSelection}
            >
              Cancel
            </Button>
            {draft.id && (
              <Button
                className="mr-2 mb-2"
                size="sm"
                type="button"
                variant="outline-danger"
                disabled={saving}
                onClick={() => void remove()}
              >
                Delete
              </Button>
            )}
            <Button className="mb-2" size="sm" type="submit" disabled={saving}>
              {draft.id ? "Save" : "Create"}
            </Button>
          </div>
        </Form>
      )}
      {isGenerateDialogOpen && (
        <GenerateDialog
          type="scene"
          selectedIds={[...selectedSceneIDs]}
          onClose={() => setIsGenerateDialogOpen(false)}
        />
      )}
    </div>
  );
};
