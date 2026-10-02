import React, { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import {
  ScrapeDialogRow,
  ScrapedInputGroupRow,
  ScrapedImageRow,
  ScrapedTextAreaRow,
  ScrapedStringListRow,
} from "src/components/Shared/ScrapeDialog/ScrapeDialogRow";
import { ScrapeDialog } from "src/components/Shared/ScrapeDialog/ScrapeDialog";
import TextUtils from "src/utils/text";
import {
  ObjectScrapeResult,
  ScrapeResult,
} from "src/components/Shared/ScrapeDialog/scrapeResult";
import { Studio } from "src/components/Studios/StudioSelect";
import { Group, GroupSelect } from "src/components/Groups/GroupSelect";
import { useCreateScrapedStudio } from "src/components/Shared/ScrapeDialog/createObjects";
import {
  NewScrapedObjects,
  ScrapedStudioRow,
} from "src/components/Shared/ScrapeDialog/ScrapedObjectsRow";
import { uniq } from "lodash-es";
import { Tag } from "src/components/Tags/TagSelect";
import { useScrapedTags } from "src/components/Shared/ScrapeDialog/scrapedTags";
import {
  queryFindGroupsForSelect,
  useGroupCreate,
} from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { ListFilterModel } from "src/models/list-filter/filter";

interface IGroupScrapeDialogProps {
  group: Partial<GQL.GroupUpdateInput>;
  existingContainingGroup?: Group;
  groupStudio: Studio | null;
  groupTags: Tag[];
  scraped: GQL.ScrapedGroup;

  onClose: (scrapedGroup?: GQL.ScrapedGroup) => void;
}

export const GroupScrapeDialog: React.FC<IGroupScrapeDialogProps> = ({
  group,
  existingContainingGroup,
  groupStudio,
  groupTags,
  scraped,
  onClose,
}) => {
  const intl = useIntl();
  const Toast = useToast();
  const [createGroup] = useGroupCreate();

  const [name, setName] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(group.name, scraped.name)
  );
  const [aliases, setAliases] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(group.aliases, scraped.aliases)
  );
  const [duration, setDuration] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(
      TextUtils.secondsToTimestamp(group.duration || 0),
      (() => {
        const seconds = TextUtils.durationToSeconds(scraped.duration);
        return seconds === null
          ? scraped.duration
          : TextUtils.secondsToTimestamp(seconds);
      })()
    )
  );
  const [date, setDate] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(group.date, scraped.date)
  );
  const scrapedContainingGroup = scraped.containing_group
    ? { name: scraped.containing_group }
    : undefined;
  const [containingGroup, setContainingGroup] = useState<
    ObjectScrapeResult<GQL.ScrapedGroup>
  >(
    new ObjectScrapeResult<GQL.ScrapedGroup>(
      existingContainingGroup
        ? {
            stored_id: existingContainingGroup.id,
            name: existingContainingGroup.name,
          }
        : undefined,
      scrapedContainingGroup,
      !!scrapedContainingGroup
    )
  );
  const [director, setDirector] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(group.director, scraped.director)
  );
  const [synopsis, setSynopsis] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(group.synopsis, scraped.synopsis)
  );
  const [studio, setStudio] = useState<ObjectScrapeResult<GQL.ScrapedStudio>>(
    new ObjectScrapeResult<GQL.ScrapedStudio>(
      groupStudio
        ? {
            stored_id: groupStudio.id,
            name: groupStudio.name,
          }
        : undefined,
      scraped.studio?.stored_id ? scraped.studio : undefined
    )
  );
  const [urls, setURLs] = useState<ScrapeResult<string[]>>(
    new ScrapeResult<string[]>(
      group.urls,
      scraped.urls
        ? uniq((group.urls ?? []).concat(scraped.urls ?? []))
        : undefined
    )
  );
  const [frontImage, setFrontImage] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(group.front_image, scraped.front_image)
  );
  const [backImage, setBackImage] = useState<ScrapeResult<string>>(
    new ScrapeResult<string>(group.back_image, scraped.back_image)
  );

  const [newStudio, setNewStudio] = useState<GQL.ScrapedStudio | undefined>(
    scraped.studio && !scraped.studio.stored_id ? scraped.studio : undefined
  );
  const [newContainingGroup, setNewContainingGroup] = useState<
    GQL.ScrapedGroup | undefined
  >(scrapedContainingGroup);

  useEffect(() => {
    const name = scraped.containing_group?.trim();
    if (!name) return;

    let cancelled = false;
    const filter = new ListFilterModel(GQL.FilterMode.Groups);
    filter.searchTerm = name;
    filter.itemsPerPage = 100;

    queryFindGroupsForSelect(filter)
      .then((result) => {
        if (cancelled) return;

        const existing = result.data.findGroups.groups.find(
          (candidate) =>
            candidate.name.trim().toLocaleLowerCase() ===
            name.toLocaleLowerCase()
        );
        if (!existing) return;

        setContainingGroup((current) => {
          if (current.newValue?.stored_id) return current;
          return current.cloneWithValue({
            stored_id: existing.id,
            name: existing.name,
          });
        });
        setNewContainingGroup(undefined);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [scraped.containing_group]);

  const createNewStudio = useCreateScrapedStudio({
    scrapeResult: studio,
    setScrapeResult: setStudio,
    setNewObject: setNewStudio,
  });

  async function createNewContainingGroup(toCreate: GQL.ScrapedGroup) {
    try {
      const result = await createGroup({
        variables: { input: { name: toCreate.name ?? "" } },
      });
      const created = result.data?.groupCreate;
      if (!created) return;

      setContainingGroup(
        containingGroup.cloneWithValue({
          stored_id: created.id,
          name: created.name,
        })
      );
      setNewContainingGroup(undefined);
    } catch (e) {
      Toast.error(e);
    }
  }

  function renderContainingGroup(
    result: ObjectScrapeResult<GQL.ScrapedGroup>,
    isNew?: boolean,
    onChangeFn?: (value: GQL.ScrapedGroup) => void
  ) {
    const value = isNew ? result.newValue : result.originalValue;
    const selectValue = value?.stored_id
      ? [
          {
            id: value.stored_id,
            name: value.name ?? "",
            aliases: null,
          },
        ]
      : [];

    return (
      <GroupSelect
        className="form-control react-select"
        isDisabled={!isNew}
        values={selectValue}
        onSelect={(items) => {
          if (onChangeFn && items[0]) {
            onChangeFn({
              stored_id: items[0].id,
              name: items[0].name,
            });
          }
        }}
      />
    );
  }

  const { tags, newTags, scrapedTagsRow, linkDialog } = useScrapedTags(
    groupTags,
    scraped.tags
  );

  const allFields = [
    name,
    aliases,
    duration,
    date,
    containingGroup,
    director,
    synopsis,
    studio,
    tags,
    urls,
    frontImage,
    backImage,
  ];
  // don't show the dialog if nothing was scraped
  if (
    allFields.every((r) => !r.scraped) &&
    !newStudio &&
    newTags.length === 0
  ) {
    onClose();
    return null;
  }

  function makeNewScrapedItem(): GQL.ScrapedGroup {
    const newStudioValue = studio.getNewValue();
    const durationString = duration.getNewValue();

    return {
      name: name.getNewValue() ?? "",
      aliases: aliases.getNewValue(),
      duration: durationString,
      date: date.getNewValue(),
      containing_group: containingGroup.getNewValue()?.name,
      director: director.getNewValue(),
      synopsis: synopsis.getNewValue(),
      studio: newStudioValue,
      tags: tags.getNewValue(),
      urls: urls.getNewValue(),
      front_image: frontImage.getNewValue(),
      back_image: backImage.getNewValue(),
    };
  }

  function renderScrapeRows() {
    return (
      <>
        <ScrapedInputGroupRow
          field="name"
          title={intl.formatMessage({ id: "name" })}
          result={name}
          onChange={(value) => setName(value)}
        />
        <ScrapedInputGroupRow
          field="aliases"
          title={intl.formatMessage({ id: "aliases" })}
          result={aliases}
          onChange={(value) => setAliases(value)}
        />
        <ScrapedInputGroupRow
          field="duration"
          title={intl.formatMessage({ id: "duration" })}
          result={duration}
          onChange={(value) => setDuration(value)}
        />
        <ScrapedInputGroupRow
          field="date"
          title={intl.formatMessage({ id: "date" })}
          placeholder="YYYY-MM-DD"
          result={date}
          onChange={(value) => setDate(value)}
        />
        <ScrapeDialogRow
          field="containing_group"
          title={intl.formatMessage({ id: "containing_group" })}
          result={containingGroup}
          onChange={(value) => setContainingGroup(value)}
          originalField={renderContainingGroup(containingGroup)}
          newField={renderContainingGroup(containingGroup, true, (value) =>
            setContainingGroup(containingGroup.cloneWithValue(value))
          )}
          newValues={
            newContainingGroup ? (
              <NewScrapedObjects
                newValues={[newContainingGroup]}
                onCreateNew={createNewContainingGroup}
                getName={(value) => value.name ?? ""}
              />
            ) : undefined
          }
        />
        <ScrapedInputGroupRow
          field="director"
          title={intl.formatMessage({ id: "director" })}
          result={director}
          onChange={(value) => setDirector(value)}
        />
        <ScrapedTextAreaRow
          field="synopsis"
          title={intl.formatMessage({ id: "synopsis" })}
          result={synopsis}
          onChange={(value) => setSynopsis(value)}
        />
        <ScrapedStudioRow
          field="studio"
          title={intl.formatMessage({ id: "studios" })}
          result={studio}
          onChange={(value) => setStudio(value)}
          newStudio={newStudio}
          onCreateNew={createNewStudio}
        />
        <ScrapedStringListRow
          field="urls"
          title={intl.formatMessage({ id: "urls" })}
          result={urls}
          onChange={(value) => setURLs(value)}
        />
        {scrapedTagsRow}
        <ScrapedImageRow
          field="front_image"
          title="Front Image"
          className="group-image"
          result={frontImage}
          onChange={(value) => setFrontImage(value)}
        />
        <ScrapedImageRow
          field="back_image"
          title="Back Image"
          className="group-image"
          result={backImage}
          onChange={(value) => setBackImage(value)}
        />
      </>
    );
  }

  if (linkDialog) {
    return linkDialog;
  }

  return (
    <ScrapeDialog
      title={intl.formatMessage(
        { id: "dialogs.scrape_entity_title" },
        { entity_type: intl.formatMessage({ id: "group" }) }
      )}
      onClose={(apply) => {
        onClose(apply ? makeNewScrapedItem() : undefined);
      }}
    >
      {renderScrapeRows()}
    </ScrapeDialog>
  );
};
