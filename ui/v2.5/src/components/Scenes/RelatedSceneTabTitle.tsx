import React, { useMemo } from "react";
import * as GQL from "src/core/generated-graphql";
import { useFindScenes } from "src/core/StashService";
import { ListFilterModel } from "src/models/list-filter/filter";
import { TabTitleCounter } from "src/components/Shared/DetailsPage/Tabs";
import { movieFilter, normalSceneFilter } from "./sceneTypeFilters";

interface IProps {
  filterHook: (filter: ListFilterModel) => ListFilterModel;
  movies?: boolean;
  abbreviateCounter: boolean;
}

export const RelatedSceneTabTitle: React.FC<IProps> = ({
  filterHook,
  movies,
  abbreviateCounter,
}) => {
  const filter = useMemo(() => {
    const relatedFilter = filterHook(
      new ListFilterModel(GQL.FilterMode.Scenes)
    );
    relatedFilter.itemsPerPage = 1;
    return (movies ? movieFilter : normalSceneFilter)(relatedFilter);
  }, [filterHook, movies]);
  const result = useFindScenes(filter);

  return (
    <TabTitleCounter
      messageID={movies ? "movies" : "scenes"}
      count={result.data?.findScenes.count ?? 0}
      abbreviateCounter={abbreviateCounter}
    />
  );
};
