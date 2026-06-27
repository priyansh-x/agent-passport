export class RevocationList {
  private revoked = new Set<string>();
  private children = new Map<string, Set<string>>();

  registerChild(parentId: string, childId: string): void {
    let kids = this.children.get(parentId);
    if (!kids) {
      kids = new Set();
      this.children.set(parentId, kids);
    }
    kids.add(childId);
  }

  revoke(passportId: string): string[] {
    const revoked: string[] = [];
    const queue = [passportId];
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (this.revoked.has(id)) continue;
      this.revoked.add(id);
      revoked.push(id);
      const kids = this.children.get(id);
      if (kids) {
        for (const kid of kids) queue.push(kid);
      }
    }
    return revoked;
  }

  isRevoked(passportId: string): boolean {
    return this.revoked.has(passportId);
  }

  get size(): number {
    return this.revoked.size;
  }
}
