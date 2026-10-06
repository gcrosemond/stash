import { SceneType } from "src/core/generated-graphql";
import { ListFilterModel } from "src/models/list-filter/filter";
import { View } from "../List/views";

export const normalSceneFilter = (filter: ListFilterModel) => {
  const makeFilter = filter.makeFilter.bind(filter);
  filter.makeFilter = () => {
    const sceneFilter = makeFilter();
    if (sceneFilter.type) return sceneFilter;

    return {
      ...sceneFilter,
      type: SceneType.Normal,
      OR: {
        ...sceneFilter,
        type: SceneType.Virtual,
      },
    };
  };
  return filter;
};

export const movieFilter = (filter: ListFilterModel) => {
  const makeFilter = filter.makeFilter.bind(filter);
  filter.makeFilter = () => ({
    ...makeFilter(),
    type: SceneType.Movie,
  });
  return filter;
};

export const virtualSceneFilter = (filter: ListFilterModel) => {
  const makeFilter = filter.makeFilter.bind(filter);
  filter.makeFilter = () => ({
    ...makeFilter(),
    type: SceneType.Virtual,
  });
  return filter;
};

export const isMovieSceneView = (view?: View) =>
  [
    View.Movies,
    View.PerformerMovies,
    View.StudioMovies,
    View.GroupMovies,
    View.TagMovies,
  ].includes(view as View);
