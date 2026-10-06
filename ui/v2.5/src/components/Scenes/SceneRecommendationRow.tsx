import React, { useMemo } from "react";
import { useFindScenes } from "src/core/StashService";
import { SceneCard } from "./SceneCard";
import { SceneQueue } from "src/models/sceneQueue";
import { ListFilterModel } from "src/models/list-filter/filter";
import { PatchComponent } from "src/patch";
import { FilteredRecommendationRow } from "../FrontPage/FilteredRecommendationRow";
import { normalSceneFilter } from "./sceneTypeFilters";

interface IProps {
  isTouch: boolean;
  filter: ListFilterModel;
  header: string;
}

export const SceneRecommendationRow: React.FC<IProps> = PatchComponent(
  "SceneRecommendationRow",
  (props) => {
    const filter = useMemo(
      () => normalSceneFilter(props.filter.clone()),
      [props.filter]
    );
    const result = useFindScenes(filter);
    const count = result.data?.findScenes.count ?? 0;

    const queue = useMemo(() => {
      return SceneQueue.fromListFilterModel(filter);
    }, [filter]);

    return (
      <FilteredRecommendationRow
        className="scene-recommendations"
        heading={props.header}
        url={`/scenes?${filter.makeQueryParameters()}`}
        count={count}
        loading={result.loading}
        isTouch={props.isTouch}
        filter={filter}
      >
        {result.loading
          ? [...Array(filter.itemsPerPage)].map((i) => (
              <div key={`_${i}`} className="scene-skeleton skeleton-card"></div>
            ))
          : result.data?.findScenes.scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                queue={queue}
                index={index}
                zoomIndex={1}
              />
            ))}
      </FilteredRecommendationRow>
    );
  }
);
