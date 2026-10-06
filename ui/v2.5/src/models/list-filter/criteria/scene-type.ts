import { SceneType } from "src/core/generated-graphql";
import { ModifierCriterionOption, StringCriterion } from "./criterion";

export const SceneTypeCriterionOption = new ModifierCriterionOption({
  messageID: "type",
  type: "scene_type",
  options: ["Regular", "Virtual"],
  makeCriterion: () => new SceneTypeCriterion(),
});

export class SceneTypeCriterion extends StringCriterion {
  constructor(value: string = "") {
    super(SceneTypeCriterionOption);
    this.value = value;
  }

  // SceneFilterType.type is a scalar enum rather than a CriterionInput.
  public applyToCriterionInput(input: Record<string, unknown>) {
    switch (this.value) {
      case "Regular":
        input.type = SceneType.Normal;
        break;
      case "Virtual":
        input.type = SceneType.Virtual;
        break;
    }
  }
}
