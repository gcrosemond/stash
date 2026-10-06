import React from "react";
import { Button, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import {
  ModifierCriterionOption,
  NumberCriterion,
} from "src/models/list-filter/criteria/criterion";
import { ListFilterModel } from "src/models/list-filter/filter";
import { INumberValue } from "src/models/list-filter/types";
import { SidebarSection } from "src/components/Shared/Sidebar";
import { NumberField } from "src/utils/form";

interface ISidebarNumberFilterProps {
  title: React.ReactNode;
  option: ModifierCriterionOption;
  filter: ListFilterModel;
  setFilter: (filter: ListFilterModel) => void;
  sectionID?: string;
}

const numberModifiers = [
  CriterionModifier.Equals,
  CriterionModifier.NotEquals,
  CriterionModifier.GreaterThan,
  CriterionModifier.LessThan,
  CriterionModifier.Between,
  CriterionModifier.NotBetween,
];

function isRangeModifier(modifier: CriterionModifier) {
  return (
    modifier === CriterionModifier.Between ||
    modifier === CriterionModifier.NotBetween
  );
}

export const SidebarNumberFilter: React.FC<ISidebarNumberFilterProps> = ({
  title,
  option,
  filter,
  setFilter,
  sectionID,
}) => {
  const intl = useIntl();
  const criteria = filter.criteriaFor(option.type) as NumberCriterion[];
  const criterion = criteria[0];
  const modifier = criterion?.modifier ?? option.defaultModifier;
  const value = criterion?.value ?? { value: undefined, value2: undefined };

  function replaceCriterion(
    nextModifier: CriterionModifier,
    nextValue: INumberValue = value
  ) {
    const next = criterion
      ? criterion.clone()
      : (option.makeCriterion() as NumberCriterion);
    next.modifier = nextModifier;
    next.value = nextValue;
    setFilter(filter.replaceCriteria(option.type, [next]));
  }

  function setModifier(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextModifier = event.target.value as CriterionModifier;
    const primaryValue = value.value ?? 0;
    replaceCriterion(nextModifier, {
      value: primaryValue,
      value2: isRangeModifier(nextModifier)
        ? (value.value2 ?? primaryValue)
        : value.value2,
    });
  }

  function setValue(
    event: React.ChangeEvent<HTMLInputElement>,
    property: "value" | "value2"
  ) {
    const parsed = Number.parseInt(event.target.value, 10);
    replaceCriterion(modifier, {
      ...value,
      [property]: Number.isNaN(parsed) ? 0 : parsed,
    });
  }

  const secondaryInput = isRangeModifier(modifier) ? (
    <NumberField
      className="btn-secondary"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        setValue(event, "value2")
      }
      placeholder={intl.formatMessage({ id: "criterion.less_than" })}
      value={value.value2 ?? ""}
    />
  ) : null;

  return (
    <SidebarSection
      className="sidebar-number-filter"
      sectionID={sectionID}
      text={title}
    >
      <Form.Control
        as="select"
        aria-label={intl.formatMessage({ id: "filter" })}
        onChange={setModifier}
        value={modifier}
      >
        {numberModifiers.map((candidate) => (
          <option key={candidate} value={candidate}>
            {intl.formatMessage({ id: `criterion_modifier.${candidate}` })}
          </option>
        ))}
      </Form.Control>
      <div className="sidebar-number-filter-values">
        <NumberField
          className="btn-secondary"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setValue(event, "value")
          }
          placeholder={intl.formatMessage({
            id: isRangeModifier(modifier)
              ? "criterion.greater_than"
              : "criterion.value",
          })}
          value={value.value ?? ""}
        />
        {secondaryInput}
      </div>
      {criterion && (
        <Button
          className="sidebar-number-filter-clear"
          onClick={() => setFilter(filter.removeCriterion(option.type))}
          variant="secondary"
        >
          <FormattedMessage id="clear" />
        </Button>
      )}
    </SidebarSection>
  );
};
