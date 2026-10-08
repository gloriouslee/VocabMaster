import { Folder } from '@/types';

/** Returns the folder id plus the ids of all of its descendants. */
export function getFolderScopeIds(folders: Folder[], folderId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const siblings = childrenByParent.get(folder.parentId) || [];
    siblings.push(folder.id);
    childrenByParent.set(folder.parentId, siblings);
  }
  const scope = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (scope.has(id)) continue;
    scope.add(id);
    stack.push(...(childrenByParent.get(id) || []));
  }
  return scope;
}
