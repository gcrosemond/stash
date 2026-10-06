import React, { useState } from "react";
import { faFilm } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { useScenesConvertToMovie } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { ModalComponent } from "../Shared/Modal";

interface IConvertScenesToMovieDialogProps {
  selected: GQL.SlimSceneDataFragment[];
  onClose: (applied: boolean) => void;
}

export const ConvertScenesToMovieDialog: React.FC<
  IConvertScenesToMovieDialogProps
> = ({ selected, onClose }) => {
  const Toast = useToast();
  const [convertScenes] = useScenesConvertToMovie();
  const [isConverting, setIsConverting] = useState(false);

  const convert = async () => {
    setIsConverting(true);
    try {
      await convertScenes({ variables: { ids: selected.map((scene) => scene.id) } });
      Toast.success(
        `Converted ${selected.length} ${selected.length === 1 ? "scene" : "scenes"} to ${selected.length === 1 ? "a movie" : "movies"}.`
      );
      onClose(true);
    } catch (error) {
      Toast.error(error);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <ModalComponent
      show
      icon={faFilm}
      header="Convert selected scenes to movies"
      accept={{ onClick: () => void convert(), text: "Convert" }}
      cancel={{ onClick: () => onClose(false), text: "Cancel", variant: "secondary" }}
      isRunning={isConverting}
    >
      <p>
        Convert {selected.length} selected {selected.length === 1 ? "scene" : "scenes"} to {selected.length === 1 ? "a movie" : "movies"} for virtual scene editing?
      </p>
      <p className="mb-0 text-muted">
        This does not change video files or existing scene metadata.
      </p>
    </ModalComponent>
  );
};
