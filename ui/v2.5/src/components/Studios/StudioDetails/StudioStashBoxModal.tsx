import React, { useEffect, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { ModalComponent } from "src/components/Shared/Modal";
import { StudioSearchResult } from "src/components/Shared/StashBoxIDSearchModal";
import { useDebounce } from "src/hooks/debounce";
import { stashboxDisplayName } from "src/utils/stashbox";

const CLASSNAME = "StudioScrapeModal";
const CLASSNAME_LIST = `${CLASSNAME}-list`;
const CLASSNAME_LIST_CONTAINER = `${CLASSNAME_LIST}-container`;

export interface IStudioStashBox extends GQL.StashBox {
  index: number;
}

interface IProps {
  instance: IStudioStashBox;
  name?: string;
  onHide: () => void;
  onSelectStudio: (studio: GQL.ScrapedStudio) => void;
}

const StudioStashBoxModal: React.FC<IProps> = ({
  instance,
  name,
  onHide,
  onSelectStudio,
}) => {
  const intl = useIntl();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(name ?? "");
  const { data, loading } = GQL.useScrapeSingleStudioQuery({
    variables: {
      source: { stash_box_endpoint: instance.endpoint },
      input: { query },
    },
    skip: query === "",
  });
  const studios = data?.scrapeSingleStudio ?? [];
  const onInputChange = useDebounce(setQuery, 500);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <ModalComponent
      show
      onHide={onHide}
      header={`Scrape studio from ${stashboxDisplayName(
        instance.name,
        instance.index
      )}`}
      accept={{
        text: intl.formatMessage({ id: "actions.cancel" }),
        onClick: onHide,
        variant: "secondary",
      }}
    >
      <div className={CLASSNAME}>
        <Form.Control
          defaultValue={name ?? ""}
          placeholder="Studio name..."
          className="text-input mb-4"
          ref={inputRef}
          onChange={(event) => onInputChange(event.currentTarget.value)}
        />
        {loading ? (
          <div className="m-4 text-center">
            <LoadingIndicator inline />
          </div>
        ) : studios.length > 0 ? (
          <div className={CLASSNAME_LIST_CONTAINER}>
            <div className="mt-1">
              <FormattedMessage
                id="dialogs.studios_found"
                values={{ count: studios.length }}
              />
            </div>
            <ul className={CLASSNAME_LIST}>
              {studios.map((studio, index) => (
                <li key={`${studio.remote_site_id ?? studio.name}-${index}`}>
                  <button
                    type="button"
                    className="minimal w-100 text-left"
                    onClick={() => onSelectStudio(studio)}
                  >
                    <StudioSearchResult studio={studio} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          query !== "" && <h5 className="text-center">No results found.</h5>
        )}
      </div>
    </ModalComponent>
  );
};

export default StudioStashBoxModal;
