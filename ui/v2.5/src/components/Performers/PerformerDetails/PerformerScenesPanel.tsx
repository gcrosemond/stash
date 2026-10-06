import React from "react";
import * as GQL from "src/core/generated-graphql";
import { FilteredSceneList } from "src/components/Scenes/SceneList";
import { usePerformerFilterHook } from "src/core/performers";
import { View } from "src/components/List/views";
import { PatchComponent } from "src/patch";
import { movieFilter, normalSceneFilter } from "src/components/Scenes/sceneTypeFilters";
import { ListFilterModel } from "src/models/list-filter/filter";

interface IPerformerDetailsProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
  movies?: boolean;
}

export const PerformerScenesPanel: React.FC<IPerformerDetailsProps> =
  PatchComponent("PerformerScenesPanel", ({ active, performer, movies }) => {
    const performerFilterHook = usePerformerFilterHook(performer);
    const filterHook = (filter: ListFilterModel) =>
      (movies ? movieFilter : normalSceneFilter)(performerFilterHook(filter));
    return (
      <FilteredSceneList
        filterHook={filterHook}
        alterQuery={active}
        view={movies ? View.PerformerMovies : View.PerformerScenes}
      />
    );
  });
