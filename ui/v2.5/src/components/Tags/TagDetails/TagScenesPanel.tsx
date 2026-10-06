import React from "react";
import * as GQL from "src/core/generated-graphql";
import { FilteredSceneList } from "src/components/Scenes/SceneList";
import { useTagFilterHook } from "src/core/tags";
import { View } from "src/components/List/views";
import { movieFilter, normalSceneFilter } from "src/components/Scenes/sceneTypeFilters";
import { ListFilterModel } from "src/models/list-filter/filter";

interface ITagScenesPanel {
  active: boolean;
  tag: GQL.TagDataFragment;
  showSubTagContent?: boolean;
  movies?: boolean;
}

export const TagScenesPanel: React.FC<ITagScenesPanel> = ({
  active,
  tag,
  showSubTagContent,
  movies,
}) => {
  const tagFilterHook = useTagFilterHook(tag, showSubTagContent);
  const filterHook = (filter: ListFilterModel) =>
    (movies ? movieFilter : normalSceneFilter)(tagFilterHook(filter));
  return (
    <FilteredSceneList
      filterHook={filterHook}
      alterQuery={active}
      view={movies ? View.TagMovies : View.TagScenes}
    />
  );
};
