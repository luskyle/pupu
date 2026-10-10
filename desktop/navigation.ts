export function isEditorPreparationNavigation(current: string, next: string, preparing: boolean): boolean {
  if (!preparing) return false;
  const before = new URL(current);
  const after = new URL(next);
  return (
    before.origin === "https://creator.xiaohongshu.com" &&
    after.origin === before.origin &&
    before.pathname === "/publish/publish" &&
    after.pathname === before.pathname
  );
}
