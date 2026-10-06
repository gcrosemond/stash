import React from "react";
import { Link } from "react-router-dom";
import TextUtils from "src/utils/text";
import { useMovieEditor } from "./MovieEditorContext";

const formatSeconds = (value?: number | null) =>
  value == null ? "-" : TextUtils.secondsToTimestamp(value, true);

export const MovieDetailScenes: React.FC = () => {
  const { scenes, loading } = useMovieEditor();

  if (loading || scenes.length === 0) return null;

  return (
    <section className="movie-detail-scenes">
      <h6>Virtual scenes</h6>
      <div className="movie-detail-scene-list">
        {scenes.map((scene, index) => (
          <Link
            key={scene.id}
            className="movie-detail-scene"
            to={`/scenes/${scene.id}`}
          >
            {scene.paths.screenshot ? (
              <img src={scene.paths.screenshot} alt="" />
            ) : (
              <div className="movie-detail-scene-placeholder" />
            )}
            <span className="movie-detail-scene-copy">
              <strong>
                {index + 1}. {scene.title || "Untitled virtual scene"}
              </strong>
              <small>
                {formatSeconds(scene.start_seconds)} -{" "}
                {formatSeconds(scene.end_seconds)}
              </small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};
