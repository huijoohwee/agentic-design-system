export declare const SOURCE_FOLDER_ROOT_PATH = "";
export type SourceFileListItemLike = {
    id: string;
    name: string;
    active?: boolean;
    versionCount?: number;
};
export type SourceFileTreeNode = {
    kind: 'folder' | 'file';
    key: string;
    label: string;
    path: string;
    depth: number;
    fileId?: string;
    active?: boolean;
    versionCount?: number;
    children?: SourceFileTreeNode[];
};
export type VisibleSourceFileTreeNode = {
    kind: 'folder' | 'file';
    key: string;
    label: string;
    path: string;
    depth: number;
    fileId?: string;
    active?: boolean;
    versionCount?: number;
    hasChildren?: boolean;
};
export declare function normalizeSourceFolderPath(v: unknown): string;
export declare function buildSourceFileTree(sourceFiles: ReadonlyArray<SourceFileListItemLike> | undefined): {
    root: SourceFileTreeNode;
};
export declare function flattenVisibleSourceFileTree(args: {
    root: SourceFileTreeNode;
    expandedPaths: ReadonlySet<string>;
}): VisibleSourceFileTreeNode[];
export declare function expandSourceFolderAncestors(args: {
    expandedPaths: ReadonlySet<string>;
    selectedFolderPath: string;
}): Set<string>;
export declare function toggleSourceFolderPath(expandedPaths: ReadonlySet<string>, path: string): Set<string>;
export declare function listPersistedSourceFolderPaths(expandedPaths: Iterable<string>): string[];
export declare function resolveSourceParentFolderPath(path: string): string;
export declare function mountSourceExplorer(host: HTMLElement, options: {
    items: ReadonlyArray<SourceFileListItemLike>;
    selectedId?: string;
    label?: string;
    onOpen: (id: string) => void;
}): void;
