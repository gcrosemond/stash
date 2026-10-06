import React, { useCallback, useContext, useMemo, useState } from "react";
import * as GQL from "src/core/generated-graphql";
import { getAbLoopPlugin } from "src/components/ScenePlayer/util";
import { useToast } from "src/hooks/Toast";
import { JobFragment, useMonitorJob } from "src/utils/job";

export type VirtualScene =
  GQL.FindVirtualScenesQuery["findScenes"]["scenes"][number];

type Boundary = "start" | "end";

type Draft = {
  id?: string;
  title: string;
  start: number;
  end: number;
  cover?: number;
};

interface IMovieEditorContext {
  movie: GQL.SceneDataFragment;
  audioWaveform?: string | null;
  waveformStatus: string;
  setWaveformAvailable: (available: boolean) => void;
  duration: number;
  scenes: VirtualScene[];
  timelineScenes: VirtualScene[];
  draft?: Draft;
  selectedID?: string;
  loading: boolean;
  saving: boolean;
  currentTime: number;
  selectScene: (scene: VirtualScene) => void;
  addScene: () => void;
  clearSelection: () => void;
  updateDraft: (update: Partial<Draft>) => void;
  moveBoundary: (
    boundary: Boundary,
    value: number,
    allowOverlap?: boolean
  ) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  preview: () => void;
  loopSelected: () => void;
  generateCover: () => Promise<void>;
  generateWaveform: () => Promise<void>;
  generatingWaveform: boolean;
  captureBoundary: (boundary: Boundary) => void;
  seek: (seconds: number) => void;
}

const MovieEditorContext = React.createContext<IMovieEditorContext | undefined>(
  undefined
);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export const MovieEditorProvider: React.FC<{
  movie: GQL.SceneDataFragment;
  currentTime: number;
  hasPlayerPosition: boolean;
  onRefresh: () => Promise<void>;
  onPreviewRange: (start: number, end?: number) => void;
  waveformJobID?: string;
  children: React.ReactNode;
}> = ({
  movie,
  currentTime,
  hasPlayerPosition,
  onRefresh,
  onPreviewRange,
  waveformJobID: initialWaveformJobID,
  children,
}) => {
  const Toast = useToast();
  const duration = movie.files[0]?.duration ?? 0;
  const query = GQL.useFindVirtualScenesQuery({
    variables: { source_movie_ids: [movie.id] },
  });
  const [createVirtualScene] = GQL.useVirtualSceneCreateMutation();
  const [updateVirtualScene] = GQL.useVirtualSceneUpdateMutation();
  const [destroyVirtualScene] = GQL.useVirtualSceneDestroyMutation();
  const [generateScreenshot] = GQL.useSceneGenerateScreenshotMutation();
  const [generateAudioWaveform] = GQL.useSceneGenerateAudioWaveformMutation();
  const [draft, setDraft] = useState<Draft>();
  const [linkedUpdates, setLinkedUpdates] = useState<
    Record<string, { start?: number; end?: number }>
  >({});
  const [saving, setSaving] = useState(false);
  const [coverJobID, setCoverJobID] = useState<string>();
  const [waveformJobID, setWaveformJobID] = useState<string | undefined>(
    initialWaveformJobID
  );
  const [waveformVersion, setWaveformVersion] = useState<number>();
  const [waveformStatus, setWaveformStatus] = useState(
    initialWaveformJobID
      ? "Audio waveform queued."
      : "Audio waveform unavailable."
  );

  const onCoverJobComplete = useCallback(
    async (job?: JobFragment) => {
      setCoverJobID(undefined);
      if (job?.status === GQL.JobStatus.Failed) {
        Toast.error(job.error);
        return;
      }
      if (job?.status === GQL.JobStatus.Cancelled) return;

      await query.refetch();
      await onRefresh();
    },
    [onRefresh, query, Toast]
  );
  useMonitorJob(coverJobID, onCoverJobComplete);
  const { job: waveformJob } = useMonitorJob(
    waveformJobID,
    async (job?: JobFragment) => {
      setWaveformJobID(undefined);
      if (job?.status === GQL.JobStatus.Failed) {
        setWaveformStatus("Audio waveform generation failed.");
        Toast.error(job.error);
        return;
      }
      if (job?.status !== GQL.JobStatus.Cancelled) {
        setWaveformVersion(Date.now());
        setWaveformStatus("Audio waveform generated; loading image.");
        Toast.success("Audio waveform generated.");
      }
    }
  );

  const scenes = useMemo(
    () =>
      [...(query.data?.findScenes.scenes ?? [])].sort(
        (a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0)
      ),
    [query.data]
  );
  const timelineScenes = useMemo(
    () =>
      scenes.map((item) => {
        const update = linkedUpdates[item.id];
        const scene = update
          ? {
              ...item,
              start_seconds: update.start ?? item.start_seconds,
              end_seconds: update.end ?? item.end_seconds,
            }
          : item;

        // Render the unsaved active range so trim handles move immediately.
        if (draft?.id === item.id) {
          return {
            ...scene,
            title: draft.title,
            start_seconds: draft.start,
            end_seconds: draft.end,
            cover_seconds: draft.cover,
          };
        }

        return scene;
      }),
    [draft, linkedUpdates, scenes]
  );

  const clearSelection = useCallback(() => {
    setDraft(undefined);
    setLinkedUpdates({});
  }, []);

  const selectScene = useCallback((item: VirtualScene) => {
    setLinkedUpdates({});
    setDraft({
      id: item.id,
      title: item.title ?? "",
      start: item.start_seconds ?? 0,
      end: item.end_seconds ?? 0,
      cover: item.cover_seconds ?? undefined,
    });
  }, []);

  const addScene = useCallback(() => {
    const lastSceneEnd = scenes.reduce(
      (lastEnd, item) => Math.max(lastEnd, item.end_seconds ?? 0),
      0
    );
    const start = clamp(
      hasPlayerPosition ? currentTime : lastSceneEnd,
      0,
      duration
    );
    setLinkedUpdates({});
    setDraft({
      title: "",
      start,
      end: Math.max(start, Math.min(duration, start + 60)),
      // Leave the cover unset until the user explicitly generates one from
      // the player. Default generation then uses the scene's 20% position.
      cover: undefined,
    });
  }, [currentTime, duration, hasPlayerPosition, scenes]);

  const updateDraft = useCallback((update: Partial<Draft>) => {
    setLinkedUpdates({});
    setDraft((current) => (current ? { ...current, ...update } : current));
  }, []);

  const moveBoundary = useCallback(
    (boundary: Boundary, requestedValue: number, allowOverlap = false) => {
      setDraft((current) => {
        if (!current) return current;
        const value = clamp(
          requestedValue,
          boundary === "start" ? 0 : current.start,
          boundary === "end" ? duration : current.end
        );
        const oldValue = boundary === "start" ? current.start : current.end;

        if (!allowOverlap && current.id) {
          const linked = timelineScenes.filter((item) => {
            if (item.id === current.id) return false;
            const sharedBoundary =
              boundary === "start" ? item.end_seconds : item.start_seconds;
            return Math.abs((sharedBoundary ?? 0) - oldValue) < 0.01;
          });
          if (linked.length) {
            setLinkedUpdates((updates) => {
              const next = { ...updates };
              linked.forEach((item) => {
                next[item.id] = {
                  ...next[item.id],
                  ...(boundary === "start" ? { end: value } : { start: value }),
                };
              });
              return next;
            });
          }
        }

        return {
          ...current,
          ...(boundary === "start" ? { start: value } : { end: value }),
        };
      });
    },
    [duration, timelineScenes]
  );

  const save = useCallback(async () => {
    if (!draft) return;
    if (!Number.isFinite(draft.start) || !Number.isFinite(draft.end)) {
      Toast.error("Start and end must be numbers.");
      return;
    }
    if (draft.start < 0 || draft.end <= draft.start || draft.end > duration) {
      Toast.error("Choose a valid range within the movie.");
      return;
    }
    if (
      draft.cover !== undefined &&
      (draft.cover < draft.start || draft.cover > draft.end)
    ) {
      Toast.error("Cover must be within the selected range.");
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await updateVirtualScene({
          variables: {
            input: {
              id: draft.id,
              start_seconds: draft.start,
              end_seconds: draft.end,
              cover_seconds: draft.cover,
              title: draft.title,
            },
          },
        });
        for (const [id, update] of Object.entries(linkedUpdates)) {
          const item = scenes.find((candidate) => candidate.id === id);
          if (!item) continue;
          await updateVirtualScene({
            variables: {
              input: {
                id,
                start_seconds: update.start ?? item.start_seconds ?? 0,
                end_seconds: update.end ?? item.end_seconds ?? 0,
                cover_seconds: item.cover_seconds ?? undefined,
                title: item.title ?? "",
              },
            },
          });
        }
      } else {
        await createVirtualScene({
          variables: {
            input: {
              source_scene_id: movie.id,
              start_seconds: draft.start,
              end_seconds: draft.end,
              cover_seconds: draft.cover,
              title: draft.title || undefined,
            },
          },
        });
      }
      await query.refetch();
      await onRefresh();
      clearSelection();
    } catch (error) {
      Toast.error(String(error));
    } finally {
      setSaving(false);
    }
  }, [
    clearSelection,
    createVirtualScene,
    draft,
    duration,
    linkedUpdates,
    movie.id,
    onRefresh,
    query,
    scenes,
    Toast,
    updateVirtualScene,
  ]);

  const remove = useCallback(async () => {
    if (!draft?.id || !window.confirm("Delete this virtual scene?")) return;
    setSaving(true);
    try {
      await destroyVirtualScene({ variables: { id: draft.id } });
      await query.refetch();
      await onRefresh();
      clearSelection();
    } catch (error) {
      Toast.error(String(error));
    } finally {
      setSaving(false);
    }
  }, [clearSelection, destroyVirtualScene, draft?.id, onRefresh, query, Toast]);

  const generateCover = useCallback(async () => {
    if (!draft?.id) {
      Toast.error("Save the virtual scene before generating its cover.");
      return;
    }

    const cover = clamp(currentTime, draft.start, draft.end);
    setSaving(true);
    try {
      await updateVirtualScene({
        variables: {
          input: {
            id: draft.id,
            start_seconds: draft.start,
            end_seconds: draft.end,
            cover_seconds: cover,
            title: draft.title,
          },
        },
      });
      const result = await generateScreenshot({ variables: { id: draft.id } });
      setDraft((current) => (current ? { ...current, cover } : current));
      setCoverJobID(result.data?.sceneGenerateScreenshot ?? undefined);
      Toast.success("Generating cover from the player position.");
    } catch (error) {
      Toast.error(String(error));
    } finally {
      setSaving(false);
    }
  }, [currentTime, draft, generateScreenshot, Toast, updateVirtualScene]);

  const generateWaveform = useCallback(async () => {
    try {
      const result = await generateAudioWaveform({
        variables: { id: movie.id, overwrite: true },
      });
      setWaveformJobID(result.data?.sceneGenerateAudioWaveform ?? undefined);
      Toast.success("Generating audio waveform.");
    } catch (error) {
      Toast.error(String(error));
    }
  }, [generateAudioWaveform, movie.id, Toast]);

  const value = useMemo<IMovieEditorContext>(
    () => ({
      movie,
      audioWaveform:
        movie.paths.audio_waveform && waveformVersion
          ? `${movie.paths.audio_waveform}?t=${waveformVersion}`
          : movie.paths.audio_waveform,
      waveformStatus: waveformJob
        ? "Generating audio waveform…"
        : waveformStatus,
      setWaveformAvailable: (available) =>
        setWaveformStatus(available ? "" : "Audio waveform unavailable."),
      duration,
      scenes,
      timelineScenes,
      draft,
      selectedID: draft?.id,
      loading: query.loading,
      saving,
      currentTime,
      selectScene,
      addScene,
      clearSelection,
      updateDraft,
      moveBoundary,
      save,
      remove,
      preview: () => draft && onPreviewRange(draft.start, draft.end),
      loopSelected: () => {
        if (!draft) return;
        const abLoopPlugin = getAbLoopPlugin();
        const options = abLoopPlugin?.getOptions();
        if (abLoopPlugin && options) {
          abLoopPlugin.setOptions({
            ...options,
            start: draft.start,
            end: draft.end,
            enabled: true,
          });
        }
        onPreviewRange(draft.start);
      },
      generateCover,
      generateWaveform,
      generatingWaveform: !!waveformJobID,
      captureBoundary: (boundary) => {
        setLinkedUpdates({});
        setDraft((current) => {
          if (!current) return current;
          const position = clamp(currentTime, 0, duration);
          return boundary === "start"
            ? {
                ...current,
                start: position,
                end: Math.max(position, current.end),
              }
            : {
                ...current,
                start: Math.min(current.start, position),
                end: position,
              };
        });
      },
      seek: (seconds) => onPreviewRange(clamp(seconds, 0, duration)),
    }),
    [
      addScene,
      clearSelection,
      currentTime,
      draft,
      duration,
      generateCover,
      generateWaveform,
      movie,
      moveBoundary,
      onPreviewRange,
      query.loading,
      remove,
      save,
      saving,
      scenes,
      selectScene,
      timelineScenes,
      updateDraft,
      waveformJob,
      waveformJobID,
      waveformStatus,
      waveformVersion,
    ]
  );

  return (
    <MovieEditorContext.Provider value={value}>
      {children}
    </MovieEditorContext.Provider>
  );
};

export const useMovieEditor = () => {
  const context = useContext(MovieEditorContext);
  if (!context) {
    throw new Error(
      "Movie editor components must be used within MovieEditorProvider"
    );
  }
  return context;
};
