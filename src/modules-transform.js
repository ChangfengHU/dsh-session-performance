export function transformModules(source) {
  const from = `for (const request of row.external) {
\t\t\t\t\tconst id = stripClientSuffix(request);
\t\t\t\t\tif (this.seed.has(request) || this.loadCache.has(id)) continue;
\t\t\t\t\tconst dependency = this.graphRows.get(id);
\t\t\t\t\tif (dependency !== void 0) await this.arriveGraphRow(dependency, next);
\t\t\t\t}`;
  const to = `await Promise.all(row.external.map(async request => {
          const id = stripClientSuffix(request);
          if (this.seed.has(request) || this.loadCache.has(id)) return;
          const dependency = this.graphRows.get(id);
          if (dependency !== void 0) await this.arriveGraphRow(dependency, next);
        }));`;
  if (source.split(from).length !== 2) throw new Error('Unsupported DSH module loader');
  return source.replace(from, to).replace(/\n\/\/# sourceMappingURL=.*$/, '');
}
