import React, { useState } from "react";
import { useIntl } from "react-intl";
import { uniq } from "lodash-es";
import * as GQL from "src/core/generated-graphql";
import { Tag } from "src/components/Tags/TagSelect";
import { Studio } from "src/components/Studios/StudioSelect";
import { ScrapeDialog } from "src/components/Shared/ScrapeDialog/ScrapeDialog";
import {
  ScrapedImageRow,
  ScrapedInputGroupRow,
  ScrapedStringListRow,
  ScrapedTextAreaRow,
} from "src/components/Shared/ScrapeDialog/ScrapeDialogRow";
import {
  ObjectScrapeResult,
  ScrapeResult,
} from "src/components/Shared/ScrapeDialog/scrapeResult";
import { ScrapedStudioRow } from "src/components/Shared/ScrapeDialog/ScrapedObjectsRow";
import { useCreateScrapedStudio } from "src/components/Shared/ScrapeDialog/createObjects";
import { useScrapedTags } from "src/components/Shared/ScrapeDialog/scrapedTags";
import { IStudioStashBox } from "./StudioStashBoxModal";

interface IProps {
  studio: Partial<GQL.StudioUpdateInput>;
  parentStudio: Studio | null;
  studioTags: Tag[];
  scraped: GQL.ScrapedStudio;
  stashBox: IStudioStashBox;
  onClose: (scrapedStudio?: GQL.ScrapedStudio) => void;
}

export const StudioScrapeDialog: React.FC<IProps> = ({
  studio,
  parentStudio,
  studioTags,
  scraped,
  stashBox,
  onClose,
}) => {
  const intl = useIntl();
  const [name, setName] = useState(
    new ScrapeResult<string>(studio.name, scraped.name)
  );
  const [aliases, setAliases] = useState(
    new ScrapeResult<string>(studio.aliases?.join(", "), scraped.aliases)
  );
  const [urls, setURLs] = useState(
    new ScrapeResult<string[]>(
      studio.urls,
      scraped.urls ? uniq([...(studio.urls ?? []), ...scraped.urls]) : undefined
    )
  );
  const [details, setDetails] = useState(
    new ScrapeResult<string>(studio.details, scraped.details)
  );
  const [image, setImage] = useState(
    new ScrapeResult<string>(studio.image, scraped.image)
  );
  const [remoteSiteID, setRemoteSiteID] = useState(
    new ScrapeResult<string>(
      studio.stash_ids?.find((id) => id.endpoint === stashBox.endpoint)
        ?.stash_id,
      scraped.remote_site_id
    )
  );
  const [parent, setParent] = useState(
    new ObjectScrapeResult<GQL.ScrapedStudio>(
      parentStudio
        ? { stored_id: parentStudio.id, name: parentStudio.name }
        : undefined,
      scraped.parent?.stored_id ? scraped.parent : undefined
    )
  );
  const [newParent, setNewParent] = useState<GQL.ScrapedStudio | undefined>(
    scraped.parent && !scraped.parent.stored_id ? scraped.parent : undefined
  );
  const createParent = useCreateScrapedStudio({
    scrapeResult: parent,
    setScrapeResult: setParent,
    setNewObject: setNewParent,
    endpoint: stashBox.endpoint,
  });
  const { tags, newTags, scrapedTagsRow, linkDialog } = useScrapedTags(
    studioTags,
    scraped.tags,
    stashBox.endpoint
  );

  const allFields = [
    name,
    aliases,
    urls,
    details,
    image,
    remoteSiteID,
    parent,
    tags,
  ];
  if (
    allFields.every((field) => !field.scraped) &&
    !newParent &&
    !newTags.length
  ) {
    onClose();
    return null;
  }

  function makeScrapedStudio(): GQL.ScrapedStudio {
    return {
      name: name.getNewValue() ?? "",
      aliases: aliases.getNewValue(),
      urls: urls.getNewValue(),
      details: details.getNewValue(),
      image: image.getNewValue(),
      remote_site_id: remoteSiteID.getNewValue(),
      parent: parent.getNewValue(),
      tags: tags.getNewValue(),
    };
  }

  if (linkDialog) return linkDialog;

  return (
    <ScrapeDialog
      title={intl.formatMessage(
        { id: "dialogs.scrape_entity_title" },
        { entity_type: intl.formatMessage({ id: "studio" }) }
      )}
      onClose={(apply) => onClose(apply ? makeScrapedStudio() : undefined)}
    >
      <ScrapedInputGroupRow
        field="name"
        title={intl.formatMessage({ id: "name" })}
        result={name}
        onChange={setName}
      />
      <ScrapedInputGroupRow
        field="aliases"
        title={intl.formatMessage({ id: "aliases" })}
        result={aliases}
        onChange={setAliases}
      />
      <ScrapedTextAreaRow
        field="details"
        title={intl.formatMessage({ id: "details" })}
        result={details}
        onChange={setDetails}
      />
      <ScrapedStringListRow
        field="urls"
        title={intl.formatMessage({ id: "urls" })}
        result={urls}
        onChange={setURLs}
      />
      <ScrapedStudioRow
        field="parent_studio"
        title={intl.formatMessage({ id: "parent_studio" })}
        result={parent}
        onChange={setParent}
        newStudio={newParent}
        onCreateNew={createParent}
      />
      {scrapedTagsRow}
      <ScrapedImageRow
        field="image"
        title={intl.formatMessage({ id: "image" })}
        className="studio-image"
        result={image}
        onChange={setImage}
      />
      <ScrapedInputGroupRow
        field="remote_site_id"
        title={intl.formatMessage({ id: "stash_id" })}
        locked
        result={remoteSiteID}
        onChange={setRemoteSiteID}
      />
    </ScrapeDialog>
  );
};
