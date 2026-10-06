import React from "react";
import * as GQL from "src/core/generated-graphql";
import { SceneCard } from "src/components/Scenes/SceneCard";

interface IGalleryScenesPanelProps {
  scenes: GQL.SlimSceneDataFragment[];
  movies?: boolean;
}

export const GalleryScenesPanel: React.FC<IGalleryScenesPanelProps> = ({
  scenes,
  movies,
}) => {
  const filteredScenes = scenes.filter((scene) =>
    movies ? scene.type === GQL.SceneType.Movie : scene.type !== GQL.SceneType.Movie
  );

  return (
    <div className="container gallery-scenes">
      {filteredScenes.map((scene) => (
        <SceneCard scene={scene} key={scene.id} />
      ))}
    </div>
  );
};
