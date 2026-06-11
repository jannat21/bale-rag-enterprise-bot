function buildContext(results) {

  const filtered =
    results.filter(r => r.score > 0.15);

  return filtered
    .map(r =>
      `[source:${r.source}]\n${r.text}`
    )
    .join("\n\n");
}

module.exports = { buildContext };
