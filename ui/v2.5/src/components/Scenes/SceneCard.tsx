import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Button, ButtonGroup, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link, useHistory } from "react-router-dom";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import {
  GalleryLink,
  TagLink,
  SceneLink,
  SceneMarkerLink,
} from "../Shared/TagLink";
import { HoverPopover } from "../Shared/HoverPopover";
import { TruncatedText } from "../Shared/TruncatedText";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { SceneQueue } from "src/models/sceneQueue";
import { useConfigurationContext } from "src/hooks/Config";
import { PerformerPopoverButton } from "../Shared/PerformerPopoverButton";
import { GridCard } from "../Shared/GridCard/GridCard";
import { RatingBanner } from "../Shared/RatingBanner";
import { FormattedMessage } from "react-intl";
import {
  faBox,
  faCopy,
  faFilm,
  faImages,
  faMapMarkerAlt,
  faPlayCircle,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { objectPath, objectTitle } from "src/core/files";
import { PreviewScrubber } from "./PreviewScrubber";
import { PatchComponent } from "src/patch";
import { StudioOverlay } from "../Shared/GridCard/StudioOverlay";
import { GroupTag } from "../Groups/GroupTag";
import { FileSize } from "../Shared/FileSize";
import { OCounterButton } from "../Shared/CountButton";
import { defaultPreviewVolume } from "src/core/config";

interface IScenePreviewProps {
  isPortrait: boolean;
  image?: string;
  video?: string;
  soundActive: boolean;
  volume?: number;
  vttPath?: string;
  onScrubberClick?: (timestamp: number) => void;
  disabled?: boolean;
}

export const ScenePreview: React.FC<IScenePreviewProps> = React.memo(
  ({
    image,
    video,
    isPortrait,
    soundActive,
    vttPath,
    onScrubberClick,
    disabled,
    volume,
  }) => {
    const videoEl = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0)
            // Catch is necessary due to DOMException if user hovers before clicking on page
            videoEl.current?.play()?.catch(() => {});
          else videoEl.current?.pause();
        });
      });

      if (videoEl.current) observer.observe(videoEl.current);

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (videoEl?.current?.volume)
        videoEl.current.volume = soundActive ? (volume ?? 0) / 100 : 0;
    }, [volume, soundActive]);

    return (
      <div className={cx("scene-card-preview", { portrait: isPortrait })}>
        <img
          className="scene-card-preview-image"
          loading="lazy"
          src={image}
          alt=""
        />
        <video
          disableRemotePlayback
          playsInline
          muted={!soundActive}
          className="scene-card-preview-video"
          loop
          preload="none"
          ref={videoEl}
          src={video}
        />
        <PreviewScrubber
          vttPath={vttPath}
          onClick={onScrubberClick}
          disabled={disabled}
        />
      </div>
    );
  }
);

interface ISceneCardProps {
  scene: GQL.SlimSceneDataFragment;
  width?: number;
  previewHeight?: number;
  index?: number;
  queue?: SceneQueue;
  compact?: boolean;
  selecting?: boolean;
  selected?: boolean | undefined;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  fromGroupId?: string;
  virtualScenes?: GQL.VirtualSceneDataFragment[];
}

const Description: React.FC<{
  sceneNumber?: number;
}> = ({ sceneNumber }) => {
  if (!sceneNumber) return null;

  return (
    <>
      <hr />
      {sceneNumber !== undefined && (
        <span className="scene-group-scene-number">
          <FormattedMessage id="scene" /> #{sceneNumber}
        </span>
      )}
    </>
  );
};

const SceneCardPopovers = React.memo(
  PatchComponent("SceneCard.Popovers", (props: ISceneCardProps) => {
    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    const sceneNumber = useMemo(() => {
      if (!props.fromGroupId) {
        return undefined;
      }

      const group = props.scene.groups.find(
        (g) => g.group.id === props.fromGroupId
      );
      return group?.scene_index ?? undefined;
    }, [props.fromGroupId, props.scene.groups]);

    function maybeRenderTagPopoverButton() {
      if (props.scene.tags.length <= 0) return;

      const popoverContent = props.scene.tags.map((tag) => (
        <TagLink key={tag.id} tag={tag} />
      ));

      return (
        <HoverPopover
          className="tag-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faTag} />
            <span>{props.scene.tags.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderPerformerPopoverButton() {
      if (props.scene.performers.length <= 0) return;

      return (
        <PerformerPopoverButton
          performers={props.scene.performers}
          linkType="scene"
        />
      );
    }

    function maybeRenderGroupPopoverButton() {
      if (props.scene.groups.length <= 0) return;

      const popoverContent = props.scene.groups.map((sceneGroup) => (
        <GroupTag key={sceneGroup.group.id} group={sceneGroup.group} />
      ));

      return (
        <HoverPopover
          placement="bottom"
          content={popoverContent}
          className="group-count tag-tooltip"
        >
          <Button className="minimal">
            <Icon icon={faFilm} />
            <span>{props.scene.groups.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderVirtualSceneCount() {
      if (
        props.scene.type !== GQL.SceneType.Movie ||
        !props.virtualScenes?.length
      )
        return;

      const popoverContent = props.virtualScenes.map((scene) => (
        <div className="scene-tag-container row" key={scene.id}>
          {scene.paths.screenshot && (
            <Link
              to={`/scenes/${scene.id}`}
              className="scene-tag col m-auto zoom-2"
            >
              <img
                className="image-thumbnail"
                loading="lazy"
                alt={scene.title ?? ""}
                src={scene.paths.screenshot}
              />
            </Link>
          )}
          <SceneLink scene={scene} className="d-block" />
        </div>
      ));

      return (
        <HoverPopover
          placement="bottom"
          content={popoverContent}
          className="virtual-scene-count tag-tooltip"
        >
          <Button className="minimal">
            <Icon icon={faPlayCircle} />
            <span>{props.virtualScenes.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderSceneMarkerPopoverButton() {
      if (props.scene.scene_markers.length <= 0) return;

      const popoverContent = props.scene.scene_markers.map((marker) => {
        const markerWithScene = { ...marker, scene: { id: props.scene.id } };
        return <SceneMarkerLink key={marker.id} marker={markerWithScene} />;
      });

      return (
        <HoverPopover
          className="marker-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faMapMarkerAlt} />
            <span>{props.scene.scene_markers.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOCounter() {
      if (props.scene.o_counter) {
        return <OCounterButton value={props.scene.o_counter} />;
      }
    }

    function maybeRenderGallery() {
      if (props.scene.galleries.length <= 0) return;

      const popoverContent = props.scene.galleries.map((gallery) => (
        <GalleryLink key={gallery.id} gallery={gallery} />
      ));

      return (
        <HoverPopover
          className="gallery-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faImages} />
            <span>{props.scene.galleries.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOrganized() {
      if (props.scene.organized) {
        return (
          <OverlayTrigger
            overlay={<Tooltip id="organised-tooltip">{"Organized"}</Tooltip>}
            placement="bottom"
          >
            <div className="organized">
              <Button className="minimal">
                <Icon icon={faBox} />
              </Button>
            </div>
          </OverlayTrigger>
        );
      }
    }

    function maybeRenderDupeCopies() {
      const phash = file
        ? file.fingerprints.find((fp) => fp.type === "phash")
        : undefined;

      if (phash) {
        return (
          <div className="other-copies extra-scene-info">
            <Button
              href={NavUtils.makeScenesPHashMatchUrl(phash.value)}
              className="minimal"
            >
              <Icon icon={faCopy} />
            </Button>
          </div>
        );
      }
    }

    function maybeRenderPopoverButtonGroup() {
      if (
        !props.compact &&
        (props.scene.tags.length > 0 ||
          props.scene.performers.length > 0 ||
          props.scene.groups.length > 0 ||
          props.virtualScenes?.length ||
          props.scene.scene_markers.length > 0 ||
          props.scene?.o_counter ||
          props.scene.galleries.length > 0 ||
          props.scene.organized ||
          sceneNumber !== undefined)
      ) {
        return (
          <>
            <Description sceneNumber={sceneNumber} />
            <hr />
            <ButtonGroup className="card-popovers">
              {maybeRenderTagPopoverButton()}
              {maybeRenderPerformerPopoverButton()}
              {maybeRenderGroupPopoverButton()}
              {maybeRenderVirtualSceneCount()}
              {maybeRenderSceneMarkerPopoverButton()}
              {maybeRenderOCounter()}
              {maybeRenderGallery()}
              {maybeRenderOrganized()}
              {maybeRenderDupeCopies()}
            </ButtonGroup>
          </>
        );
      }
    }

    return <>{maybeRenderPopoverButtonGroup()}</>;
  })
);

const SceneCardDetails = React.memo(
  PatchComponent("SceneCard.Details", (props: ISceneCardProps) => {
    const virtualRange =
      props.scene.type === GQL.SceneType.Virtual &&
      props.scene.start_seconds != null &&
      props.scene.end_seconds != null
        ? `${TextUtils.secondsToTimestamp(props.scene.start_seconds)} - ${TextUtils.secondsToTimestamp(props.scene.end_seconds)}`
        : undefined;

    return (
      <div className="scene-card__details">
        <span className="scene-card__date">{props.scene.date}</span>
        {virtualRange && (
          <span className="extra-scene-info">
            {props.scene.source_scene ? (
              <a href={`/scenes/${props.scene.source_scene.id}`}>
                {props.scene.source_scene.title ?? "Movie"}
              </a>
            ) : (
              "Virtual scene"
            )}{" "}
            ({virtualRange})
          </span>
        )}
        <span className="file-path extra-scene-info">
          {objectPath(props.scene)}
        </span>
        <TruncatedText
          className="scene-card__description"
          text={props.scene.details}
          lineCount={3}
        />
      </div>
    );
  })
);

const SceneCardOverlays = React.memo(
  PatchComponent("SceneCard.Overlays", (props: ISceneCardProps) => {
    const ret = useMemo(() => {
      return (
        <StudioOverlay studio={props.scene.studio} disabled={props.selecting} />
      );
    }, [props.scene.studio, props.selecting]);

    return ret;
  })
);

interface ISceneSpecsOverlay {
  scene: GQL.SlimSceneDataFragment;
}

export const SceneSpecsOverlay: React.FC<ISceneSpecsOverlay> = React.memo(
  PatchComponent("SceneCard.SceneSpecs", ({ scene }) => {
    const file = scene.files?.[0];
    if (!file) return null;
    return (
      <div className="scene-specs-overlay">
        <span className="overlay-filesize extra-scene-info">
          <FileSize size={file.size} />
        </span>
        {file.width && file.height ? (
          <span className="overlay-resolution">
            {TextUtils.resolution(file.width, file.height)}
          </span>
        ) : (
          ""
        )}
        {file.duration > 0 ? (
          <span className="overlay-duration">
            {TextUtils.secondsToTimestamp(file.duration)}
          </span>
        ) : (
          ""
        )}
      </div>
    );
  })
);

const VirtualSceneOverlay: React.FC<{ scene: GQL.SlimSceneDataFragment }> = ({
  scene,
}) => {
  if (scene.type !== GQL.SceneType.Virtual) return null;

  return (
    <span
      className="virtual-scene-overlay"
      title="Virtual scene"
      aria-label="Virtual scene"
    >
      V
    </span>
  );
};

const SceneCardImage = React.memo(
  PatchComponent("SceneCard.Image", (props: ISceneCardProps) => {
    const history = useHistory();
    const { configuration } = useConfigurationContext();
    const cont = configuration?.interface.continuePlaylistDefault ?? false;

    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    function maybeRenderInteractiveSpeedOverlay() {
      return (
        <div className="scene-interactive-speed-overlay">
          {props.scene.interactive_speed ?? ""}
        </div>
      );
    }

    const onScrubberClick = useCallback(
      (timestamp: number) => {
        if (props.selecting) return;
        const link = props.queue
          ? props.queue.makeLink(props.scene.id, {
              sceneIndex: props.index,
              continue: cont,
              start: timestamp,
            })
          : `/scenes/${props.scene.id}?t=${timestamp}`;

        history.push(link);
      },
      [props.selecting, props.queue, props.scene.id, props.index, cont, history]
    );

    function isPortrait() {
      const width = file?.width ? file.width : 0;
      const height = file?.height ? file.height : 0;
      return height > width;
    }

    return (
      <>
        <ScenePreview
          image={props.scene.paths.screenshot ?? undefined}
          video={props.scene.paths.preview ?? undefined}
          isPortrait={isPortrait()}
          soundActive={configuration?.interface?.soundOnPreview ?? false}
          volume={configuration?.ui.previewVolume ?? defaultPreviewVolume}
          vttPath={props.scene.paths.vtt ?? undefined}
          onScrubberClick={onScrubberClick}
          disabled={props.selecting}
        />
        <RatingBanner rating={props.scene.rating100} />
        <SceneSpecsOverlay scene={props.scene} />
        <VirtualSceneOverlay scene={props.scene} />
        {maybeRenderInteractiveSpeedOverlay()}
      </>
    );
  })
);

export const SceneCard = React.memo(
  PatchComponent("SceneCard", (props: ISceneCardProps) => {
    const { configuration } = useConfigurationContext();

    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    function zoomIndex() {
      if (!props.compact && props.zoomIndex !== undefined) {
        return `zoom-${props.zoomIndex}`;
      }

      return "";
    }

    function filelessClass() {
      if (!props.scene.files.length) {
        return "fileless";
      }

      return "";
    }

    const cont = configuration?.interface.continuePlaylistDefault ?? false;

    const sceneLink = props.queue
      ? props.queue.makeLink(props.scene.id, {
          sceneIndex: props.index,
          continue: cont,
        })
      : `/scenes/${props.scene.id}`;

    return (
      <GridCard
        className={`scene-card ${zoomIndex()} ${filelessClass()}`}
        url={sceneLink}
        title={objectTitle(props.scene)}
        width={props.width}
        linkClassName="scene-card-link"
        thumbnailSectionClassName="video-section"
        resumeTime={props.scene.resume_time ?? undefined}
        duration={file?.duration ?? undefined}
        interactiveHeatmap={
          props.scene.interactive_speed
            ? (props.scene.paths.interactive_heatmap ?? undefined)
            : undefined
        }
        image={<SceneCardImage {...props} />}
        overlays={<SceneCardOverlays {...props} />}
        details={<SceneCardDetails {...props} />}
        popovers={<SceneCardPopovers {...props} />}
        selected={props.selected}
        selecting={props.selecting}
        onSelectedChanged={props.onSelectedChanged}
      />
    );
  })
);
