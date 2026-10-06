import React from "react";
import { FormattedMessage, FormattedTime, useIntl } from "react-intl";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import { useFindScene } from "src/core/StashService";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { FileSize } from "src/components/Shared/FileSize";
import { RevealInFilesystemButton } from "src/components/Shared/RevealInFilesystemButton";
import { TruncatedText } from "src/components/Shared/TruncatedText";
import { TextField } from "src/utils/field";
import { objectTitle } from "src/core/files";
import TextUtils from "src/utils/text";

interface IMovieInfoPanelProps {
  scene: GQL.SceneDataFragment;
}

const MovieInfoPanel: React.FC<IMovieInfoPanelProps> = ({ scene }) => {
  const intl = useIntl();
  const sourceSceneID = scene.source_scene_id ?? "";
  const { data, loading } = useFindScene(sourceSceneID);

  if (loading) {
    return <LoadingIndicator />;
  }

  const movie = data?.findScene;
  if (!movie) {
    return <p className="container">The source movie is no longer available.</p>;
  }

  const primaryFile = movie.files[0];
  const range = `${TextUtils.secondsToTimestamp(
    scene.start_seconds ?? 0
  )} - ${TextUtils.secondsToTimestamp(scene.end_seconds ?? 0)}`;
  const dimensions =
    primaryFile?.width && primaryFile.height
      ? `${primaryFile.width} x ${primaryFile.height}`
      : undefined;

  return (
    <dl className="container scene-file-info details-list">
      <TextField name="Movie">
        <Link to={`/scenes/${movie.id}`}>{objectTitle(movie)}</Link>
      </TextField>
      {primaryFile?.duration && (
        <TextField
          id="duration"
          value={TextUtils.secondsToTimestamp(primaryFile.duration)}
        />
      )}
      {primaryFile && (
        <>
          <TextField id="path">
            <span className="d-flex align-items-center">
              <TruncatedText text={primaryFile.path} />
              <RevealInFilesystemButton fileId={primaryFile.id} />
            </span>
          </TextField>
          <TextField id="filesize">
            <span className="text-truncate">
              <FileSize size={primaryFile.size} />
            </span>
          </TextField>
          <TextField id="file_mod_time">
            <FormattedTime
              dateStyle="medium"
              timeStyle="medium"
              value={primaryFile.mod_time ?? 0}
            />
          </TextField>
          <TextField id="framerate">
            <FormattedMessage
              id="frames_per_second"
              values={{ value: intl.formatNumber(primaryFile.frame_rate ?? 0) }}
            />
          </TextField>
          <TextField id="bitrate">
            <FormattedMessage
              id="megabits_per_second"
              values={{
                value: intl.formatNumber((primaryFile.bit_rate ?? 0) / 1000000, {
                  maximumFractionDigits: 2,
                }),
              }}
            />
          </TextField>
          <TextField
            id="media_info.video_codec"
            value={primaryFile.video_codec ?? ""}
            truncate
          />
          <TextField
            id="media_info.audio_codec"
            value={primaryFile.audio_codec ?? ""}
            truncate
          />
        </>
      )}
      <TextField id="dimensions" value={dimensions} />
      <TextField name="Virtual scene range" value={range} />
    </dl>
  );
};

export default MovieInfoPanel;
