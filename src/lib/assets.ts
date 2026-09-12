export class ImageBank {
  private map = new Map<string, HTMLImageElement>();

  async load(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(
        (path) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.map.set(path, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = path;
          }),
      ),
    );
  }

  get(path: string): HTMLImageElement | null {
    return this.map.get(path) ?? null;
  }
}

export function assetPaths(enemyIds: string[], projectileIds: string[]): string[] {
  const paths = [
    "assets/player/idle.svg",
    "assets/player/jump.svg",
    "assets/player/slash.svg",
    "assets/player/struggle.svg",
    "assets/player/gameover.svg",
  ];
  for (const id of enemyIds) {
    paths.push(`assets/enemies/${id}/idle.svg`);
    paths.push(`assets/cinematics/${id}/struggle/1.svg`);
    paths.push(`assets/cinematics/${id}/struggle/2.svg`);
    paths.push(`assets/cinematics/${id}/struggle/3.svg`);
    paths.push(`assets/cinematics/${id}/gameover/1.svg`);
  }
  for (const id of projectileIds) {
    paths.push(`assets/projectiles/${id}/idle.svg`);
    paths.push(`assets/cinematics/${id}/struggle/1.svg`);
    paths.push(`assets/cinematics/${id}/struggle/2.svg`);
    paths.push(`assets/cinematics/${id}/struggle/3.svg`);
    paths.push(`assets/cinematics/${id}/gameover/1.svg`);
  }
  return paths;
}
