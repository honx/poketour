export interface SceneHost {
  go(name: "title" | "overworld" | "encounter" | "kodex" | "settings", payload?: unknown): void;
}
