import React from "react";
import { Route, Switch } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useTitleProps } from "src/hooks/title";
import { lazyComponent } from "src/utils/lazyComponent";
import { View } from "../List/views";
import {
  movieFilter,
  normalSceneFilter,
  virtualSceneFilter,
} from "./sceneTypeFilters";

const SceneList = lazyComponent(() => import("./SceneList"));
const SceneMarkerList = lazyComponent(() => import("./SceneMarkerList"));
const Scene = lazyComponent(() => import("./SceneDetails/Scene"));
const SceneCreate = lazyComponent(() => import("./SceneDetails/SceneCreate"));

const Scenes: React.FC = () => {
  return <SceneList view={View.Scenes} filterHook={normalSceneFilter} />;
};

const Movies: React.FC = () => {
  const titleProps = useTitleProps({ id: "movies" });
  return (
    <>
      <Helmet {...titleProps} />
      <SceneList view={View.Movies} filterHook={movieFilter} />
    </>
  );
};

const VirtualScenes: React.FC = () => {
  const titleProps = useTitleProps({ id: "virtual_scenes" });
  return (
    <>
      <Helmet {...titleProps} />
      <SceneList view={View.VirtualScenes} filterHook={virtualSceneFilter} />
    </>
  );
};

const SceneMarkers: React.FC = () => {
  const titleProps = useTitleProps({ id: "markers" });
  return (
    <>
      <Helmet {...titleProps} />
      <SceneMarkerList view={View.SceneMarkers} />
    </>
  );
};

const SceneRoutes: React.FC = () => {
  const titleProps = useTitleProps({ id: "scenes" });
  return (
    <>
      <Helmet {...titleProps} />
      <Switch>
        <Route exact path="/scenes" component={Scenes} />
        <Route exact path="/movies" component={Movies} />
        <Route exact path="/virtual-scenes" component={VirtualScenes} />
        <Route exact path="/scenes/markers" component={SceneMarkers} />
        <Route exact path="/scenes/new" component={SceneCreate} />
        <Route path="/scenes/:id" component={Scene} />
      </Switch>
    </>
  );
};

export default SceneRoutes;
