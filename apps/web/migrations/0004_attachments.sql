-- Attachments — one polymorphic media table (Active Storage's two tables collapsed into one).
--
-- `recordType` + `recordId` name the owner (Rails' attachable_type/attachable_id); the FIRST owner is a
-- meal photo (recordType = 'meal', recordId = the meal id). The bytes live in R2 under `key` (the Blobs
-- service owns them); this row is the metadata + the pointer. `key` is server-minted (FieldExcept).
--
-- camelCase quoted columns + ISO TEXT timestamps, like every domain table; plain `recordId` with NO
-- constraint (inline-join approach).
CREATE TABLE attachments (
  "id"          text not null primary key,
  "key"         text not null,       -- the R2 object key (server-minted)
  "recordType"  text not null,       -- the owner's type, e.g. 'meal'
  "recordId"    text not null,       -- the owner's id (FK, NO constraint)
  "name"        text not null,       -- the logical SLOT on the owner, e.g. 'photo'
  "filename"    text not null,       -- the original uploaded file name
  "contentType" text not null,       -- e.g. image/jpeg (server-sniffed)
  "byteSize"    integer not null,
  "createdAt"   text not null,
  "updatedAt"   text not null
);
-- The hot lookup: an owner's file in a named SLOT. NON-unique on purpose — cardinality is enforced in
-- the app layer (has_one = slot-keyed replace), so the table stays multi-row capable per slot. Do NOT
-- make this unique (it would foreclose has_many).
CREATE INDEX "attachments_slot_idx" ON attachments ("recordType", "recordId", "name");
