-- Intrinsic pixel size of uploaded images and videos.
-- Lets the feed reserve the correct aspect ratio before the file loads (no layout shift) and show
-- the whole image or video without cropping. Nullable: rows uploaded before this migration have no
-- size, and the UI falls back to measuring the file once it loads. Purely additive and non-destructive.
alter table media
  add column if not exists width  integer check (width  is null or width  between 1 and 20000),
  add column if not exists height integer check (height is null or height between 1 and 20000);
