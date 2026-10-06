import React from "react";
import * as GQL from "src/core/generated-graphql";
import { FilteredSceneList } from "src/components/Scenes/SceneList";
import { useStudioFilterHook } from "src/core/studios";
import { View } from "src/components/List/views";
import { movieFilter, normalSceneFilter } from "src/components/Scenes/sceneTypeFilters";
import { ListFilterModel } from "src/models/list-filter/filter";

interface IStudioScenesPanel {
  active: boolean;
  studio: GQL.StudioDataFragment;
  showChildStudioContent?: boolean;
  movies?: boolean;
}

export const StudioScenesPanel: React.FC<IStudioScenesPanel> = ({
  active,
  studio,
  showChildStudioContent,
  movies,
}) => {
  const studioFilterHook = useStudioFilterHook(studio, showChildStudioContent);
  const filterHook = (filter: ListFilterModel) =>
    (movies ? movieFilter : normalSceneFilter)(studioFilterHook(filter));
  return (
    <FilteredSceneList
      filterHook={filterHook}
      alterQuery={active}
      view={movies ? View.StudioMovies : View.StudioScenes}
    />
  );
};
