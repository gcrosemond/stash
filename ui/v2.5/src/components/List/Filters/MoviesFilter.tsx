import React, { ReactNode, useMemo } from "react";
import { FormattedMessage } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { objectTitle } from "src/core/files";
import {
  SourceMoviesCriterion,
  SourceMoviesCriterionOption,
} from "src/models/list-filter/criteria/source-movies";
import { CriterionOption } from "src/models/list-filter/criteria/criterion";
import { ListFilterModel } from "src/models/list-filter/filter";
import { ILoadResults } from "src/hooks/data";
import { IUseQueryHookProps, useLabeledIdFilterState } from "./LabeledIdFilter";
import { ObjectsFilter } from "./SelectableFilter";
import { SidebarListFilter } from "./SidebarListFilter";

function useMovieSearch(
  q: string,
  skip = false
): ILoadResults<{ id: string; label: string }[]> {
  const { data, loading } = GQL.useFindScenesForSelectQuery({
    variables: {
      filter: { q, per_page: 200 },
      scene_filter: { type: GQL.SceneType.Movie },
    },
    skip: skip || q === "",
  });

  const results = useMemo(
    () =>
      (data?.findScenes.scenes ?? []).map((movie) => ({
        id: movie.id,
        label: objectTitle(movie),
      })),
    [data]
  );

  return { results, loading };
}

function useMovieQuery({ q, skip }: IUseQueryHookProps) {
  return useMovieSearch(q, skip);
}

const MoviesFilter: React.FC<{
  criterion: SourceMoviesCriterion;
  setCriterion: (criterion: SourceMoviesCriterion) => void;
}> = ({ criterion, setCriterion }) => (
  <ObjectsFilter
    criterion={criterion}
    setCriterion={setCriterion}
    useResults={useMovieSearch}
    singleValue
  />
);

export const SidebarMoviesFilter: React.FC<{
  title?: ReactNode;
  option?: CriterionOption;
  filter: ListFilterModel;
  setFilter: (filter: ListFilterModel) => void;
  sectionID?: string;
}> = ({
  title = <FormattedMessage id="movies" />,
  option = SourceMoviesCriterionOption,
  filter,
  setFilter,
  sectionID = "source_movies",
}) => {
  const state = useLabeledIdFilterState({
    filter,
    setFilter,
    option,
    useQuery: useMovieQuery,
    singleValue: true,
  });

  return (
    <SidebarListFilter
      {...state}
      data-type={option.type}
      title={title}
      sectionID={sectionID}
    />
  );
};

export default MoviesFilter;
