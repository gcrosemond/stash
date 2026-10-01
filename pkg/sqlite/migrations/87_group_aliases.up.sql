CREATE TABLE `group_aliases` (
  `group_id` integer NOT NULL,
  `alias` varchar(255) NOT NULL,
  foreign key(`group_id`) references `groups`(`id`) on delete CASCADE,
  PRIMARY KEY(`group_id`, `alias`)
);

CREATE INDEX `group_aliases_alias` on `group_aliases` (`alias`);
