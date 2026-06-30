# Store conventions

State management for the app uses [Zustand](https://github.com/pmndrs/zustand).
[`blobStore.ts`](./blobStore.ts) is the reference implementation — new stores
should mirror its shape. These conventions exist to keep stores predictable and
to avoid unnecessary re-renders.

## 1. One store per domain

Each store owns a single cohesive slice of state (e.g. the recorded blob and its
metadata live in `blobStore`). Don't create a single global "app store"; split
by domain so unrelated state changes never re-render unrelated components.

## 2. Actions are colocated with state

State fields and the actions that mutate them are defined together in the same
`create<...>()` call. Components never call `set` directly — they call a named
action. This keeps all mutation logic for a domain in one file.

```ts
export const useBlobStore = create<{
  blob: Blob | null;
  title: string;
  setBlob: (blob: Blob | null) => void;
  setTitle: (title: string) => void;
  reset: () => void;
}>((set) => ({
  blob: null,
  title: "",
  setBlob: (blob) => set({ blob }),
  setTitle: (title) => set({ title }),
  reset: () => set({ blob: null, title: "" }),
}));
```

Also provide a `reset()` action so a domain's state can be returned to its
initial values in one call.

## 3. Read with granular selectors

Always select the narrowest slice a component needs. A component that only reads
`title` should subscribe to `title` alone, so it re-renders only when `title`
changes — not when an unrelated field does.

```ts
const title = useBlobStore((s) => s.title);
const setTitle = useBlobStore((s) => s.setTitle);
```

Avoid selecting the whole store (`useBlobStore()` with no selector): it
subscribes the component to every field.

## 4. Use `useShallow` for multi-field reads

When a component needs several fields at once, select them as one object wrapped
in `useShallow` (from `zustand/react/shallow`). This compares the selected
fields shallowly, so the component re-renders only when one of those fields
actually changes — not on every store update.

```ts
import { useShallow } from "zustand/react/shallow";

const { blob, title, description } = useBlobStore(
  useShallow((s) => ({
    blob: s.blob,
    title: s.title,
    description: s.description,
  })),
);
```

## 5. Refs stay in components

`useRef` values (DOM nodes, mutable timers, MediaRecorder instances, etc.) do
**not** belong in the store. Keep them as refs in the component that owns them.
The store holds serializable, render-relevant state; refs hold imperative
handles that shouldn't trigger re-renders.

## 6. Converting an existing hook (strangler pattern)

When migrating a hook that currently uses `useState`, back it with a store but
keep the hook's return shape identical, so existing consumers keep working
untouched. The hook becomes a thin shim over the store's selectors and actions.
