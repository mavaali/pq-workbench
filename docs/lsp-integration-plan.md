## Goal

Replace our regex-based M handling in the editor with Microsoft's official Power Query language services. Closes the IntelliSense, syntax-validation, and error-mapping gaps in one integration. Also unlocks several nice-to-haves (hover docs, signature help, document symbols, folding, rename) without extra code paths.

Subsumes #9, #10, #11.

## Why now

We currently lean on regex for "looks like M" checks (App.handleRun) and dangerous-function detection. That gets us to "M-ish" but not "M". Users hit:
- No autocomplete on `Table.`, `List.`, ` must remember signaturesWeb.)` Contents(
- No syntax errors until executeQuery returns a Fabric 500
- No way to jump to a `shared` definition or see what's defined
- Confusing errors when a typo in a table name surfaces as a server-side failure

The official packages give us all of this in one cohesive API. They're MIT-licensed, maintained by the same team that ships the M language.

## Packages (all MIT, official Microsoft)

| Package | Version | Size | Role |
|---|---|---|---|
| `@microsoft/powerquery-language-services` | 1.0.0 | 2.2 MB | Main  Analysis interface |API 
| `@microsoft/powerquery-parser` | 0.19.0 | 2.6 MB |  AST |Transitive 
| `@microsoft/powerquery-formatter` | 1.0.0 | 480 KB |  formatter |Transitive 

Total bundle add: ~5.3 MB (same order of magnitude as our existing apache-arrow dependency).

## Architecture

Renderer-side. No new IPC. The `Analysis` instance wraps a `TextDocument`, which we keep in sync with Monaco's model:

```
      providers      Analysis       TextDocument changeMonaco model 
                                                  
      Completion (Monaco completion provider)                                                  
      Hover                                                  
      Signature help                                                  
      Diagnostics (setModelMarkers on debounce)                                                  
      Document symbols (outline)                                                  
      Folding ranges                                                  
```

We don't need full LSP  `monaco-languageclient` is overkill. The lib already returns `vscode-languageserver-types` shapes; we write ~50 LOC of direct adapters because we only need read-side providers.transport 

## Implementation plan

### Day  Closes #9, #10, #111 

**Setup**
- [ ] `npm install @microsoft/powerquery-language-services vscode-languageserver-textdocument`
- [ ] Create `src/renderer/lsp/powerquery. singleton Analysis per Monaco modelts` 
- [ ] Pick `LibraryDefinition` set (standard M; revisit if Fabric-specific lib exists)
- [ ] Wire TextDocument lifecycle (create on mount, dispose on unmount, incremental updates on change)

**Providers**
 calls `getAutocompleteItems`
 calls `getHover`
 `monaco.editor.setModelMarkers` for red squiggles + error positions in editor

**Cleanup**
- [ ] Remove the regex "looks like M" check in `App.handleRun` (the parser tells us authoritatively now)
- [ ] Keep `DangerousFunctionBanner` but rewrite to use the AST (`getDocumentSymbols` + walk for `Web.Contents` / `Sql.Database` / etc.) instead of regex
- [ ] Add a "Parse errors block execute" toggle in settings (default: warn, don't block)

**Validation**
- [ ] Verify completion fires on `Table.` and shows `Table.FromRecords` etc.
- [ ] Verify a deliberate syntax error (missing comma) shows a squiggle with the right line number
- [ ] Verify hovering over `Lakehouse.Contents` shows function docs (or graceful empty)
- [ ] Verify a complex real-world mashup (the green_tripdata  18 KB, 13 shared queries) doesn't lag the editorone 

### Day  Nice-to-haves (optional, scope as time allows)2 

- [ ] Signature help  `monaco.languages.registerSignatureHelpProvider`inside `(` 
- [ ] Semantic tokens for richer syntax highlighting (`getPartialSemanticTokens`)
 outline in a sidebar or breadcrumb (`getDocumentSymbols`)
- [ ] Folding ranges (`getFoldingRanges`)
- [ ] Goto-definition on Cmd+click (`getDefinition`)
- [ ] Rename (F2) (`getRenameEdits`)
- [ ] Formatter wired to a "Format Document" command (Shift+Opt+ uses `@microsoft/powerquery-formatter`F) 

### Day  Cross-cutting payoff (collapses #4 into LSP)3 

When a dataflow is loaded:
- [ ] Register an **external identifier provider** so completion surfaces the actual `shared` names from `mashup.pq` (e.g. `green_tripdata_2017`, `DefaultDestination`)
- [ ] If we've cached column schemas from a prior `executeQuery` in this session, register those as field-access completions on the relevant table identifier
- [ ] Optionally surface bound connection paths as completions inside `Web.")` first-arg positionContents("

At this point the AI Assist context-injection work from #4 mostly becomes  the LLM and the human both benefit from the LSP knowing about the user's actual data shape.redundant 

## Risks and unknowns

1. **`AnalysisSettings.library` selection.** Standard M library is the safe default. Need ~30 min to check whether the Fabric SDK adds Fabric-specific identifiers (`Lakehouse.Contents`, `Fabric.Warehouse`) or whether those are already in `StandardLibrary`.
2. **Monaco completion kind mapping.** Monaco and LSP use different `CompletionItemKind` enums. ~20 LOC adapter.
3. **TextDocument incremental sync with Monaco.** Standard pattern but fiddly; ~30 LOC and one bug to write/debug. Reference: VS Code's own implementation in the vscode-powerquery extension.
4. **Performance on large mashups.** The green_tripdata dataflow is 18 KB / 13 shared queries. Need to verify Analysis is performant enough for live use. If not, ratchet the debounce up or run analysis in a Worker.
5. **Powerquery language registration.** Monaco doesn't ship a `'powerquery'` language by default. We already have a `vscode-powerquery` Monaco contribution (or similar) for syntax  check whether it registers the language ID we need.highlighting 

## Out of scope

- Full LSP server in a separate process (not  renderer-side Analysis is fast enough for single-file editing)needed 
- M code formatting on save (deferred to Day 2)
- AI-driven refactoring beyond what existing AI Assist already does (#4)

## Acceptance criteria

- [ ] Typing `Table.` in the editor shows a list of `Table.*` functions
- [ ] A query with a syntax error shows a red squiggle at the right position
- [ ] Hovering over `Lakehouse.Contents` shows function docs
- [ ] No regression: existing query execution and connection-binding flows still work
- [ ] Bundle size growth < 6 MB

## Sizing

- Day 1: ~3 hours focused. ~300 LOC. Closes #9, #10, #11.2
- Day 2: ~2 hours. ~200 LOC. Nice-to-haves.
- Day 3: ~3 hours. ~250 LOC. Collapses #4 partially.

Total: 1 long session for Day 1, or 2 medium sessions for Day 1 + selective Day 2/3.

## References

- https://github.com/microsoft/vscode- the VS Code extension that uses this same libpowerquery 
- https://github.com/microsoft/powerquery-language- the lib itselfservices 
- https://github.com/microsoft/powerquery- underlying parserparser 
- Discovery work: see comment thread on closed PR for #1 / #14
