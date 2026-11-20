import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

// Media and file blocks are left out of the schema for now (ADR 003): they need file
// storage, which Driftnote does not have. The slash menu only offers blocks in the schema.
const { audio, file, image, video, ...blockSpecs } = defaultBlockSpecs;

export const noteSchema = BlockNoteSchema.create({ blockSpecs });
