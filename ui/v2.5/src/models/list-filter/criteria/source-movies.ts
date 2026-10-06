import { IntlShape } from "react-intl";
import {
  CriterionModifier,
  MultiCriterionInput,
} from "src/core/generated-graphql";
import { ILabeledId, ILabeledValueListValue } from "../types";
import {
  ISavedCriterion,
  ModifierCriterion,
  ModifierCriterionOption,
} from "./criterion";

const modifierOptions = [
  CriterionModifier.Includes,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

export const SourceMoviesCriterionOption = new ModifierCriterionOption({
  messageID: "movies",
  type: "source_movies",
  modifierOptions,
  defaultModifier: CriterionModifier.Includes,
  inputType: "movies",
  makeCriterion: () => new SourceMoviesCriterion(),
});

export class SourceMoviesCriterion extends ModifierCriterion<ILabeledValueListValue> {
  constructor() {
    super(SourceMoviesCriterionOption, { items: [], excluded: [] });
  }

  public cloneValues() {
    this.value = {
      ...this.value,
      items: this.value.items.map((value) => ({ ...value })),
      excluded: this.value.excluded.map((value) => ({ ...value })),
    };
  }

  public setFromSavedCriterion(
    criterion: ISavedCriterion<ILabeledId[] | ILabeledValueListValue>
  ) {
    const { modifier, value } = criterion;
    this.modifier = modifier;
    this.value = Array.isArray(value)
      ? { items: value, excluded: [] }
      : { items: value?.items ?? [], excluded: value?.excluded ?? [] };
  }

  protected getLabelValue(_intl: IntlShape): string {
    return this.value.items.map((value) => value.label).join(", ");
  }

  public toCriterionInput(): MultiCriterionInput {
    return {
      value: this.value.items.map((value) => value.id),
      excludes: this.value.excluded.map((value) => value.id),
      modifier: this.modifier,
    };
  }

  public isValid(): boolean {
    return (
      this.modifier === CriterionModifier.IsNull ||
      this.modifier === CriterionModifier.NotNull ||
      this.value.items.length > 0 ||
      this.value.excluded.length > 0
    );
  }
}
