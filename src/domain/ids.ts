/** Produces a new unique entity id (UUID in production). Injected so tests get predictable ids. */
export type IdGenerator = () => string;
